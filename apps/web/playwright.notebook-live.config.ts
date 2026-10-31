import { defineConfig } from "@playwright/test";

if (process.env.QA_NOTEBOOK_LIVE !== "1" || !process.env.TEST_DATABASE_URL) {
  throw new Error("Set QA_NOTEBOOK_LIVE=1 and the dedicated TEST_DATABASE_URL");
}
process.env.QA_NOTEBOOK_RUN_ID ??= Date.now().toString(36);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "economy-notebook-real-api.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [["list"]],
  outputDir: "test-results/notebook-live",
  use: {
    extraHTTPHeaders: { Origin: "http://localhost:3510" },
    baseURL: "http://localhost:3510",
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 375, height: 812 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    {
      command: `"${process.execPath}" ../api/node_modules/ts-node/dist/bin.js -T --project ../api/tsconfig.json ../api/test/fixtures/notebook-live-server.ts`,
      url: "http://localhost:3501/v1/app/availability",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `"${process.execPath}" node_modules/next/dist/bin/next dev --hostname localhost --port 3510`,
      url: "http://localhost:3510/sw.js",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: "http://localhost:3501",
        WEB_QA_DIST_DIR: ".next/notebook-live-qa",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
        NODE_ENV: "development",
      },
    },
  ],
});
