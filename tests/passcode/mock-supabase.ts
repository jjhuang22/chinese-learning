// Local integration-test service only. Never deployed or used with real credentials.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const key = "local-integration-service-key-only";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values ('${owner}'),('${other}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
);
await db.exec(await readFile("supabase/schema.sql", "utf8"));
const fixture = JSON.parse(
  await readFile("lib/sample-lessons.json", "utf8"),
)[1];
async function reset() {
  await db.exec(
    "reset role;truncate public.lessons,public.learner_state,public.passcode_attempts;",
  );
  await db.query(
    "insert into public.lessons(user_id,lesson_date,content) values ($1,$2,$3),($4,$2,$5)",
    [
      owner,
      fixture.date,
      { ...fixture, title: "PRIVATE_LESSON_SENTINEL" },
      other,
      { ...fixture, title: "OTHER_LEARNER_SENTINEL" },
    ],
  );
  await db.exec("set role service_role");
}
await reset();
createServer(async (request, response) => {
  const url = new URL(request.url!, "http://127.0.0.1:4010");
  const send = (status: number, data: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(status === 204 ? undefined : JSON.stringify(data));
  };
  try {
    if (url.pathname === "/health") {
      send(200, { ready: true });
      return;
    }
    if (url.pathname === "/__reset" && request.method === "POST") {
      await reset();
      if (url.searchParams.get("empty") === "1") {
        await db.query("delete from public.lessons where user_id=$1", [owner]);
      }
      send(200, { reset: true });
      return;
    }
    if (request.headers.apikey !== key) {
      send(401, { message: "Test key required" });
      return;
    }
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    if (url.pathname === "/rest/v1/rpc/register_unlock_attempt") {
      const { rows } = await db.query<{ allowed: boolean }>(
        "select public.register_unlock_attempt($1) as allowed",
        [body.client_key],
      );
      send(200, rows[0].allowed);
      return;
    }
    if (url.pathname === "/rest/v1/rpc/save_progress") {
      const { rows } = await db.query<{ revision: number | null }>(
        "select public.save_progress($1,$2,$3) as revision",
        [body.learner_id, body.expected_revision, body.progress_data],
      );
      // PostgREST returns bigint JSON numbers, while the SQL driver returns bigint.
      send(200, rows[0].revision === null ? null : Number(rows[0].revision));
      return;
    }
    const id = url.searchParams.get("user_id")?.replace(/^eq\./, "");
    if (url.pathname === "/rest/v1/lessons") {
      if (request.method === "GET") {
        const { rows } = await db.query(
          "select content from public.lessons where user_id=$1 order by lesson_date",
          [id],
        );
        send(200, rows);
        return;
      }
      if (request.method === "POST") {
        await db.query(
          "insert into public.lessons(user_id,lesson_date,content) values ($1,$2,$3)",
          [body.user_id, body.lesson_date, body.content],
        );
        send(201, null);
        return;
      }
    }
    if (url.pathname === "/rest/v1/learner_state") {
      if (request.method === "GET") {
        const { rows } = await db.query(
          "select data, revision from public.learner_state where user_id=$1",
          [id],
        );
        send(200, rows);
        return;
      }
    }
    send(404, { message: "Unknown test endpoint" });
  } catch (error) {
    send((error as { code?: string }).code === "23505" ? 409 : 500, {
      code: (error as { code?: string }).code,
      message: "Local database request failed",
    });
  }
}).listen(4010, "127.0.0.1", () =>
  console.log("Local test database service ready"),
);
