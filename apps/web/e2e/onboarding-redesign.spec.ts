import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.removeItem("mentor_welcome_seen"));
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      "access-control-allow-origin": "http://localhost:3100",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type, authorization, accept-language",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.method() === "POST" && path === "/v1/auth/refresh") {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        headers,
        body: JSON.stringify({ code: "AUTH_INVALID_REFRESH", message: "Oturum bulunamadı." }),
      });
    }
    return route.fulfill({ status: 204 });
  });
});

test("welcome skip opens the final account choice and desktop auth split", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("heading", { name: "Selam, ben Puhu." })).toBeVisible();

  await page.getByRole("button", { name: "Atla" }).click();
  await expect(page.getByRole("heading", { name: "Bu yolu tek başına yürümeyeceksin." })).toBeVisible();

  await page.getByRole("button", { name: "Kayıt ol" }).click();
  await expect(page).toHaveURL(/\/kayit$/);
  if (testInfo.project.name === "desktop-chromium") {
    await expect(page.getByRole("heading", { name: "Yolculuğun burada başlıyor." })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Hesap oluştur" })).toBeVisible();
});

test("welcome remains immediately usable with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Selam, ben Puhu." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Devam" })).toBeEnabled();
});
