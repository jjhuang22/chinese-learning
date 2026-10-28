import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { parseLessonImport } from "../../lib/import-lesson";
import { lessonSchema } from "../../lib/model";
const owner = "11111111-1111-4111-8111-111111111111";
const migration =
  "supabase/migrations/20261021233746_daily_lesson_ingestion.sql";
async function setup() {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${owner}');`,
  );
  await db.exec(await readFile("supabase/schema.sql", "utf8"));
  await db.query(
    "insert into public.lessons(user_id,lesson_date,content) values($1,'2000-01-01','{}')",
    [owner],
  );
  await db.exec(await readFile(migration, "utf8"));
  const example = JSON.parse(
    await readFile("public/example-lesson.json", "utf8"),
  );
  const save = async (input: unknown, dry = false) =>
    (
      await db.query<{ result: { status: string; lesson: unknown } }>(
        "select private.ingest_daily_lesson($1,$2) as result",
        [input, dry],
      )
    ).rows[0].result;
  return { db, example, save };
}
test("two and three passages normalize identically; retries never replace an existing lesson", async () => {
  const { db, example, save } = await setup();
  try {
    for (const count of [2, 3]) {
      const raw = structuredClone(example);
      raw.date = `2026-10-${20 + count}`;
      if (count === 3) raw.passages.push(structuredClone(raw.passages[0]));
      raw.title = " \t完整課文\n ";
      const normalized = parseLessonImport(JSON.stringify(raw));
      expect(lessonSchema.parse(normalized)).toEqual(normalized);
      expect(await save(raw, true)).toEqual({
        status: "validated",
        lesson: normalized,
      });
      expect(
        (await db.query("select * from public.lessons")).rows,
      ).toHaveLength(count - 1);
      expect(await save(raw)).toEqual({
        status: "created",
        lesson: normalized,
      });
      raw.title = "Changed title";
      expect(await save(raw)).toEqual({
        status: "already_exists",
        lesson: normalized,
      });
    }
    expect(
      (await db.query("select * from public.learner_state")).rows,
    ).toHaveLength(0);
  } finally {
    await db.close();
  }
});
test("invalid imports fail without publishing and browser roles cannot call the writer", async () => {
  const { db, example, save } = await setup();
  try {
    const invalid = [
      (v: typeof example) => {
        v.passages = v.passages.slice(0, 1);
      },
      (v: typeof example) => {
        v.passages = [...v.passages, ...v.passages];
      },
      (v: typeof example) => {
        v.date = "2026-02-30";
      },
      (v: typeof example) => {
        v.passages[0].sentences[0].paragraph = 1;
      },
      (v: typeof example) => {
        v.passages[0].sentences[1].paragraph = 4;
      },
      (v: typeof example) => {
        v.suggestions[0].sentence = v.suggestions[0].text;
      },
      (v: typeof example) => {
        v.suggestions[0].text = "不在原文的詞語";
        v.suggestions[0].kind = "vocabulary";
      },
      (v: typeof example) => {
        v.suggestions[0].extra = true;
      },
      (v: typeof example) => {
        v.title = " \n ";
      },
      (v: typeof example) => {
        v.notes = [{ title: "title", text: 10 }];
      },
      (v: typeof example) => {
        v.passages[0].format = "Other";
      },
      (v: typeof example) => {
        v.passages[0].sentences[0].paragraph = 0.5;
      },
    ];
    for (const mutate of invalid) {
      const raw = structuredClone(example);
      mutate(raw);
      expect(() => parseLessonImport(JSON.stringify(raw))).toThrow();
      await expect(save(raw)).rejects.toThrow();
    }
    await expect(save(null)).rejects.toThrow();
    await expect(
      save({ ...example, title: "中".repeat(100001) }),
    ).rejects.toThrow(/300 KB/);
    expect((await db.query("select * from public.lessons")).rows).toHaveLength(
      1,
    );
    for (const role of ["anon", "authenticated", "service_role"]) {
      await db.exec(`set role ${role}`);
      await expect(save(example)).rejects.toThrow(/permission denied/);
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});
