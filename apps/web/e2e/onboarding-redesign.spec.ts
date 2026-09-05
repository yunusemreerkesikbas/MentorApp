import { expect, test } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

const onboardingUser: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "onboarding@test.local",
  displayName: "Deniz",
  username: null,
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: null,
  examVariant: null,
  examDate: null,
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.removeItem("mentor_welcome_seen"));
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      "access-control-allow-origin": request.headers().origin ?? "http://localhost:3100",
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

test("welcome copy uses streaming speech and staggered supporting text", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const streamedGreeting = page.getByRole("heading", { name: "Selam, ben Puhu." });
  await expect(streamedGreeting.locator(".t-stream-w").first()).toHaveClass(/is-in/);

  const supportingCopy = page.locator(".t-stagger.is-shown");
  await expect(supportingCopy.locator(".t-stagger-line")).toHaveCount(1);

  await page.getByRole("button", { name: "Devam" }).click();
  const coachCopy = page.locator(".t-stagger.is-shown");
  await expect(coachCopy.getByRole("heading", { name: "Zorlandığında buradayım." })).toBeVisible();
  await expect(coachCopy.locator(".t-stagger-line")).toHaveCount(2);
});

test("Puhu speech resolves as streaming words", async ({ page }) => {
  await page.route("http://localhost:3001/v1/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3100",
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({ accessToken: "test-token", expiresIn: 3600, user: onboardingUser }),
    });
  });

  await page.goto("/onboarding");

  const streamedWords = page.locator('[aria-live="polite"] .t-stream-w');
  await expect(streamedWords.first()).toHaveClass(/is-in/);
  expect(await streamedWords.count()).toBeGreaterThan(1);
});
