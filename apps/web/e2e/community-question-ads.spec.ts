import { expect, test, type Page } from "@playwright/test";
import { log } from "./fixtures/blog-ads";
import { mockCommunityQuestionAds, QUESTION_ID, QUESTION_PATH } from "./fixtures/community-question-ads";

test.use({ serviceWorkers: "block" });
const boundary = (page: Page) => page.locator('[data-ad-placement="community.question.end"]');
const ad = (page: Page) => page.getByRole("complementary", { name: "Reklam", exact: true });

test("mevcut soru detayında cevapların altında tek reklam ve aynı yan panel gösterilir", async ({ page }, info) => {
  const api = await mockCommunityQuestionAds(page);
  await page.goto(QUESTION_PATH);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Çalışma düzenimi nasıl sürdürebilirim?");
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  await expect(page.getByText("Tekrarları nasıl düzenleyebilirim?", { exact: true })).toBeVisible();
  expect(api.feedRequests).toBe(0);
  expect(new Set(api.ads.placementCalls)).toEqual(new Set(["/v1/ads/placements/community.question.end"]));
  const query = new URL(api.ads.placementUrls[0]!).searchParams;
  expect(query.get("questionId")).toBe(QUESTION_ID);
  expect(query.get("contentRevision")).toBe("b".repeat(64));
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
  const answers = (await page.locator('section[aria-labelledby="answers-title"]').boundingBox())!;
  expect((await ad(page).boundingBox())!.y).toBeGreaterThanOrEqual(answers.y + answers.height);
  await page.screenshot({ path: info.outputPath("community-question-ad.png"), fullPage: true });
});

test("cevap yazılırken reklam kaldırılır, gönderme çalışır ve otomatik dönmez", async ({ page }) => {
  const api = await mockCommunityQuestionAds(page);
  await page.goto(QUESTION_PATH);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  const requests = api.ads.placementCalls.length;
  const field = page.locator("textarea").first();
  await field.fill("Ben de kısa tekrarlarla ilerliyorum.");
  await expect(boundary(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Cevapla", exact: true }).click();
  await expect(page.getByText("Ben de kısa tekrarlarla ilerliyorum.", { exact: true })).toBeVisible();
  expect(api.answerPosts).toBe(1);
  expect(api.ads.placementCalls).toHaveLength(requests);
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
});

test("notebook penceresi açılınca reklam kaldırılır", async ({ page }) => {
  await mockCommunityQuestionAds(page);
  await page.goto(QUESTION_PATH);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  await page.getByRole("button", { name: "Ben de takıldım", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(boundary(page)).toHaveCount(0);
});

test("metin alanına odaklanmadan dosya seçilince reklam kaldırılır", async ({ page }) => {
  await mockCommunityQuestionAds(page);
  await page.goto(QUESTION_PATH);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  await page.locator('input[type="file"]').setInputFiles({ name: "draft.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2xQAAAAASUVORK5CYII=", "base64") });
  await expect(boundary(page)).toHaveCount(0);
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
});

test("dar ekranda yalnız sığan boyut istenir", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockCommunityQuestionAds(page);
  await page.goto(QUESTION_PATH);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  expect(await page.evaluate(() => (window as unknown as { __displayDefinitions: { sizes: number[][] }[] }).__displayDefinitions[0]?.sizes)).toEqual([[250, 250]]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("emoji seçimi reklamı kaldırır", async ({ page }) => {
  await mockCommunityQuestionAds(page);
  await page.goto(QUESTION_PATH);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  await page.getByRole("button", { name: "Emoji ekle", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(boundary(page)).toHaveCount(0);
});

test("cevap kabul edilince değişen sürüm eski reklamı kaldırır", async ({ page }) => {
  const api = await mockCommunityQuestionAds(page);
  await page.goto(QUESTION_PATH);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  await page.getByRole("button", { name: "Kabul et", exact: true }).click();
  await expect.poll(() => api.revision).toBeNull();
  await expect(boundary(page)).toHaveCount(0);
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
});

test("uzun soruda reklam görünür alana yaklaşana kadar hazırlanmaz", async ({ page }) => {
  const api = await mockCommunityQuestionAds(page, { long: true });
  await page.goto(QUESTION_PATH);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(boundary(page)).toHaveCount(1);
  expect(api.ads.placementCalls).toHaveLength(0);
  expect(api.ads.scriptRequests).toBe(0);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
});

for (const mode of ["empty", "blocked", "denied"] as const) {
  test(`${mode}: reklam gelmese de cevaplar okunabilir`, async ({ page }) => {
    const api = await mockCommunityQuestionAds(page, { [mode]: true });
    await page.goto(QUESTION_PATH);
    await boundary(page).scrollIntoViewIfNeeded();
    await expect.poll(() => api.ads.placementCalls.length).toBeGreaterThan(0);
    await expect(ad(page)).toBeHidden();
    await expect(page.getByText("Küçük adımlarla ilerleyebilirsin.", { exact: true })).toBeVisible();
    if (mode === "denied") expect(api.ads.scriptRequests).toBe(0);
  });
}

for (const mode of ["reviewed", "legacy", "loadError"] as const) {
  test(`${mode}: onaysız veya eski/hatalı yanıtta Google hazırlanmaz`, async ({ page }) => {
    const api = await mockCommunityQuestionAds(page, mode === "reviewed" ? { reviewed: false } : { [mode]: true });
    await page.goto(QUESTION_PATH);
    if (mode === "loadError") await expect(page.getByText("Soru şu anda yüklenemiyor.", { exact: true })).toBeVisible();
    else await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(boundary(page)).toHaveCount(0);
    expect(api.ads.scriptRequests).toBe(0);
    expect(api.ads.placementCalls).toHaveLength(0);
    if (mode === "legacy") await expect.poll(() => api.feedRequests).toBeGreaterThan(0);
  });
}

test("abonelik değişince eski reklam kaldırılır", async ({ page }) => {
  const api = await mockCommunityQuestionAds(page);
  await page.goto(QUESTION_PATH);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  api.ads.premium = true;
  await page.evaluate(() => window.dispatchEvent(new Event("mentor:subscription-changed")));
  await expect(ad(page)).toBeHidden();
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
});

test("yazma başladığında bekleyen Google callback'i gösterim yapamaz", async ({ page }) => {
  const api = await mockCommunityQuestionAds(page);
  let release!: () => void;
  api.ads.scriptHold = new Promise<void>((resolve) => { release = resolve; });
  await page.goto(QUESTION_PATH);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect.poll(() => api.ads.scriptRequests).toBeGreaterThan(0);
  await page.locator("textarea").first().fill("Henüz paylaşmadığım taslak.");
  const script = page.waitForResponse("https://pagead2.googlesyndication.com/tag/js/gpt.js");
  release(); await script;
  await expect(boundary(page)).toHaveCount(0);
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(0);
});

test("İngilizce arayüzde reklam etiketi çevrilir", async ({ page }) => {
  await mockCommunityQuestionAds(page);
  await page.goto(`/en/community/question/${QUESTION_ID}`);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(page.getByRole("complementary", { name: "Advertisement", exact: true })).toContainText("Test inventory");
});
