import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import base from "./playwright.question-ads.config";

export default defineConfig({
  ...base, testMatch: "ads-readiness.spec.ts", timeout: 60_000,
  outputDir: ".next/ads-readiness-results",
  webServer: [
    ...(Array.isArray(base.webServer) ? base.webServer : []),
    {
      command: `${JSON.stringify(process.execPath)} node_modules/next/dist/bin/next dev --hostname localhost --port 3382`,
      cwd: resolve(process.cwd(), "../admin"), url: "http://localhost:3382/login", reuseExistingServer: false, timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: "http://localhost:3381/v1", ADMIN_QA_DIST_DIR: ".next/ads-readiness-build" },
    },
  ],
});
