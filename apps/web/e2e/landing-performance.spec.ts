import { expect, test } from "@playwright/test";

// Uses the standard CI "enabled" browser API profile (economy on), or the local open waitlist fixture.
test("opening avoids below-fold media and selects viewport city sources", async ({ page }, testInfo) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await expect(page.locator(".lc-root")).toHaveAttribute("data-ready", "");
  await expect(page.locator(".lj-coin")).toBeAttached();
  await page.waitForTimeout(700);
  expect(requests.filter((url) => /coin\.json|dotlottie-player\.wasm|desk-chest-closed/.test(url))).toEqual([]);

  const mobile = testInfo.project.name.startsWith("mobile");
  for (const layer of ["far", "mid", "front"]) {
    const image = page.locator(`.lc-art[src$="city-${layer}.webp"]`);
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.currentSrc))
      .toContain(`city-${layer}${mobile ? "-mobile" : ""}.avif`);
  }
  // Close-up detail stays full resolution on both viewports.
  await expect.poll(() => page.locator('.lc-art[src$="city-facade.webp"]').evaluate((img: HTMLImageElement) => img.currentSrc))
    .toContain("city-facade.avif");
});

test("coin animation starts near its section", async ({ page }) => {
  const animation = page.waitForRequest(/\/animation\/coin\.json/);
  await page.goto("/");
  await page.locator(".lj-p-tabs button").nth(1).click();
  await page.locator(".lj-coin").scrollIntoViewIfNeeded();
  await animation;
  await expect(page.locator(".lj-coin canvas")).toBeAttached();
});

test("reduced motion keeps the coin still without downloading its player", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await page.locator(".lj-p-tabs button").nth(1).click();
  await page.locator(".lj-coin").scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await expect(page.locator(".lj-coin img")).toBeVisible();
  expect(requests.filter((url) => /coin\.json|dotlottie-player\.wasm/.test(url))).toEqual([]);
  await expect(page.locator(".lj-coin canvas")).toHaveCount(0);
});
