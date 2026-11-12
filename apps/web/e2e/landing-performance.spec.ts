import { expect, test } from "@playwright/test";

test("tab icon keeps the artwork within a 10 KiB budget", async ({ page }) => {
  await page.goto("/");
  const icon = page.locator('link[rel="icon"][type="image/png"]');
  await expect(icon).toHaveAttribute("sizes", "64x64");
  const response = await page.request.get((await icon.getAttribute("href"))!);
  expect(response.ok()).toBe(true);
  const body = await response.body();
  expect(body.length).toBeLessThanOrEqual(10 * 1024);
  // PNG IHDR dimensions must agree with the browser's size hint.
  expect(body.readUInt32BE(16)).toBe(64);
  expect(body.readUInt32BE(20)).toBe(64);
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(0);
});

test("only existing city images receive four-hour shared caching", async ({ request }) => {
  for (const format of ["avif", "webp"]) {
    for (const layer of ["far", "mid", "front", "facade", "far-mobile", "mid-mobile", "front-mobile"]) {
      const response = await request.get(`/visuals/landing/city-${layer}.${format}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toBe("public, max-age=14400, s-maxage=14400");
      expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    }
  }
  for (const path of ["/visuals/landing/city-facade-mobile.avif", "/visuals/landing/city-missing.webp", "/visuals/landing/room-puhu.webp", "/sw.js"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(path.includes("missing") || path.includes("facade-mobile") ? 404 : 200);
    expect(response.headers()["cache-control"] ?? "").not.toContain("s-maxage=14400");
  }
});

test("localized documents retain fresh nonces and no-store", async ({ request }) => {
  for (const path of ["/", "/en"]) {
    const first = await request.get(path);
    const second = await request.get(path);
    expect(first.status()).toBe(200);
    for (const response of [first, second]) {
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(response.headers()["cdn-cache-control"]).toBe("no-store");
      expect(response.headers()["cloudflare-cdn-cache-control"]).toBe("no-store");
    }
    const nonce = (policy: string) => policy.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce(first.headers()["content-security-policy"])).toBeTruthy();
    expect(nonce(first.headers()["content-security-policy"])).not.toBe(nonce(second.headers()["content-security-policy"]));
  }
  const rsc = await request.get("/?_rsc=landing-cache-check", { headers: { rsc: "1" } });
  expect(rsc.status()).toBe(200);
  expect(rsc.headers()["content-type"]).toContain("text/x-component");
  expect(rsc.headers()["cache-control"]).toContain("no-store");
  expect(rsc.headers()["cloudflare-cdn-cache-control"]).toBe("no-store");
});

// Uses the standard CI "enabled" browser API profile (economy on), or the local open waitlist fixture.
test("opening avoids below-fold media and selects viewport city sources", async ({ page }, testInfo) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await expect(page.locator(".lc-stars")).toHaveAttribute("fetchpriority", "high");
  await expect(page.locator(".lc-root")).toHaveAttribute("data-ready", "");
  await expect(page.locator(".lj-coin")).toBeAttached();
  await page.waitForTimeout(700);
  expect(requests.filter((url) => /coin\.json|dotlottie-player\.wasm|desk-chest-closed|desk-recap-nebula/.test(url))).toEqual([]);

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

test("weekly story art loads as the visitor reaches the morning section", async ({ page }) => {
  await page.goto("/");
  const nebula = page.locator(".lm-phone img[src$='desk-recap-nebula.webp']");
  await expect(nebula).toHaveAttribute("loading", "lazy");
  await page.locator(".lm-phone").scrollIntoViewIfNeeded();
  await expect.poll(() => nebula.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
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
