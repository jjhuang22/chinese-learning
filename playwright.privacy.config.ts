import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/privacy",
  use: { baseURL: "http://127.0.0.1:3001" },
  webServer: {
    command: "npm run start -- --port 3001",
    url: "http://127.0.0.1:3001/sign-in",
    reuseExistingServer: false,
    env: { VERCEL: "1", LOCAL_DEMO: "1" },
    timeout: 60000,
  },
});
