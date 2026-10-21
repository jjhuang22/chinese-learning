import { test, expect } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
test("deployed mode redirects before rendering lessons, even with LOCAL_DEMO enabled", async ({
  request,
}) => {
  for (const suffix of ["", "?_rsc=privacy"]) {
    const response = await request.get("/" + suffix, {
      maxRedirects: 0,
      headers: { Cookie: "sb-test-auth-token=forged; LOCAL_DEMO=1" },
    });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/sign-in");
    const html = await response.text();
    expect(html).not.toContain("reading-paragraph");
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  const login = await request.get("/sign-in");
  expect(login.status()).toBe(200);
  expect(await login.text()).toContain("Sign in");
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
