import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { parseLessonImport } from "../../lib/import-lesson";
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
async function database() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values ('${owner}'),('${other}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(await readFile("supabase/schema.sql", "utf8"));
  return db;
}
test("example parses, persists as the learner, rejects duplicate dates, and can be read back intact", async () => {
  const db = await database();
  try {
    const lesson = parseLessonImport(
      await readFile("public/example-lesson.json", "utf8"),
    );
    await db.exec(`set role service_role;`);
    await db.query(
      "insert into public.lessons(user_id,lesson_date,content) values ($1,$2,$3)",
      [owner, lesson.date, lesson],
    );
    const { rows } = await db.query<{ content: typeof lesson }>(
      "select content from public.lessons",
    );
    expect(rows[0].content).toEqual(lesson);
    await expect(
      db.query(
        "insert into public.lessons(user_id,lesson_date,content) values ($1,$2,$3)",
        [owner, lesson.date, lesson],
      ),
    ).rejects.toThrow(/duplicate key/);
    expect(
      (await db.query("select content from public.lessons")).rows,
    ).toHaveLength(1);
    await db.exec("reset role");
    await db.exec(await readFile("supabase/schema.sql", "utf8"));
    await db.exec(`set role service_role;`);
    expect(
      (await db.query("select content from public.lessons")).rows,
    ).toHaveLength(1);
  } finally {
    await db.close();
  }
});
test("schema migration removes legacy browser access while preserving learner data", async () => {
  const db = await database();
  try {
    const lesson = parseLessonImport(
      await readFile("public/example-lesson.json", "utf8"),
    );
    await db.query(
      "insert into public.lessons(user_id,lesson_date,content) values ($1,$2,$3)",
      [owner, lesson.date, lesson],
    );
    // Model the previous schema, including its grants and owner policies.
    await db.exec(`
      grant select, insert on public.lessons to authenticated;
      grant select, insert, update, delete on public.learner_state to authenticated;
      create policy "Read own lessons" on public.lessons for select to authenticated using (auth.uid() = user_id);
      create policy "Insert own lessons" on public.lessons for insert to authenticated with check (auth.uid() = user_id);
      create policy "Own progress" on public.learner_state for all to authenticated using (auth.uid() = user_id);
    `);
    await db.exec(await readFile("supabase/schema.sql", "utf8"));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(
        `set role ${role};select set_config('request.jwt.claim.sub','${owner}',false);`,
      );
      for (const query of [
        "select * from public.lessons",
        "select * from public.learner_state",
        `insert into public.lessons(user_id,lesson_date,content) values ('${owner}','2026-10-23','{}')`,
        `insert into public.learner_state(user_id) values ('${owner}')`,
        "update public.learner_state set data='{}'",
        "delete from public.learner_state",
        `select public.save_progress('${owner}',0,'{}')`,
      ])
        await expect(db.query(query)).rejects.toThrow(/permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    expect(
      (await db.query("select content from public.lessons")).rows[0],
    ).toEqual({ content: lesson });
  } finally {
    await db.close();
  }
});

test("source context must be a complete exact sentence", async () => {
  const example = JSON.parse(
    await readFile("public/example-lesson.json", "utf8"),
  );
  const original = example.suggestions[0].sentence;
  example.suggestions[0].sentence = example.suggestions[0].text;
  expect(() => parseLessonImport(JSON.stringify(example))).toThrow(
    /source sentence exactly/,
  );
  example.suggestions[0].sentence = original.slice(0, -1);
  expect(() => parseLessonImport(JSON.stringify(example))).toThrow(
    /source sentence exactly/,
  );
  example.suggestions[0].sentence = original;
  expect(() => parseLessonImport(JSON.stringify(example))).not.toThrow();
});

test("progress revisions reject stale initial inserts and updates without replacing saved work", async () => {
  const db = await database();
  try {
    await db.exec("set role service_role");
    const save = async (revision: number, marker: string) =>
      (
        await db.query<{ revision: number | null }>(
          "select public.save_progress($1,$2,$3) as revision",
          [owner, revision, { marker }],
        )
      ).rows[0].revision;
    expect(await save(4, "missing-row")).toBeNull();
    expect(Number(await save(0, "first"))).toBe(1);
    expect(await save(0, "stale-initial-tab")).toBeNull();
    expect(Number(await save(1, "second"))).toBe(2);
    expect(await save(1, "delayed-request")).toBeNull();
    expect(
      (await db.query("select data from public.learner_state")).rows,
    ).toEqual([{ data: { marker: "second" } }]);
    await db.exec("reset role");
    await db.query(
      "insert into public.learner_state(user_id,data) values ($1,$2)",
      [other, { marker: "legacy" }],
    );
    await db.exec(await readFile("supabase/schema.sql", "utf8"));
    await db.exec("set role service_role");
    expect(
      Number(
        (
          await db.query<{ revision: number }>(
            "select public.save_progress($1,0,$2) as revision",
            [other, { marker: "migrated" }],
          )
        ).rows[0].revision,
      ),
    ).toBe(1);
  } finally {
    await db.close();
  }
});

test("copy-paste SQL example executes and stores the same normalized document", async () => {
  const db = await database();
  try {
    const sql = (await readFile("supabase/example-lesson.sql", "utf8")).replace(
      "YOUR_SUPABASE_USER_UUID",
      owner,
    );
    await db.exec(sql);
    const { rows } = await db.query<{
      content: ReturnType<typeof parseLessonImport>;
    }>("select content from public.lessons");
    expect(rows[0].content).toEqual(
      parseLessonImport(await readFile("public/example-lesson.json", "utf8")),
    );
  } finally {
    await db.close();
  }
});
