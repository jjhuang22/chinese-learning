import { test, expect } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
test("personal progress and writes stay protected even with forged demo cookies", async ({
  request,
}) => {
  const headers = { Cookie: "sb-test-auth-token=forged; LOCAL_DEMO=1" };
  const progress = await request.get("/api/progress", { headers });
  expect(progress.status()).toBe(401);
  expect(progress.headers()["cache-control"]).toContain("no-store");
  const imported = await request.post("/api/import", { headers, data: {} });
  expect(imported.status()).toBe(401);
  const login = await request.get("/sign-in");
  expect(login.status()).toBe(200);
  expect(await login.text()).toContain("Enable editing");
});
test("original lessons are ignored and absent from shipped browser JavaScript", async () => {
  expect(
    execFileSync("git", ["check-ignore", ".private/original-lessons.json"], {
      encoding: "utf8",
    }).trim(),
  ).toBe(".private/original-lessons.json");
  expect(
    execFileSync("git", ["ls-files", ".private"], { encoding: "utf8" }).trim(),
  ).toBe("");
  async function scan(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await scan(file);
      else if (file.endsWith(".js")) {
        const source = await readFile(file, "utf8");
        let originals: { title: string }[] = [];
        try {
          originals = JSON.parse(
            await readFile(".private/original-lessons.json", "utf8"),
          );
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        for (const original of originals)
          expect(source).not.toContain(original.title);
      }
    }
  }
  await scan(".next/static");
});
