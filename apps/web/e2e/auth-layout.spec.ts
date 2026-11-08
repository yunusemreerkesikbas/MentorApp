import { expect, test } from "@playwright/test";

for (const path of ["/giris", "/kayit?davet=1", "/sifremi-unuttum", "/sifre-sifirla?token=layout-test", "/eposta-dogrula"]) {
  test(`auth card fits the viewport on ${path}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    const sheet = page.locator(".auth-sheet");
    await expect(sheet).toBeVisible();
    await expect(page.locator("main h1")).toBeVisible();
    const bounds = await sheet.boundingBox();
    expect(bounds).not.toBeNull();
    const viewport = page.viewportSize()!;
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    if (testInfo.project.name.startsWith("desktop")) {
      const contentWidth = await page.evaluate(() => document.documentElement.getBoundingClientRect().width);
      expect(Math.abs(bounds!.x + bounds!.width / 2 - contentWidth / 2)).toBeLessThan(1);
      await expect(page.getByTestId("auth-hang-puhu")).toBeVisible();
      await expect(page.locator(".auth-narrative")).toHaveCount(0);
      const art = await page.getByTestId("auth-hang-puhu").boundingBox();
      expect(art!.y).toBeGreaterThanOrEqual(0);
      expect(art!.y).toBeLessThan(bounds!.y);
    } else if (path === "/giris" || path.startsWith("/kayit")) {
      await expect(page.getByTestId("auth-hang-puhu")).toBeVisible();
    } else {
      await expect(page.getByTestId("auth-hang-puhu")).toBeHidden();
    }
    if (path === "/giris") {
      await page.screenshot({ path: testInfo.outputPath("auth-login.png"), fullPage: true });
    }
  });
}

test("Puhu reacts to login fields and the short desktop card stays reachable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/giris");
  const puhu = page.getByTestId("auth-hang-puhu");
  await page.locator('input[name="email"]').focus();
  await expect(puhu).toHaveAttribute("data-focus", "text");
  await page.locator('input[name="password"]').focus();
  await expect(puhu).toHaveAttribute("data-pose", "cover");
  await page.setViewportSize({ width: 1280, height: 480 });
  await page.getByRole("button", { name: "Giriş yap", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Giriş yap", exact: true })).toBeInViewport();
  await expect(puhu).toBeVisible();
});
