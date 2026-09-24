import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

/** Runs only against the disposable local QA API, without network response mocks. */
const qaApi = process.env.QA_REAL_API_URL;
test.skip(!qaApi, "Set QA_REAL_API_URL for isolated real-API smoke tests.");

test.beforeAll(() => {
  if (qaApi !== "http://localhost:3101/v1") {
    throw new Error("Real-API smoke tests require the isolated localhost:3101 QA API.");
  }
});

test("real API: two tabs refresh, scoped cookie, logout", async ({ page, context, request }) => {
  const suffix = randomUUID().slice(0, 8);
  const email = `qa-browser-${suffix}@example.test`;
  const password = "MentorQa!2026";
  const signup = await request.post(`${qaApi}/auth/signup`, {
    data: {
      email,
      password,
      displayName: "QA Browser",
      username: `qa_browser_${suffix}`,
      kvkkAccepted: true,
      termsAccepted: true,
      ageEligibilityConfirmed: true,
      intent: "STUDENT",
    },
  });
  expect(signup.status()).toBe(201);

  await page.goto("/giris");
  await page.getByRole("textbox", { name: "E-posta" }).fill(email);
  await page.getByRole("textbox", { name: /Şifre/ }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/(baslangic|panel)$/);

  const refreshCookie = (await context.cookies("http://localhost:3101/v1/auth"))
    .find((cookie) => cookie.name === "mentor_web_refresh");
  expect(refreshCookie).toMatchObject({ httpOnly: true, path: "/v1/auth" });
  const storageKeys = await page.evaluate(() => [
    ...Object.keys(localStorage),
    ...Object.keys(sessionStorage),
  ]);
  expect(storageKeys.join(" ")).not.toMatch(/access.?token|refresh.?token|mentor_admin_token/i);

  const secondTab = await context.newPage();
  await secondTab.goto("/baslangic");
  await expect(secondTab.getByRole("heading", { name: /Merhaba QA/ })).toBeVisible();
  await Promise.all([page.reload(), secondTab.reload()]);
  await expect(page).not.toHaveURL(/\/giris$/);
  await expect(secondTab).not.toHaveURL(/\/giris$/);

  const logout = await context.request.post(`${qaApi}/auth/logout`);
  expect(logout.status()).toBe(204);
  await Promise.all([page.reload(), secondTab.reload()]);
  await expect(page).toHaveURL(/\/giris$/);
  await expect(secondTab).toHaveURL(/\/giris$/);
});

test("real API: public article and cookie preferences render in TR/EN", async ({ page }) => {
  await page.goto("/blog/kpss-basvuru-sureci");
  await expect(page.getByRole("heading", { name: "KPSS Başvuru Süreci" })).toBeVisible();
  await page.goto("/cerez-tercihleri");
  await expect(page.getByRole("heading", { name: "Çerez ve analitik tercihleri" })).toBeVisible();
  await page.goto("/en/cookie-preferences");
  await expect(page.getByRole("heading", { name: "Cookie and analytics preferences" })).toBeVisible();
});

test("admin shell sends restrictive CSP and rejects a student session", async ({ page, request }) => {
  const response = await page.goto("http://localhost:3102/login");
  expect(response?.status()).toBe(200);
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("'unsafe-eval'");
  await expect(page.getByRole("heading", { name: "Mentor Admin" })).toBeVisible();

  const forged = await request.get(`${qaApi}/admin/users`, {
    headers: { "Cf-Access-Jwt-Assertion": "forged" },
  });
  expect([401, 403]).toContain(forged.status());
});
