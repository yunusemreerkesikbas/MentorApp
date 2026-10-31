import { defineConfig } from "@playwright/test";
import ordinary from "./playwright.config";

/** Runs after ordinary tests; owns one synthetic article in the explicit loopback test DB. */
export default defineConfig(ordinary, {
  testIgnore: [],
  testMatch: "**/bounded-media.spec.ts",
  workers: 1,
  retries: 0,
  outputDir: "test-results/bounded-media",
});
