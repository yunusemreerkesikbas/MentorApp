import { expect, test } from "@playwright/test";
import { AD_CONSENT_KEY, ANALYTICS_KEY, ARTICLE_PATH, approachAd, log, mockBlogAds } from "./fixtures/blog-ads";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("mentor.analytics-consent.v1")) localStorage.setItem("mentor.analytics-consent.v1", "rejected");
  });
});

for (const legacyChoice of [null, "rejected", "accepted"] as const) {
  test(`reklam otomatik gösterilir; eski tercih etkisizdir (${legacyChoice})`, async ({ page }) => {
    if (legacyChoice) await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: AD_CONSENT_KEY, value: legacyChoice });
    if (legacyChoice === "accepted") await page.addInitScript((key) => localStorage.setItem(key, "accepted"), ANALYTICS_KEY);
    const api = await mockBlogAds(page);
    await page.goto(ARTICLE_PATH);
    await expect(page.getByRole("region", { name: "Reklam verisi", exact: true })).toHaveCount(0);
    await approachAd(page);
    await expect(page.getByRole("complementary", { name: "Reklam", exact: true })).toContainText("Test inventory");
    expect(api.scriptRequests).toBe(1);
    expect(await page.evaluate((key) => localStorage.getItem(key), ANALYTICS_KEY)).toBe(legacyChoice === "accepted" ? "accepted" : "rejected");
    expect(await page.evaluate((key) => localStorage.getItem(key), AD_CONSENT_KEY)).toBe(legacyChoice);
  });
}

test("tek reklam otomatik yüklenir, analitik reddi korunur ve sınırlı ayarlar önce uygulanır", async ({ page }) => {
  const api = await mockBlogAds(page);
  await page.goto(ARTICLE_PATH);
  await approachAd(page);
  const ad = page.getByRole("complementary", { name: "Reklam", exact: true });
  await expect(ad).toHaveCount(1);
  await expect(ad).toContainText("Test inventory");
  expect(api.scriptRequests).toBe(1);
  expect(api.placementCalls.length).toBeGreaterThanOrEqual(1);
  expect(new Set(api.placementCalls)).toEqual(new Set(["/v1/ads/public/placements/knowledge.article.end"]));
  expect((await log(page)).filter((event) => event === "display")).toHaveLength(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), ANALYTICS_KEY)).toBe("rejected");
  const events = await log(page);
  expect(events[0]).toContain('"limitedAds":true');
  expect(events[0]).toContain('"childDirectedTreatment":true');
  expect(events[1]).toBe("display");
  expect(await ad.locator("div[id]").evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(250);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("reklam bilgisi izin düğmesi sunmaz; yalnız analitik tercihi değiştirilebilir", async ({ page }) => {
  await mockBlogAds(page);
  await page.goto("/cerez-tercihleri");
  const ads = page.getByRole("region", { name: "Ücretsiz kullanımda reklamlar" });
  await expect(ads).toContainText("otomatik");
  await expect(ads.getByRole("button")).toHaveCount(0);
  const analytics = page.getByRole("region", { name: "İsteğe bağlı analitik" });
  await expect(analytics).toContainText("Reddedildi");
  await analytics.getByRole("button", { name: "Kabul et" }).click();
  await expect(analytics).toContainText("Kabul edildi");
  await analytics.getByRole("button", { name: "Reddet" }).click();
  await expect(analytics).toContainText("Reddedildi");
});

test("Free → Premium yenilemesi aktif slotu temizler ve yeni Google isteğini durdurur", async ({ page }) => {
  const api = await mockBlogAds(page, { authenticated: true });
  await page.goto(ARTICLE_PATH);
  await approachAd(page);
  await expect(page.getByRole("complementary", { name: "Reklam" })).toContainText("Test inventory");
  const originalCalls = api.placementCalls.length;
  api.premium = true;
  await page.evaluate(() => {
    const channel = new BroadcastChannel("mentor:subscription-changed");
    channel.postMessage("changed");
    channel.close();
  });
  await expect.poll(() => api.placementCalls.length).toBeGreaterThan(originalCalls);
  await expect(page.getByRole("complementary", { name: "Reklam" })).toBeHidden();
  expect((await log(page)).filter((event) => event === "display")).toHaveLength(1);
  expect(await log(page)).toContain("destroy");
  expect(api.scriptRequests).toBe(1);
});

test("analitik seçilmeden de reklam gösterilir; analitik reddi reklamı durdurmaz", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("mentor.analytics-consent.v1"));
  const api = await mockBlogAds(page);
  await page.goto(ARTICLE_PATH);
  await approachAd(page);
  await expect(page.getByRole("complementary", { name: "Reklam" })).toContainText("Test inventory");
  await page.getByRole("dialog", { name: "Analitik çerez tercihin" }).getByRole("button", { name: "Reddet" }).click();
  await expect(page.getByRole("complementary", { name: "Reklam" })).toContainText("Test inventory");
  expect(api.analyticsRequests).toBe(0);
  expect(api.scriptRequests).toBe(1);
  expect((await log(page)).filter((event) => event === "display")).toHaveLength(1);
});

test("hesap değişimi oturum sinyaliyle uygunluğu yeniden sorgular", async ({ page }) => {
  const api = await mockBlogAds(page, { authenticated: true });
  await page.goto(ARTICLE_PATH);
  await approachAd(page);
  await expect(page.getByRole("complementary", { name: "Reklam" })).toContainText("Test inventory");
  api.userId = "44444444-4444-4444-8444-444444444444";
  api.premium = true;
  let releaseRefresh!: () => void;
  api.refreshHold = new Promise<void>((resolve) => { releaseRefresh = resolve; });
  await page.evaluate(() => {
    const channel = new BroadcastChannel("mentor-auth-session-event-v1");
    channel.postMessage("session-changed");
    channel.close();
  });
  await expect.poll(() => api.refreshCalls).toBe(2);
  // Exercise a real unresolved account transition, with anonymous inventory still eligible.
  await page.waitForTimeout(300);
  expect(api.placementCalls.some((path) => path.includes("/public/"))).toBe(false);
  releaseRefresh();
  await expect.poll(() => api.placementCalls.filter((path) => !path.includes("/public/")).length).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("complementary", { name: "Reklam" })).toBeHidden();
  expect((await log(page)).filter((event) => event === "display")).toHaveLength(1);
});

test("geciken Google etiketi Premium geçişinden sonra reklam göstermez", async ({ page }) => {
  const api = await mockBlogAds(page, { authenticated: true });
  let releaseScript!: () => void;
  api.scriptHold = new Promise<void>((resolve) => { releaseScript = resolve; });
  await page.goto(ARTICLE_PATH);
  await approachAd(page);
  await expect.poll(() => api.scriptRequests).toBe(1);
  const originalCalls = api.placementCalls.length;
  api.premium = true;
  await page.evaluate(() => window.dispatchEvent(new Event("mentor:subscription-changed")));
  await expect.poll(() => api.placementCalls.length).toBeGreaterThan(originalCalls);
  await expect(page.getByRole("complementary", { name: "Reklam" })).toBeHidden();
  releaseScript();
  await expect.poll(async () => await log(page)).toEqual([]);
  await page.waitForFunction(() => Boolean(document.querySelector<HTMLScriptElement>('script[src="https://pagead2.googlesyndication.com/tag/js/gpt.js"]')?.dataset.loaded));
  expect((await log(page)).filter((event) => event === "display")).toHaveLength(0);
});

for (const mode of ["empty", "blocked", "denied"] as const) {
  test(`${mode}: reklam gelmezse makale okunur`, async ({ page }) => {
    const api = await mockBlogAds(page, { [mode]: true });
    await page.goto(ARTICLE_PATH);
    await approachAd(page);
    await expect.poll(() => api.placementCalls.length).toBeGreaterThanOrEqual(1);
    await expect(page.getByRole("complementary", { name: "Reklam" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Koçla konuşmak için giriş yap" })).toBeVisible();
    if (mode === "denied") expect(api.scriptRequests).toBe(0);
  });
}

test("İngilizce otomatik reklam ve bilgilendirme", async ({ page }) => {
  await mockBlogAds(page);
  await page.goto(`/en${ARTICLE_PATH}`);
  await page.getByRole("region", { name: "Want to explore this topic?" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("complementary", { name: "Advertisement", exact: true })).toContainText("Test inventory");
  await page.goto("/en/cookie-preferences");
  const ads = page.getByRole("region", { name: "Ads in free access" });
  await expect(ads).toContainText("automatically");
  await expect(ads.getByRole("button")).toHaveCount(0);
});
