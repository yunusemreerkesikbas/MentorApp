import { expect, test, type Page } from "@playwright/test";
import { log } from "./fixtures/blog-ads";
import { ANNOUNCEMENT_ID, ANNOUNCEMENT_PATH, mockAnnouncementAds } from "./fixtures/community-announcement-ads";

test.use({ serviceWorkers: "block" });
const boundary = (page: Page) => page.locator('[data-ad-placement="community.announcement.end"]');
const ad = (page: Page) => page.getByRole("complementary", { name: "Reklam", exact: true });

test("mevcut duyuruda tüm görünür yorumlardan sonra tek reklam", async ({ page }, info) => {
  const api = await mockAnnouncementAds(page); await page.goto(ANNOUNCEMENT_PATH);
  await boundary(page).scrollIntoViewIfNeeded(); await expect(ad(page)).toContainText("Test inventory");
  await expect(page.getByText("Bu haftanın topluluk duyurusu.", { exact: true })).toBeVisible();
  expect(new Set(api.base.ads.placementCalls)).toEqual(new Set(["/v1/ads/placements/community.announcement.end"]));
  const query = new URL(api.base.ads.placementUrls[0]!).searchParams;
  expect(query.get("threadId")).toBe(ANNOUNCEMENT_ID); expect(query.get("contentRevision")).toBe("d".repeat(64)); expect(query.has("questionId")).toBe(false);
  expect(api.base.ads.scriptRequests).toBe(1); expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
  const comments = (await page.locator('section[aria-labelledby="comments-title"]').boundingBox())!;
  expect((await ad(page).boundingBox())!.y).toBeGreaterThanOrEqual(comments.y + comments.height);
  await page.screenshot({ path: info.outputPath("announcement-ad.png"), fullPage: true });
});

test("yorum yazma ve gönderme reklamı kaldırır, akış çalışır", async ({ page }) => {
  const api = await mockAnnouncementAds(page); await page.goto(ANNOUNCEMENT_PATH);
  await boundary(page).scrollIntoViewIfNeeded(); await expect(ad(page)).toContainText("Test inventory");
  await page.locator("textarea").first().fill("Yeni duyuru yorumum."); await expect(boundary(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Yorumla", exact: true }).click();
  await expect(page.getByText("Yeni duyuru yorumum.", { exact: true })).toBeVisible(); expect(api.commentPosts).toBe(1);
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
});

test("metin alanına odaklanmadan dosya seçme reklamı kaldırır", async ({ page }) => {
  await mockAnnouncementAds(page); await page.goto(ANNOUNCEMENT_PATH);
  await boundary(page).scrollIntoViewIfNeeded(); await expect(ad(page)).toContainText("Test inventory");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "draft.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2xQAAAAASUVORK5CYII=", "base64") });
  await expect(boundary(page)).toHaveCount(0);
});

test("yanıt penceresi açma reklamı kaldırır", async ({ page }) => {
  await mockAnnouncementAds(page, { nested: true }); await page.goto(ANNOUNCEMENT_PATH);
  await boundary(page).scrollIntoViewIfNeeded(); await expect(ad(page)).toContainText("Test inventory");
  await page.locator('section[aria-labelledby="comments-title"]').getByRole("button", { name: "Yanıtla", exact: true }).click();
  await expect(boundary(page)).toHaveCount(0);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("alt yorum detayına geçince eski reklam kaldırılır", async ({ page }) => {
  await mockAnnouncementAds(page, { nested: true }); await page.goto(ANNOUNCEMENT_PATH);
  await boundary(page).scrollIntoViewIfNeeded(); await expect(ad(page)).toContainText("Test inventory");
  await page.getByText("Görünür duyuru yorumu.", { exact: true }).click();
  await expect(page.getByText("Gizli alt yanıt açıldı.", { exact: true })).toBeVisible();
  await expect(boundary(page)).toHaveCount(0);
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
});

for (const mode of ["unreviewed", "chat", "privateRoom", "privateSidebar", "loadError"] as const) {
  test(`${mode}: Google hazırlanmaz`, async ({ page }) => {
    const api = await mockAnnouncementAds(page, { [mode]: true }); await page.goto(ANNOUNCEMENT_PATH);
    if (mode === "loadError") await expect(page.getByText("Duyuru şu anda yüklenemiyor.", { exact: true })).toBeVisible();
    else await expect(page.getByText("Bu haftanın topluluk duyurusu.", { exact: true })).toBeVisible();
    await expect(boundary(page)).toHaveCount(0); expect(api.base.ads.scriptRequests).toBe(0); expect(api.base.ads.placementCalls).toHaveLength(0);
  });
}

for (const mode of ["empty", "blocked", "denied"] as const) {
  test(`${mode}: reklam gelmese de duyuru okunabilir`, async ({ page }) => {
    const api = await mockAnnouncementAds(page, { [mode]: true }); await page.goto(ANNOUNCEMENT_PATH);
    await boundary(page).scrollIntoViewIfNeeded(); await expect.poll(() => api.base.ads.placementCalls.length).toBeGreaterThan(0);
    await expect(ad(page)).toBeHidden(); await expect(page.getByText("Görünür duyuru yorumu.", { exact: true })).toBeVisible();
  });
}

test("dar ekranda yalnız sığan boyut ve tek alan", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mockAnnouncementAds(page); await page.goto(ANNOUNCEMENT_PATH);
  await boundary(page).scrollIntoViewIfNeeded(); await expect(ad(page)).toContainText("Test inventory");
  expect(await page.evaluate(() => (window as unknown as { __displayDefinitions: { sizes: number[][] }[] }).__displayDefinitions[0]?.sizes)).toEqual([[250, 250]]);
  await expect(boundary(page)).toHaveCount(1); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("abonelik değişince eski reklam kaldırılır", async ({ page }) => {
  const api = await mockAnnouncementAds(page); await page.goto(ANNOUNCEMENT_PATH);
  await boundary(page).scrollIntoViewIfNeeded(); await expect(ad(page)).toContainText("Test inventory");
  api.base.ads.premium = true; await page.evaluate(() => window.dispatchEvent(new Event("mentor:subscription-changed")));
  await expect(ad(page)).toBeHidden(); expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
});

test("taslak başladığında bekleyen Google callback'i gösterim yapamaz", async ({ page }) => {
  const api = await mockAnnouncementAds(page); let release!: () => void;
  api.base.ads.scriptHold = new Promise<void>((resolve) => { release = resolve; });
  await page.goto(ANNOUNCEMENT_PATH); await boundary(page).scrollIntoViewIfNeeded(); await expect.poll(() => api.base.ads.scriptRequests).toBeGreaterThan(0);
  await page.locator("textarea").first().fill("Paylaşılmamış taslak."); await expect(boundary(page)).toHaveCount(0);
  const response = page.waitForResponse("https://pagead2.googlesyndication.com/tag/js/gpt.js"); release(); await response;
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(0);
});
