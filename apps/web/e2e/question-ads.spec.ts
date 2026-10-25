import { expect, test, type Page } from "@playwright/test";
import { log, mockBlogAds } from "./fixtures/blog-ads";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mentor.analytics-consent.v1", "rejected"));
});
const questionId = "11111111-1111-4111-8111-111111111111";
const path = `/forum/soru/${questionId}`;
const boundary = (page: Page) => page.locator('[data-ad-placement="forum.question.end"]');
const ad = (page: Page) => page.getByRole("complementary", { name: "Reklam", exact: true });

test("reklam tüm cevapların sonunda tek alan olarak gösterilir", async ({ page }, info) => {
  const api = await mockBlogAds(page);
  await page.goto(path);
  await expect(boundary(page)).toHaveCount(1);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  const lastAnswer = (await page.locator('[id^="answer-"]').last().boundingBox())!;
  const slot = (await ad(page).boundingBox())!;
  expect(slot.y).toBeGreaterThanOrEqual(lastAnswer.y + lastAnswer.height);
  // Strict Mode may replay eligibility; only one Google display is allowed below.
  expect(new Set(api.placementCalls)).toEqual(new Set(["/v1/ads/public/placements/forum.question.end"]));
  const params = new URL(api.placementUrls[0]!).searchParams;
  expect(params.get("questionId")).toBe(questionId);
  expect(params.get("contentRevision")).toBe("a".repeat(64));
  expect(params.has("examType")).toBe(false);
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
  await page.screenshot({ path: info.outputPath("question-ad.png"), fullPage: true });
});

test("320px ekranda sığan reklam boyutları istenir", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockBlogAds(page);
  await page.goto(path);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  const definitions = await page.evaluate(() => (window as unknown as { __displayDefinitions: { sizes: number[][] }[] }).__displayDefinitions);
  expect(definitions).toHaveLength(1);
  expect(definitions[0]?.sizes).toEqual([[250, 250]]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("abonelik değişince eski reklam kaldırılır", async ({ page }) => {
  const api = await mockBlogAds(page, { authenticated: true });
  await page.goto(path);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  expect(new Set(api.placementCalls)).toEqual(new Set(["/v1/ads/placements/forum.question.end"]));
  api.premium = true;
  await page.evaluate(() => window.dispatchEvent(new Event("mentor:subscription-changed")));
  await expect(ad(page)).toBeHidden();
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
});

for (const mode of ["empty", "blocked", "denied"] as const) {
  test(`${mode}: soru ve cevap okunabilir kalır`, async ({ page }) => {
    const api = await mockBlogAds(page, { [mode]: true });
    await page.goto(path);
    await boundary(page).scrollIntoViewIfNeeded();
    await expect.poll(() => api.placementCalls.length).toBeGreaterThan(0);
    await expect(ad(page)).toBeHidden();
    await expect(page.getByText("Küçük ve sürdürülebilir bir hedefle başlayabilirsin.", { exact: true })).toBeVisible();
    if (mode === "denied") expect(api.scriptRequests).toBe(0);
  });
}

test("İngilizce sayfada reklam etiketi çevrilir", async ({ page }) => {
  await mockBlogAds(page);
  await page.goto(`/en/forum/question/${questionId}`);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(page.getByRole("complementary", { name: "Advertisement", exact: true })).toContainText("Test inventory");
});

test("yayında olmayan soruda reklam hazırlanmaz", async ({ page }) => {
  const api = await mockBlogAds(page);
  await page.goto("/forum/soru/33333333-3333-4333-8333-333333333333");
  await expect(boundary(page)).toHaveCount(0);
  expect(api.scriptRequests).toBe(0);
  expect(api.placementCalls).toHaveLength(0);
});

test("uzun soruda reklam görünür alana yaklaşana kadar istek yapılmaz", async ({ page }) => {
  const api = await mockBlogAds(page);
  await page.goto("/forum/soru/44444444-4444-4444-8444-444444444444");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect.poll(() => api.refreshCalls).toBeGreaterThan(0);
  expect(api.placementCalls).toHaveLength(0);
  expect(api.scriptRequests).toBe(0);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
});

test("uygunluk servisi hata verdiğinde içerik okunabilir kalır", async ({ page }) => {
  const api = await mockBlogAds(page);
  let policyRequests = 0;
  await page.route("**/v1/ads/**", (route) => { policyRequests++; return route.fulfill({ status: 503, contentType: "application/json",
    headers: { "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3370", "access-control-allow-credentials": "true" },
    body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
  }); });
  await page.goto(path);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect.poll(() => policyRequests).toBeGreaterThan(0);
  await expect(ad(page)).toBeHidden();
  await expect(page.getByText("Küçük ve sürdürülebilir bir hedefle başlayabilirsin.", { exact: true })).toBeVisible();
  expect(api.scriptRequests).toBe(0);
});
