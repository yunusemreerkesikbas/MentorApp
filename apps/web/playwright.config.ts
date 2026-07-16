import { defineConfig } from "@playwright/test";

const nodeExecutable = JSON.stringify(process.execPath);

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL: "http://localhost:3100",
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile-chromium", use: { viewport: { width: 375, height: 812 } } },
    { name: "desktop-chromium", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `${nodeExecutable} node_modules/next/dist/bin/next start --hostname localhost --port 3100`,
    url: "http://localhost:3100/sw.js",
    reuseExistingServer: !process.env.CI,
  },
});
