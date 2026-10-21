import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/database",
  workers: 1,
  timeout: 60000,
});
