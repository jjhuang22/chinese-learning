import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/passcode",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:3002",
    ...devices["Desktop Chrome"],
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "node --experimental-strip-types tests/passcode/mock-supabase.ts",
      url: "http://127.0.0.1:4010/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "npm run start -- --port 3002",
      url: "http://127.0.0.1:3002/sign-in",
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        VERCEL: "1",
        LOCAL_DEMO: "1",
        SUPABASE_URL: "http://127.0.0.1:4010",
        SUPABASE_SERVICE_ROLE_KEY: "local-integration-service-key-only",
        LEARNER_USER_ID: "11111111-1111-4111-8111-111111111111",
        APP_PASSCODE: "local-test-passcode-only",
      },
    },
  ],
});
