import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.FORDMS_E2E_PORT ?? 3100);
const baseURL = process.env.FORDMS_E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["json", { outputFile: "tests/e2e/results/report.json" }]],
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", viewport: { width: 1440, height: 980 } },
  webServer: process.env.FORDMS_E2E_BASE_URL ? undefined : {
    command: `npx next start -p ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { FORDMS_TEST_AUTH: "1", NEXTAUTH_URL: baseURL },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
