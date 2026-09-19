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
  await expect(page.getByRole("heading", { name: "Selam, ben Puhu." })).toBeVisible();

  await page.getByRole("button", { name: "Atla" }).click();
  await expect(page.getByRole("heading", { name: "Bu yolu tek başına yürümeyeceksin." })).toBeVisible();
  // Skip has nowhere left to go, and the account button rises in under the renamed CTA.
  await expect(page.getByRole("button", { name: "Atla" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Zaten hesabım var" })).toBeVisible();

  await page.getByRole("button", { name: "Başlayalım" }).click();
  await expect(page).toHaveURL(/\/kayit$/);
  if (testInfo.project.name === "desktop-chromium") {
    await expect(page.getByRole("heading", { name: "Yolculuğun burada başlıyor." })).toBeVisible();
    await expect(page.locator("[data-auth-narrative-bubble]")).toBeVisible();

    const desktopLayout = await page.locator(".auth-sheet").evaluate((sheet) => {
      const scrollArea = sheet.querySelector<HTMLElement>(".mentor-scrollarea");
      const bounds = sheet.getBoundingClientRect();
      return {
        innerOverflowY: scrollArea ? getComputedStyle(scrollArea).overflowY : null,
        rightInset: window.innerWidth - bounds.right,
      };
    });
    expect(desktopLayout.innerOverflowY).not.toBe("auto");
    expect(desktopLayout.rightInset).toBeGreaterThanOrEqual(64);
  }
  await expect(page.getByRole("heading", { name: "Hesap oluştur" })).toBeVisible();
});

test("welcome remains immediately usable with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Selam, ben Puhu." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Devam et" })).toBeEnabled();
});

test("welcome steps through the day with Devam et and the slide dots", async ({ page }) => {
  await page.goto("/");

  const copyLayer = page.locator('[aria-live="polite"] .t-stagger');
  await copyLayer.evaluate((element) => element.setAttribute("data-transition-probe", "stable"));

  await page.getByRole("button", { name: "Devam et" }).click();
  await expect(page.getByRole("heading", { name: "Zorlandığında AI koçun yanında." })).toBeVisible();
  await expect(copyLayer).toHaveAttribute("data-transition-probe", "stable");
  await expect(page.locator("video")).toHaveCount(4);

  await page.getByRole("button", { name: "3. slayta geç" }).click();
  await expect(page.getByRole("heading", { name: "Hedeften bugüne, hepsi tek yerde." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zaten hesabım var" })).toHaveCount(0);
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

  await page.getByRole("button", { name: "Devam" }).click();
  await expect(page.getByRole("heading", { name: "Hangi sınava hazırlanıyorsun?" })).toBeVisible();
  const revealedQuestion = page.locator("[data-onboarding-content] .t-stagger.is-shown");
  await expect(revealedQuestion.getByRole("radio", { name: "KPSS" })).toBeVisible();
});

test("a student answers one question per screen and lands on their summary", async ({ page }) => {
  let user: AuthUser = { ...onboardingUser };
  let vision: Record<string, unknown> | null = null;

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      "access-control-allow-origin": request.headers().origin ?? "http://localhost:3100",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type, authorization, accept-language",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    };
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(body) });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.method() === "POST" && path === "/v1/auth/refresh") {
      return json({ accessToken: "test-token", expiresIn: 3600, user });
    }
    if (request.method() === "PATCH" && path === "/v1/users/me") {
      user = { ...user, ...(request.postDataJSON() as Partial<AuthUser>) };
      return json(user);
    }
    if (request.method() === "GET" && path === "/v1/coaching/vision") return json(null);
    if (request.method() === "POST" && path === "/v1/coaching/vision") {
      vision = request.postDataJSON() as Record<string, unknown>;
      return json(vision);
    }
    return route.fulfill({ status: 204, headers });
  });

  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Devam" }).click();

  await page.getByRole("radio", { name: "YKS" }).click();
  await page.getByRole("button", { name: "Devam" }).click();

  // YKS has no level question: straight to why.
  await page.getByRole("radio", { name: "Ailem için" }).click();
  await page.getByRole("button", { name: "Devam" }).click();

  await page.getByRole("radio", { name: "Eğitim" }).click();
  await page.getByRole("button", { name: "Devam" }).click();
  // Why and field land on the goal board together, with a title derived from the field.
  await expect
    .poll(() => vision)
    .toMatchObject({ goalTitle: "Eğitim alanında ilerlemek", careerGroup: "EGITIM", motivation: "Ailem için" });

  await page.getByRole("radio", { name: "Düzenli" }).click();
  await page.getByRole("button", { name: "Devam" }).click();
  await expect.poll(() => user.dailyFocusGoalMinutes).toBe(30);

  await page.getByLabel("Kullanıcı adı").fill("deniz_yks");
  await page.getByRole("button", { name: "Devam" }).click();

  await expect(page.getByRole("heading", { name: "Yolun hazır." })).toBeVisible();
  const summary = page.getByRole("list", { name: "Seçimlerin" });
  await expect(summary).toContainText("Günde 30 dk odak");
  await expect(summary).toContainText("Alan: Eğitim");
  // No push in this browser, so no promise of a reminder.
  await expect(summary).not.toContainText("Hatırlatma açık");
});
