import { defineConfig } from "@playwright/test";

process.env.PLAYWRIGHT_BASE_URL = "http://localhost:3511";
process.env.QA_STAGE2_API_URL = "http://localhost:3501/v1";

export default defineConfig({
  testDir: "./e2e", testMatch: "panel.spec.ts", grep: /recap banner/,
  workers: 1, retries: 0, timeout: 60_000, reporter: "list",
  outputDir: "test-results/recap-banner",
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL, browserName: "chromium", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "mobile", use: { viewport: { width: 375, height: 812 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --hostname localhost --port 3511`,
    url: "http://localhost:3511/sw.js", reuseExistingServer: false, timeout: 120_000,
    env: { NEXT_PUBLIC_API_URL: "http://localhost:3501", WEB_QA_DIST_DIR: ".next/recap-banner-qa", NODE_ENV: "development" },
  },
});
