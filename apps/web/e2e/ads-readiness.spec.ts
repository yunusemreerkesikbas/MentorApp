import { expect, test, type Page } from "@playwright/test";
import type { AdReadinessReport } from "@mentor/types";
import { mockBlogAds } from "./fixtures/blog-ads";

test.use({ serviceWorkers: "block" });
const ids = ["knowledge.article.end", "knowledge.index", "forum.question.end", "community.question.end", "community.announcement.end", "community.overview", "notebooks.overview", "vision.overview"] as const;

async function mockAdmin(page: Page) {
  const state = { reports: 0, writes: 0, failed: false, globalEnabled: false, google: 0 };
  await page.route(/https:\/\/.*(?:googlesyndication|doubleclick|googletagmanager)\./, (route) => { state.google++; return route.abort(); });
  await page.route("http://localhost:3381/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body),
      headers: { "access-control-allow-origin": "http://localhost:3382", "access-control-allow-credentials": "true", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,PATCH,OPTIONS" } });
    if (route.request().method() === "OPTIONS") return json(null, 204);
    if (path === "/v1/auth/admin/refresh") return json({ accessToken: "test-only-owner", user: { id: "owner", displayName: "QA admin", roles: ["SUPER_ADMIN"] } });
    if (path === "/v1/admin/ads/readiness") {
      state.reports++;
      if (state.failed) return json({ message: "Unavailable" }, 503);
      const report: AdReadinessReport = {
        checkedAt: new Date().toISOString(), environment: "development", siteOrigin: "https://example.test", localTestActive: true,
        globalEnabled: state.globalEnabled, displayEnabled: false, allowedCountries: ["TR"], externalVerification: "NOT_CHECKED",
        placements: ids.map((id) => ({ id, enabled: false, unitSource: "NONE", unitStatus: "MISSING", authenticatedOnly: !id.startsWith("knowledge") && !id.startsWith("forum"),
          contentCheck: id.endsWith("overview") ? "PROFILE" : "PUBLISHED_CONTENT", issues: ["PLACEMENT_DISABLED", "UNIT_MISSING"] })),
      };
      return json(report);
    }
    if (path.startsWith("/v1/admin/config")) {
      if (route.request().method() === "PATCH") { state.writes++; state.globalEnabled = route.request().postDataJSON().value === true; }
      return json([{ key: "ads.enabled", value: state.globalEnabled, type: "boolean", category: "ads", description: "Ads", sensitive: false }]);
    }
    return json([]);
  });
  return state;
}

test("existing settings show eight closed placements without Google traffic or writes", async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto("http://localhost:3382/config");
  const table = page.getByRole("table", { name: "Reklam alanlarının yapılandırma durumu" });
  await expect(table.getByRole("row")).toHaveCount(9);
  await expect(table).toContainText("Defterlerim");
  await expect(table).toContainText("Hedef Panosu");
  await expect(page.getByRole("note")).toContainText("yayıncı geliri değildir");
  await expect(page.getByRole("link", { name: "ads.txt dosyasını aç" })).toHaveAttribute("href", "https://example.test/ads.txt");
  const calls = state.reports;
  await page.getByRole("button", { name: "Özeti yenile" }).click();
  await expect.poll(() => state.reports).toBeGreaterThan(calls);
  await expect(table.getByRole("row")).toHaveCount(9);
  expect(state.google).toBe(0); expect(state.writes).toBe(0);
});

test("failed refresh removes the old report and retry recovers", async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto("http://localhost:3382/config");
  await expect(page.getByRole("table")).toBeVisible();
  state.failed = true;
  await page.getByRole("button", { name: "Özeti yenile" }).click();
  await expect(page.getByRole("status")).toContainText("Hazırlık özeti alınamadı");
  await expect(page.getByRole("table")).toHaveCount(0);
  state.failed = false;
  await page.getByRole("button", { name: "Özeti yenile" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  expect(state.writes).toBe(0);
});

test("successful existing config edit refreshes the readiness summary", async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto("http://localhost:3382/config");
  await expect(page.getByRole("table")).toBeVisible();
  const calls = state.reports;
  // The controlled input changes only after the asynchronous save returns.
  await page.getByRole("switch", { name: "ads.enabled", exact: true }).click();
  await expect.poll(() => state.writes).toBe(1);
  await expect.poll(() => state.reports).toBeGreaterThan(calls);
  await expect(page.getByText("Genel reklam anahtarı: Açık", { exact: true })).toBeVisible();
  await expect(page.getByRole("switch", { name: "ads.enabled", exact: true })).toBeChecked();
  expect(state.google).toBe(0);
});

for (const locale of ["tr", "en"]) {
  test(`advertising disclosure covers gated screens and retains analytics choice (${locale})`, async ({ page }) => {
    const api = await mockBlogAds(page);
    await page.goto(`http://localhost:3370/${locale === "tr" ? "cerez-tercihleri" : "en/cookie-preferences"}`);
    const ads = page.getByRole("region", { name: locale === "tr" ? "Ücretsiz kullanımda reklamlar" : "Ads in free access" });
    await expect(ads).toContainText(locale === "tr" ? "Defterlerim ve Hedef Panosu" : "Notebooks and Vision Board");
    await expect(ads).toContainText(locale === "tr" ? "editörleri" : "editors");
    await expect(ads.getByRole("button")).toHaveCount(0);
    const analytics = page.getByRole("region", { name: locale === "tr" ? "İsteğe bağlı analitik" : "Optional analytics" });
    await expect(analytics.getByRole("button")).toHaveCount(2);
    expect(api.scriptRequests).toBe(0);
  });
}
