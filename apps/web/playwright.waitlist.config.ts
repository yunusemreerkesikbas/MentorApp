import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * Invite-only signup (`waitlist.spec.ts`). The web reads `signupWaitlist` on the server, so the suite
 * owns its availability API (e2e/fixtures/waitlist-api.ts) and a production build pointed at it, in
 * its own dist dir: `NEXT_PUBLIC_API_URL` is baked in at build time, and a dev server gives false
 * reds on timing. Every run builds first (a few minutes); it never touches the ordinary `.next`.
 */
const executable = JSON.stringify(process.execPath);
const next = `${executable} node_modules/next/dist/bin/next`;
const waitlistApi = "http://localhost:3381";
process.env.QA_WAITLIST_API = waitlistApi;

export default defineConfig({
  ...base,
  testMatch: "waitlist.spec.ts",
  testIgnore: [],
  workers: 1,
  use: { ...base.use, baseURL: "http://localhost:3380" },
  outputDir: "test-results/waitlist",
  webServer: [
    {
      command: `${executable} --experimental-strip-types e2e/fixtures/waitlist-api.ts`,
      url: `${waitlistApi}/health`,
      reuseExistingServer: false,
    },
    {
      command: `${next} build && ${next} start --hostname localhost --port 3380`,
      url: "http://localhost:3380/sw.js",
      reuseExistingServer: false,
      timeout: 600_000,
      env: { NEXT_PUBLIC_API_URL: waitlistApi, WEB_QA_DIST_DIR: ".next/waitlist-build", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "" },
    },
  ],
});
