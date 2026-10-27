import { expect, test, type Page } from "@playwright/test";
import { mockDiscoveryAds } from "./fixtures/community-overview-ads";
import { log } from "./fixtures/blog-ads";
import { QUESTION_PATH } from "./fixtures/community-question-ads";

test.use({ serviceWorkers: "block" });
const boundary = (page: Page) => page.locator('[data-ad-placement="community.overview"]');
const ad = (page: Page) => page.getByRole("complementary", { name: "Reklam", exact: true });

test("mevcut Keşfet ekranında sağ sütunun sonunda tek reklam", async ({ page }, info) => {
  const api = await mockDiscoveryAds(page);
  await page.goto("/topluluk");
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  await expect(page.getByText("Toplulukta birlikte ilerliyoruz", { exact: true })).toBeVisible();
  expect(api.state.feedRequests).toBe(0);
  expect(new Set(api.state.ads.placementCalls)).toEqual(new Set(["/v1/ads/placements/community.overview"]));
  expect(api.state.ads.scriptRequests).toBe(1);
  const query = new URL(api.state.ads.placementUrls[0]!).searchParams;
  expect(query.get("contentRevision")).toBe("c".repeat(64)); expect(query.has("questionId")).toBe(false);
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
  const supporters = await page.locator('section[aria-labelledby="hub-supporters-title"]').boundingBox();
  expect((await ad(page).boundingBox())!.y).toBeGreaterThanOrEqual(supporters!.y + supporters!.height);
  await page.screenshot({ path: info.outputPath("community-overview-ad.png"), fullPage: true });
});

for (const mode of ["closed", "history", "buddy", "buddyError", "hubError"] as const) {
  test(`${mode}: özel veya doğrulanamayan görünümde Google hazırlanmaz`, async ({ page }) => {
    const api = await mockDiscoveryAds(page, { [mode]: true });
    await page.goto("/topluluk");
    if (mode === "hubError") await expect(page.getByText("Topluluk şu anda yüklenemiyor.", { exact: true })).toBeVisible();
    else await expect(page.getByText("Toplulukta birlikte ilerliyoruz", { exact: true })).toBeVisible();
    if (mode === "buddy") await expect(page.getByText("Özel Yol Arkadaşım", { exact: true })).toBeVisible();
    await expect.poll(() => api.buddyRequests).toBeGreaterThan(0);
    await expect(boundary(page)).toHaveCount(0);
    expect(api.state.ads.scriptRequests).toBe(0); expect(api.state.ads.placementCalls).toHaveLength(0);
  });
}

test("yol arkadaşı kontrolü tamamlanmadan reklam hazırlanmaz", async ({ page }) => {
  const api = await mockDiscoveryAds(page); let release!: () => void;
  api.buddyHold = new Promise<void>((resolve) => { release = resolve; });
  await page.goto("/topluluk");
  await expect(page.getByText("Toplulukta birlikte ilerliyoruz", { exact: true })).toBeVisible();
  await expect.poll(() => api.buddyRequests).toBeGreaterThan(0);
  expect(api.state.ads.placementCalls).toHaveLength(0);
  release(); await boundary(page).scrollIntoViewIfNeeded(); await expect(ad(page)).toContainText("Test inventory");
});

for (const mode of ["empty", "blocked", "denied"] as const) {
  test(`${mode}: reklam yokken Keşfet kullanılabilir`, async ({ page }) => {
    const api = await mockDiscoveryAds(page, { [mode]: true }); await page.goto("/topluluk");
    await boundary(page).scrollIntoViewIfNeeded();
    await expect.poll(() => api.state.ads.placementCalls.length).toBeGreaterThan(0);
    await expect(ad(page)).toBeHidden();
    await expect(page.getByText("Toplulukta birlikte ilerliyoruz", { exact: true })).toBeVisible();
  });
}

test("dar ekranda tek DOM alanı ve yalnız sığan boyut", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockDiscoveryAds(page); await page.goto("/topluluk");
  await boundary(page).scrollIntoViewIfNeeded(); await expect(ad(page)).toContainText("Test inventory");
  expect(await page.evaluate(() => (window as unknown as { __displayDefinitions: { sizes: number[][] }[] }).__displayDefinitions[0]?.sizes)).toEqual([[250, 250]]);
  await expect(boundary(page)).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("oda değişikliği reklamı kaldırır ve kendiliğinden dönmez", async ({ page }) => {
  await mockDiscoveryAds(page); await page.goto("/topluluk");
  await boundary(page).scrollIntoViewIfNeeded(); await expect(ad(page)).toContainText("Test inventory");
  await page.evaluate(() => window.dispatchEvent(new Event("community:zones-changed")));
  await expect(boundary(page)).toHaveCount(0);
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
});

test("abonelik değişince eski reklam kaldırılır", async ({ page }) => {
  const api = await mockDiscoveryAds(page); await page.goto("/topluluk");
  await boundary(page).scrollIntoViewIfNeeded(); await expect(ad(page)).toContainText("Test inventory");
  api.state.ads.premium = true; await page.evaluate(() => window.dispatchEvent(new Event("mentor:subscription-changed")));
  await expect(ad(page)).toBeHidden();
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(1);
});

test("kalıcı yan menüdeki eski özel oda Keşfet reklamını engeller", async ({ page }) => {
  const api = await mockDiscoveryAds(page, { reviewed: false });
  let privateMembership = true;
  await page.route("**/v1/forum/zones?**", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: {
    "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3370", "access-control-allow-credentials": "true",
  }, body: JSON.stringify({ items: [api.state.zone, ...(privateMembership ? [{ ...api.state.zone,
    id: "99999999-9999-4999-8999-999999999999", title: "Eski özel oda", slug: "eski-ozel", visibility: "PRIVATE" }] : [])],
    total: privateMembership ? 2 : 1, page: 1, pageSize: 100 }) }));
  await page.goto(QUESTION_PATH);
  await expect(page.getByText("Eski özel oda", { exact: true }).first()).toBeAttached();
  privateMembership = false;
  await page.locator('main a[href="/topluluk"]').first().click();
  await expect(page.getByText("Toplulukta birlikte ilerliyoruz", { exact: true })).toBeVisible();
  await expect(page.getByText("Eski özel oda", { exact: true }).first()).toBeAttached();
  await expect(boundary(page)).toHaveCount(0);
  expect(api.state.ads.placementCalls).toHaveLength(0); expect(api.state.ads.scriptRequests).toBe(0);
});

test("arama açılınca bekleyen reklam iptal edilir", async ({ page }) => {
  const api = await mockDiscoveryAds(page); let release!: () => void;
  api.state.ads.scriptHold = new Promise<void>((resolve) => { release = resolve; });
  await page.goto("/topluluk"); await boundary(page).scrollIntoViewIfNeeded();
  await expect.poll(() => api.state.ads.scriptRequests).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Toplulukta ara", exact: true }).click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await expect(boundary(page)).toHaveCount(0);
  const script = page.waitForResponse("https://pagead2.googlesyndication.com/tag/js/gpt.js");
  release(); await script;
  expect((await log(page)).filter((entry) => entry === "display")).toHaveLength(0);
});
