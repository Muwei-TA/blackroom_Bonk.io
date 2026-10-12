import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  workers: 1,
  use: {
    launchOptions: { executablePath: process.env.BROWSER_EXECUTABLE },
    baseURL: process.env.BASE_URL ?? "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 960 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: false,
        timeout: 30000,
      },
});
