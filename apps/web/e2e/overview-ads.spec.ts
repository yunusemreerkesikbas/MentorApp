import { expect, test, type Page } from "@playwright/test";
import { log } from "./fixtures/blog-ads";
import { mockOverviewAds, NOTEBOOK_ID } from "./fixtures/overview-ads";

test.use({ serviceWorkers: "block" });

const boundary = (page: Page) => page.locator('[data-ad-placement]');
const ad = (page: Page) => page.getByRole("complementary", { name: "Reklam", exact: true });

async function revealVisionAd(page: Page) {
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.getByTestId("vision-browse-open").click();
  await boundary(page).scrollIntoViewIfNeeded();
}

test("Defterlerim listesinin ardından tek reklam gösterilir", async ({ page }, testInfo) => {
  const api = await mockOverviewAds(page);
  await page.goto("/notebooks");
  await expect(page.getByText("Çalışma defterim", { exact: true }).first()).toBeVisible();
  await expect(boundary(page)).toHaveCount(1);
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  expect(new Set(api.placementCalls)).toEqual(new Set(["/v1/ads/placements/notebooks.overview"]));
  expect((await log(page)).filter((event) => event === "display")).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath("notebooks-ad.png"), fullPage: true });
});

test("Vision reklamı keşif panelinde, mobilde yalnız açıldıktan sonra hazırlanır", async ({ page }, testInfo) => {
  const api = await mockOverviewAds(page);
  await page.goto("/hedef");
  await expect(page.getByTestId("vision-browse-open")).toHaveCount((page.viewportSize()?.width ?? 0) < 1024 ? 1 : 0);
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await expect(boundary(page)).toHaveCount(0);
    expect(api.placementCalls).toHaveLength(0);
    expect(api.scriptRequests).toBe(0);
  }
  await revealVisionAd(page);
  await expect(ad(page)).toContainText("Test inventory");
  await expect(boundary(page)).toHaveCount(1);
  expect(new Set(api.placementCalls)).toEqual(new Set(["/v1/ads/placements/vision.overview"]));
  await page.screenshot({ path: testInfo.outputPath("vision-ad.png"), fullPage: true });
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByTestId("vision-browse-drawer").getByRole("button", { name: "Kapat", exact: true }).last().click();
    await expect(boundary(page)).toHaveCount(0);
    expect(await log(page)).toContain("destroy");
  }
});

test("dar keşif paneli yalnız sığan reklam boyutlarını ister", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await mockOverviewAds(page);
  await page.goto("/hedef");
  await revealVisionAd(page);
  await expect(ad(page)).toContainText("Test inventory");
  const sizes = await page.evaluate(() => (window as unknown as { __displayDefinitions: { sizes: number[][] }[] }).__displayDefinitions[0].sizes);
  const width = await boundary(page).evaluate((node) => node.clientWidth);
  expect(sizes.length).toBeGreaterThan(0);
  expect(sizes.every(([size]) => size <= width)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("mobil ve masaüstü arasında geçiş eski slotu kaldırır", async ({ page }) => {
  await mockOverviewAds(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/hedef");
  await revealVisionAd(page);
  await expect(ad(page)).toContainText("Test inventory");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(boundary(page)).toHaveCount(0);
  expect(await log(page)).toContain("destroy");
  await revealVisionAd(page);
  await expect(ad(page)).toContainText("Test inventory");
  await expect(boundary(page)).toHaveCount(1);
});

for (const mode of ["empty", "blocked", "denied"] as const) {
  test(`${mode}: reklam yokken defterler kullanılabilir`, async ({ page }) => {
    const api = await mockOverviewAds(page, { [mode]: true });
    await page.goto("/notebooks");
    await boundary(page).scrollIntoViewIfNeeded();
    await expect.poll(() => api.placementCalls.length).toBeGreaterThan(0);
    await expect(ad(page)).toBeHidden();
    await expect(page.getByRole("button", { name: "Yeni defter", exact: true })).toBeVisible();
    if (mode === "denied") expect(api.scriptRequests).toBe(0);
  });
}

test("liste yüklenemezse reklam hazırlanmaz", async ({ page }) => {
  const api = await mockOverviewAds(page, { listError: true });
  await page.goto("/notebooks");
  await expect(page.getByRole("button", { name: "Yeniden dene", exact: true })).toBeVisible();
  await expect(boundary(page)).toHaveCount(0);
  expect(api.placementCalls).toHaveLength(0);
});

test("Premium geçişinde aktif reklam kaldırılır", async ({ page }) => {
  const api = await mockOverviewAds(page);
  await page.goto("/notebooks");
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  api.premium = true;
  await page.evaluate(() => window.dispatchEvent(new Event("mentor:subscription-changed")));
  await expect(ad(page)).toBeHidden();
  expect((await log(page)).filter((event) => event === "display")).toHaveLength(1);
  expect(await log(page)).toContain("destroy");
});

test("yeni sayfa girişinde güncel reklam birimi kullanılır", async ({ page }) => {
  const api = await mockOverviewAds(page);
  await page.goto("/notebooks");
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  api.adUnitPath = "/123/updated";
  await page.reload();
  await boundary(page).scrollIntoViewIfNeeded();
  await expect(ad(page)).toContainText("Test inventory");
  expect(await page.evaluate(() => (window as unknown as { __displayDefinitions: { path: string }[] }).__displayDefinitions[0].path)).toBe("/123/updated");
});

for (const path of ["/vision-board/board", `/notebooks/${NOTEBOOK_ID}`]) {
  test(`${path}: editör reklam isteği üretmez`, async ({ page }) => {
    const api = await mockOverviewAds(page);
    await page.goto(path);
    if (path === "/vision-board/board") {
      await expect(page.getByRole("button", { name: "Paylaş", exact: true })).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Defteri aç", exact: true }).click();
      await expect(page.getByRole("heading", { name: "İçindekiler", exact: true })).toBeVisible();
    }
    await expect(boundary(page)).toHaveCount(0);
    expect(api.placementCalls).toHaveLength(0);
    expect(api.scriptRequests).toBe(0);
  });
}
