import ordinary from "../../../apps/web/playwright.config";
export default { ...ordinary, testDir: ".", testIgnore: [], testMatch: "economy-off.browser.spec.ts", webServer: undefined, workers: 1, retries: 0,
  reporter: [["list"]], outputDir: "browser-results", use: { ...ordinary.use, baseURL: "http://localhost:3000" } };
