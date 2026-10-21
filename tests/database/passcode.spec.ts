import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  createSession,
  verifySession,
  matchesPasscode,
  SESSION_SECONDS,
} from "../../lib/passcode";
const names = [
  "APP_PASSCODE",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LEARNER_USER_ID",
] as const;
let old: Record<string, string | undefined>;
test.beforeEach(() => {
  old = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.APP_PASSCODE = "local-unit-test-passcode";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-unit-test-server-key";
  process.env.LEARNER_USER_ID = "11111111-1111-4111-8111-111111111111";
});
test.afterEach(() => {
  for (const name of names) {
    if (old[name] === undefined) delete process.env[name];
    else process.env[name] = old[name];
  }
});
test("sessions reject tampering and expiration and rotate when the passcode or learner changes", () => {
  const now = Date.now();
  const token = createSession(now);
  expect(verifySession(token, now)).toBe(true);
  expect(verifySession(token, now + (SESSION_SECONDS + 1) * 1000)).toBe(false);
  expect(verifySession(token.slice(0, -2) + "xx", now)).toBe(false);
  expect(matchesPasscode("wrong")).toBe(false);
  expect(matchesPasscode("local-unit-test-passcode")).toBe(true);
  process.env.APP_PASSCODE = "changed-unit-test-passcode";
  expect(verifySession(token, now)).toBe(false);
  process.env.APP_PASSCODE = "local-unit-test-passcode";
  process.env.LEARNER_USER_ID = "22222222-2222-4222-8222-222222222222";
  expect(verifySession(token, now)).toBe(false);
});
test("persistent limiter is private, applies across requests, and resets expired windows", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
    );
    await db.exec(await readFile("supabase/schema.sql", "utf8"));
    const key = "a".repeat(64);
    await db.exec("set role service_role");
    for (let i = 0; i < 5; i++)
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select public.register_unlock_attempt($1) as allowed",
            [key],
          )
        ).rows[0].allowed,
      ).toBe(true);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.register_unlock_attempt($1) as allowed",
          [key],
        )
      ).rows[0].allowed,
    ).toBe(false);
    await db.exec(
      "reset role;update public.passcode_attempts set window_start=now()-interval '16 minutes';set role service_role;",
    );
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.register_unlock_attempt($1) as allowed",
          [key],
        )
      ).rows[0].allowed,
    ).toBe(true);
    await db.exec("reset role;set role anon");
    await expect(
      db.query("select * from public.passcode_attempts"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select public.register_unlock_attempt($1)", [key]),
    ).rejects.toThrow(/permission denied/);
  } finally {
    await db.close();
  }
});
