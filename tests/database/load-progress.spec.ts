import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadProgress } from "../../lib/load-progress";

const state = { cards: [], dismissed: [], read: ["kept"], feedback: {} };
test("missing revision column preserves existing progress and disables writes", async () => {
  const selects: string[] = [];
  const db = createClient("https://example.supabase.co", "test-key", {
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("user_id")).toBe("eq.owner");
        const select = url.searchParams.get("select")!;
        selects.push(select);
        return select.includes("revision")
          ? Response.json(
              {
                code: "42703",
                message: "column learner_state.revision does not exist",
              },
              { status: 400 },
            )
          : Response.json([{ data: state }]);
      },
    },
  });
  expect(await loadProgress(db, "owner")).toEqual({ state, revision: null });
  expect(selects).toEqual(["data,revision", "data"]);
});

test("migrated databases keep their real revision", async () => {
  const db = createClient("https://example.supabase.co", "test-key", {
    global: {
      fetch: async () => Response.json([{ data: state, revision: 12 }]),
    },
  });
  expect(await loadProgress(db, "owner")).toEqual({ state, revision: 12 });
});

test("permission errors do not fall back to empty progress or an unscoped query", async () => {
  let requests = 0;
  const db = createClient("https://example.supabase.co", "test-key", {
    global: {
      fetch: async () => {
        requests++;
        return Response.json(
          { code: "42501", message: "permission denied" },
          { status: 403 },
        );
      },
    },
  });
  await expect(loadProgress(db, "owner")).rejects.toThrow(
    "Your progress could not be loaded",
  );
  expect(requests).toBe(1);
});
