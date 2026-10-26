import { expect, test, type Page } from "@playwright/test";
import { log, mockBlogAds } from "./fixtures/blog-ads";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mentor.analytics-consent.v1", "rejected"));
});

const boundary = (page: Page) => page.locator('[data-ad-placement="knowledge.index"]');
const ad = (page: Page) => page.getByRole("complementary", { name: "Reklam", exact: true });

test("blog listesinde tek reklam, masaüstünde takvim altında ve mobilde liste sonunda görünür", async ({ page }, testInfo) => {
  const api = await mockBlogAds(page);
  await page.goto("/blog");
  await expect(boundary(page)).toHaveCount(1);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  expect(new Set(api.placementCalls)).toEqual(new Set(["/v1/ads/public/placements/knowledge.index"]));
  expect(api.placementUrls.every((url) => new URL(url).searchParams.get("family") === "KPSS")).toBe(true);
  expect((await log(page)).filter((item) => item === "display")).toHaveLength(1);
  const slot = (await boundary(page).boundingBox())!;
  const calendar = (await page.getByTestId("blog-calendar").boundingBox())!;
  if ((page.viewportSize()?.width ?? 0) >= 1280) expect(slot.y).toBeGreaterThanOrEqual(calendar.y + calendar.height);
  else expect(calendar.y).toBeGreaterThanOrEqual(slot.y + slot.height);
  expect(await page.getByTestId("blog-sidebar").evaluate((node) => getComputedStyle(node).position)).toBe("static");
  await page.screenshot({ path: testInfo.outputPath("blog-index-ad.png"), fullPage: true });
});

test("boş sayfada reklam alanı veya Google isteği oluşmaz", async ({ page }) => {
  const api = await mockBlogAds(page);
  await page.goto("/blog?page=999999");
  await expect(page.getByRole("heading", { name: "Bu sayfada yazı yok.", exact: true })).toBeVisible();
  await expect(boundary(page)).toHaveCount(0);
  expect(api.placementCalls).toHaveLength(0);
  expect(api.scriptRequests).toBe(0);
});

test("kategori değişince yeni liste bağlamı gönderilir", async ({ page }) => {
  const api = await mockBlogAds(page);
  await page.goto("/blog");
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  await page.getByRole("tab", { name: "Sınav süreci", exact: true }).click();
  await expect(page).toHaveURL(/category=EXAM_PROCESS/);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect.poll(() => api.placementUrls.some((url) => new URL(url).searchParams.get("category") === "EXAM_PROCESS")).toBe(true);
  await expect(boundary(page)).toHaveCount(1);
});

test("Free ve Premium için oturumlu politika kullanılır", async ({ page }) => {
  const api = await mockBlogAds(page, { authenticated: true });
  await page.goto("/blog");
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  expect(api.placementCalls.every((path) => path === "/v1/ads/placements/knowledge.index")).toBe(true);
  api.premium = true;
  await page.evaluate(() => window.dispatchEvent(new Event("mentor:subscription-changed")));
  await expect(ad(page)).toBeHidden();
  expect((await log(page)).filter((item) => item === "display")).toHaveLength(1);
});

for (const mode of ["empty", "blocked", "denied"] as const) {
  test(`${mode}: reklam gelmese de blog listesi okunur`, async ({ page }) => {
    const api = await mockBlogAds(page, { [mode]: true });
    await page.goto("/blog");
    await boundary(page).scrollIntoViewIfNeeded();
    await expect.poll(() => api.placementCalls.length).toBeGreaterThan(0);
    await expect(ad(page)).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Blog", exact: true })).toBeVisible();
    if (mode === "denied") expect(api.scriptRequests).toBe(0);
  });
}

test("İngilizce blog listesinde reklam etiketi çevrilir", async ({ page }) => {
  await mockBlogAds(page);
  await page.goto("/en/blog");
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(page.getByRole("complementary", { name: "Advertisement", exact: true })).toContainText("Test inventory");
});
