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
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`,
    );
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
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`,
    );
    expect(
      (await db.query("select content from public.lessons")).rows,
    ).toHaveLength(1);
  } finally {
    await db.close();
  }
});
test("database policies deny anonymous reads, foreign writes, cross-user reads, and lesson replacement", async () => {
  const db = await database();
  try {
    const lesson = parseLessonImport(
      await readFile("public/example-lesson.json", "utf8"),
    );
    await db.query(
      "insert into public.lessons(user_id,lesson_date,content) values ($1,$2,$3)",
      [owner, lesson.date, lesson],
    );
    await db.exec("set role anon");
    await expect(db.query("select * from public.lessons")).rejects.toThrow(
      /permission denied/,
    );
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${other}',false);`,
    );
    expect((await db.query("select * from public.lessons")).rows).toHaveLength(
      0,
    );
    await expect(
      db.query(
        "insert into public.lessons(user_id,lesson_date,content) values ($1,$2,$3)",
        [owner, "2026-10-23", lesson],
      ),
    ).rejects.toThrow(/row-level security/);
    await db.exec(
      `select set_config('request.jwt.claim.sub','${owner}',false);`,
    );
    await expect(
      db.query("update public.lessons set content='{}'::jsonb"),
    ).rejects.toThrow(/permission denied/);
    const { rows } = await db.query<{ content: typeof lesson }>(
      "select content from public.lessons",
    );
    expect(rows[0].content).toEqual(lesson);
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
