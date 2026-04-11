import { defineConfig } from "@playwright/test";

const explicitBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = explicitBaseURL ?? "http://127.0.0.1:3117";
const port = new URL(baseURL).port || "3117";
const hostname = new URL(baseURL).hostname;
const shouldLaunchWebServer =
  !explicitBaseURL &&
  (hostname === "127.0.0.1" || hostname === "localhost");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  workers: 1,
  use: {
    baseURL,
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE || undefined,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: shouldLaunchWebServer
    ? {
        command: "npm run dev",
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          NEXTAUTH_URL: baseURL,
          PORT: port,
        },
      }
    : undefined,
});
