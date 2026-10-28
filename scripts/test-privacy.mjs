// Ensure even a clean checkout builds with private runtime data present.
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const file = ".private/original-lessons.json";
let generated = false;
try {
  try {
    await readFile(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await mkdir(".private", { recursive: true });
    const lessons = JSON.parse(
      await readFile("lib/sample-lessons.json", "utf8"),
    );
    lessons[0].title = "PRIVATE_BUILD_CANARY_" + randomUUID();
    // Exclusive creation protects an original file created concurrently.
    await writeFile(file, JSON.stringify(lessons), { flag: "wx" });
    generated = true;
  }
  for (const args of [
    ["run", "build"],
    [
      "exec",
      "playwright",
      "test",
      "--",
      "--config=playwright.privacy.config.ts",
    ],
  ]) {
    const result = spawnSync("npm", args, { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
} finally {
  if (generated) await unlink(file);
}
