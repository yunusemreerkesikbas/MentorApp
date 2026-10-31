import { defineConfig } from "@playwright/test";
import ordinary from "./playwright.config";

/** Run only after the dedicated API fixture has been restarted with core-trial flags. */
export default defineConfig(ordinary, {
  testIgnore: [],
  testMatch: "**/core-trial.spec.ts",
  workers: 1,
  retries: 0,
  outputDir: "test-results/core-trial",
});
