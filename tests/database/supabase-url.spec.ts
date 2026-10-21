import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { supabaseProjectUrl } from "../../lib/supabase-config";
test("copied REST endpoint produces valid auth and database requests in the real SDK", async () => {
  const paths: string[] = [];
  const client = createClient(
    supabaseProjectUrl("https://example.supabase.co/rest/v1/")!,
    "browser-test-key",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input) => {
          paths.push(new URL(String(input)).pathname);
          return new Response(
            JSON.stringify({ message: "Test response", code: "test" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        },
      },
    },
  );
  await client.auth.getUser("test-access-token");
  await client.from("lessons").select("*");
  expect(paths).toEqual(["/auth/v1/user", "/rest/v1/lessons"]);
});
test("base URLs and custom prefixes are preserved; copied auth endpoint is normalized", () => {
  expect(supabaseProjectUrl(" https://example.supabase.co/ ")).toBe(
    "https://example.supabase.co",
  );
  expect(supabaseProjectUrl("https://example.supabase.co/auth/v1")).toBe(
    "https://example.supabase.co",
  );
  expect(supabaseProjectUrl("https://example.com/supabase")).toBe(
    "https://example.com/supabase",
  );
  expect(supabaseProjectUrl(undefined)).toBeUndefined();
});
