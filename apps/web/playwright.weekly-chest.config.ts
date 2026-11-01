import { defineConfig } from "@playwright/test";

// Own dev server and dist dir, so it never collides with a running `pnpm dev` or another QA suite.
process.env.PLAYWRIGHT_BASE_URL = "http://localhost:3512";
process.env.QA_STAGE2_API_URL = "http://localhost:3502/v1";

export default defineConfig({
  testDir: "./e2e", testMatch: "weekly-chest.spec.ts",
  workers: 1, retries: 0, timeout: 90_000, reporter: "list",
  outputDir: "test-results/weekly-chest",
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL, browserName: "chromium", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "mobile", use: { viewport: { width: 375, height: 812 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --hostname localhost --port 3512`,
    url: "http://localhost:3512/sw.js", reuseExistingServer: false, timeout: 180_000,
    env: { NEXT_PUBLIC_API_URL: "http://localhost:3502", WEB_QA_DIST_DIR: ".next/weekly-chest-qa", NODE_ENV: "development" },
  },
});
