import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Browser routes mock actions; the existing public fixture supplies a deterministic SSR snapshot.
process.env.QA_STAGE2_API_URL = "http://localhost:3521/v1";
process.env.PLAYWRIGHT_BASE_URL = "http://localhost:3520";
const executable = JSON.stringify(process.execPath);

export default defineConfig({
  ...base,
  testMatch: ["weekly-analysis-access.spec.ts", "weekly-recap.spec.ts"],
  testIgnore: [],
  workers: 1,
  retries: 0,
  use: { ...base.use, baseURL: "http://localhost:3520" },
  outputDir: "test-results/weekly-analysis",
  webServer: [
    {
      command: `${executable} --experimental-strip-types e2e/fixtures/public-question-api.ts`,
      url: "http://localhost:3521/health",
      reuseExistingServer: false,
      env: { QA_QUESTION_API_PORT: "3521" },
    },
    {
      command: `${executable} node_modules/next/dist/bin/next dev --hostname localhost --port 3520`,
      url: "http://localhost:3520/sw.js",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: "http://localhost:3521",
        WEB_QA_DIST_DIR: ".next/weekly-access-qa",
      },
    },
  ],
});
