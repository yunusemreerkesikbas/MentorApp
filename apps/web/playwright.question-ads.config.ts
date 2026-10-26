import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

process.env.QA_STAGE2_API_URL = "http://localhost:3371/v1";
const executable = JSON.stringify(process.execPath);
export default defineConfig({
  ...base,
  testMatch: "question-ads.spec.ts",
  testIgnore: [],
  workers: 1,
  use: { ...base.use, baseURL: "http://localhost:3370" },
  outputDir: ".next/question-ads-results",
  webServer: [
    { command: `${executable} --experimental-strip-types e2e/fixtures/public-question-api.ts`, url: "http://localhost:3371/health", reuseExistingServer: false },
    {
      command: `${executable} node_modules/next/dist/bin/next dev --hostname localhost --port 3370`,
      url: "http://localhost:3370/sw.js", reuseExistingServer: false, timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: "http://localhost:3371", WEB_QA_DIST_DIR: ".next/question-ads-build" },
    },
  ],
});
