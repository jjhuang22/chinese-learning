import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { loadLessons } from "../../lib/library";

test("library loading pages beyond the default API cap and scopes every page to the learner", async () => {
  const fixture = JSON.parse(
    await readFile("lib/sample-lessons.json", "utf8"),
  )[0];
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    content: { ...fixture, id: `lesson-${i}` },
  }));
  const ranges: number[][] = [];
  const client = createClient("https://example.supabase.co", "test-key", {
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("user_id")).toBe("eq.test-learner");
        expect(url.searchParams.get("order")).toBe("lesson_date.asc");
        const offset = Number(url.searchParams.get("offset"));
        const limit = Number(url.searchParams.get("limit"));
        ranges.push([offset, limit]);
        return Response.json(rows.slice(offset, offset + limit));
      },
    },
  });
  const lessons = await loadLessons(client, "test-learner");
  expect(lessons).toHaveLength(1001);
  expect(lessons.at(-1)?.id).toBe("lesson-1000");
  expect(ranges).toEqual([
    [0, 500],
    [500, 500],
    [1000, 500],
  ]);
});

test("library loading rejects malformed administrative lesson data", async () => {
  const client = createClient("https://example.supabase.co", "test-key", {
    global: {
      fetch: async () => Response.json([{ content: { title: "incomplete" } }]),
    },
  });
  await expect(loadLessons(client, "test-learner")).rejects.toThrow();
});
