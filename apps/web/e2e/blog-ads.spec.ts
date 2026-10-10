import { expect, test } from "@playwright/test";
import { AD_CONSENT_KEY, ANALYTICS_KEY, ARTICLE_PATH, approachAd, log, mockBlogAds } from "./fixtures/blog-ads";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("mentor.analytics-consent.v1")) localStorage.setItem("mentor.analytics-consent.v1", "rejected");
  });
});

test("eski analitik izni reklam izni değildir; reddetmek okumayı engellemez", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mentor.analytics-consent.v1", "accepted"));
  await page.route("https://www.googletagmanager.com/gtag/js**", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
  const api = await mockBlogAds(page);
  await page.goto(ARTICLE_PATH);
  const choice = page.getByRole("region", { name: "Reklam verisi", exact: true });
  await expect(choice).toBeVisible();
  await approachAd(page);
  expect(api.scriptRequests).toBe(0);
  expect(api.placementCalls).toHaveLength(0);
  await choice.getByRole("button", { name: "Reddet" }).click();
  await expect(page.getByRole("dialog", { name: "Çerez tercihlerin" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "KPSS Başvuru Süreci", exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), ANALYTICS_KEY)).toBe("accepted");
  expect(await page.evaluate((key) => localStorage.getItem(key), AD_CONSENT_KEY)).toBe("rejected");
  expect(api.scriptRequests).toBe(0);
});

test("kabul sonrası tek reklam yüklenir, analitik reddi korunur ve sınırlı ayarlar önce uygulanır", async ({ page }) => {
  const api = await mockBlogAds(page);
  await page.goto(ARTICLE_PATH);
  await page.getByRole("region", { name: "Reklam verisi", exact: true }).getByRole("button", { name: "Kabul et" }).click();
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
  expect(await ad.locator("div[id]").evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("tercihler ayrı değişir; başka sekmede geri alma aktif reklamı kaldırıp belgeyi yeniler", async ({ page, context }) => {
  const api = await mockBlogAds(page);
  await page.goto(ARTICLE_PATH);
  await page.getByRole("region", { name: "Reklam verisi", exact: true }).getByRole("button", { name: "Kabul et" }).click();
  await approachAd(page);
  await expect(page.getByRole("complementary", { name: "Reklam" })).toContainText("Test inventory");
  const settings = await context.newPage();
  await mockBlogAds(settings);
  await settings.goto("/cerez-tercihleri");
  const ads = settings.getByRole("region", { name: "İsteğe bağlı reklam verisi" });
  await expect(ads).toContainText("Kabul edildi");
  await expect(settings.getByRole("region", { name: "İsteğe bağlı analitik" })).toContainText("Reddedildi");
  const reload = page.waitForEvent("load");
  await ads.getByRole("button", { name: "Reddet" }).click();
  await reload;
  expect(await page.evaluate(() => sessionStorage.getItem("test-ad-destroyed"))).toBe("true");
  await approachAd(page);
  await expect(page.getByRole("complementary", { name: "Reklam" })).toHaveCount(0);
  expect(api.scriptRequests).toBe(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), ANALYTICS_KEY)).toBe("rejected");
});

test("Free → Premium yenilemesi aktif slotu temizler ve yeni Google isteğini durdurur", async ({ page }) => {
  const api = await mockBlogAds(page, { authenticated: true });
  await page.goto(ARTICLE_PATH);
  await page.getByRole("region", { name: "Reklam verisi", exact: true }).getByRole("button", { name: "Kabul et" }).click();
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

test("geri alma kaydedilemezse reklam durur; başarılı tekrar belgeyi yeniler", async ({ page }) => {
  await mockBlogAds(page);
  await page.goto(ARTICLE_PATH);
  await page.getByRole("region", { name: "Reklam verisi", exact: true }).getByRole("button", { name: "Kabul et" }).click();
  await approachAd(page);
  await expect(page.getByRole("complementary", { name: "Reklam" })).toContainText("Test inventory");
  // Client navigation preserves the loaded GPT runtime in this document.
  await page.getByRole("link", { name: "Çerez tercihleri", exact: true }).click();
  const ads = page.getByRole("region", { name: "İsteğe bağlı reklam verisi" });
  await expect(ads).toContainText("Kabul edildi");
  await page.evaluate(() => {
    const save = Storage.prototype.setItem;
    let failOnce = true;
    Storage.prototype.setItem = function(key, value) {
      if (key === "mentor.advertising-consent.v1" && failOnce) { failOnce = false; throw new Error("Storage blocked"); } // gitleaks:allow -- public storage key
      return save.call(this, key, value);
    };
    (window as unknown as { __documentMarker: string }).__documentMarker = "loaded";
  });
  await ads.getByRole("button", { name: "Reddet" }).click();
  await expect(ads.getByRole("alert")).toContainText("Tercihin kaydedilemedi");
  expect(await page.evaluate((key) => localStorage.getItem(key), AD_CONSENT_KEY)).toBe("accepted");
  const reload = page.waitForEvent("load");
  await ads.getByRole("button", { name: "Reddet" }).click();
  await reload;
  expect(await page.evaluate((key) => localStorage.getItem(key), AD_CONSENT_KEY)).toBe("rejected");
  expect(await page.evaluate(() => (window as unknown as { __documentMarker?: string }).__documentMarker)).toBeUndefined();
  await expect(page.getByRole("region", { name: "İsteğe bağlı reklam verisi" })).toContainText("Reddedildi");
});

test("hesap değişimi oturum sinyaliyle uygunluğu yeniden sorgular", async ({ page }) => {
  const api = await mockBlogAds(page, { authenticated: true });
  await page.goto(ARTICLE_PATH);
  await page.getByRole("region", { name: "Reklam verisi", exact: true }).getByRole("button", { name: "Kabul et" }).click();
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

for (const mode of ["empty", "blocked", "denied"] as const) {
  test(`${mode}: reklam gelmezse makale okunur`, async ({ page }) => {
    const api = await mockBlogAds(page, { [mode]: true });
    await page.goto(ARTICLE_PATH);
    await page.getByRole("region", { name: "Reklam verisi", exact: true }).getByRole("button", { name: "Kabul et" }).click();
    await approachAd(page);
    await expect.poll(() => api.placementCalls.length).toBeGreaterThanOrEqual(1);
    await expect(page.getByRole("complementary", { name: "Reklam" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Koçla konuşmak için giriş yap" })).toBeVisible();
    if (mode === "denied") expect(api.scriptRequests).toBe(0);
  });
}

test("İngilizce reklam tercihi bağımsızdır", async ({ page }) => {
  await mockBlogAds(page);
  await page.goto(`/en${ARTICLE_PATH}`);
  await expect(page.getByRole("region", { name: "Advertising data" })).toBeVisible();
  await page.getByRole("region", { name: "Advertising data" }).getByRole("button", { name: "Reject" }).click();
  await expect(page.getByRole("dialog", { name: "Your cookie choices" })).toHaveCount(0);
});
