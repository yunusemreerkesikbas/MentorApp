import { expect, test } from "@playwright/test";
import { completeCaptcha, expectSecurityPageHealthy, mockSecurity, user, type CaptchaState } from "./helpers/account-security";

test.afterEach(async ({ page }) => expectSecurityPageHealthy(page));

for (const form of ["login", "forgot-password"] as const) {
  test(`${form} fails closed on missing, expired and failed CAPTCHA, then resets after API errors`, async ({ page }) => {
    test.skip(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, "Build with a Turnstile site key to exercise CAPTCHA");
    const calls = await mockSecurity(page, { failure: true });
    await page.goto(`/en/${form}`);
    const button = page.getByRole("button", { name: form === "login" ? "Sign in" : "Send reset link", exact: true });
    await page.locator('input[name="email"]').fill("security@test.local");
    if (form === "login") await page.locator('input[name="password"]').fill("safe-password");
    await expect(page.locator(`[data-security-captcha="${form}"]`)).toBeAttached();
    await expect(button).toBeDisabled();
    await page.locator("form").evaluate((node) => (node as HTMLFormElement).requestSubmit());
    expect(calls.login.length + calls.forgot.length).toBe(0);
    await completeCaptcha(page);
    await expect(button).toBeEnabled();
    await page.evaluate(() => (window as unknown as { securityCaptcha: CaptchaState }).securityCaptcha.widget?.["expired-callback"]());
    await expect(button).toBeDisabled();
    await completeCaptcha(page);
    await page.evaluate(() => (window as unknown as { securityCaptcha: CaptchaState }).securityCaptcha.widget?.["error-callback"]());
    await expect(button).toBeDisabled();
    await completeCaptcha(page);
    await button.click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Try again");
    await expect(button).toBeDisabled();
    await expect.poll(() => page.evaluate(() => (window as unknown as { securityCaptcha: CaptchaState }).securityCaptcha.renders)).toBe(2);
    expect([...calls.login, ...calls.forgot][0]?.turnstileToken).toBe("security-token");
  });
}

test("forgot-password resets the successful challenge and shows generic success", async ({ page }) => {
  const calls = await mockSecurity(page);
  await page.goto("/en/forgot-password");
  await page.locator('input[name="email"]').fill(user.email);
  await completeCaptcha(page);
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  expect(calls.forgot).toHaveLength(1);
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    await expect.poll(() => page.evaluate(() => (window as unknown as { securityCaptcha: CaptchaState }).securityCaptcha.removals)).toBe(1);
  }
});

for (const mutation of ["email", "delete"] as const) {
  test(`${mutation} reauthentication discards the form and never repeats the mutation`, async ({ page }) => {
    const calls = await mockSecurity(page, { authenticated: true, reauth: true });
    await page.goto("/en/settings");
    if (mutation === "email") {
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Email", { exact: true }).fill("new@test.local");
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "Delete my account", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete permanently" }).click();
    }
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fprofile&reason=reauth$/);
    await expect(page.getByText("Sign in again to keep your account secure.", { exact: false })).toBeVisible();
    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="password"]').fill("safe-password");
    await completeCaptcha(page);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/settings$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      await expect.poll(() => page.evaluate(() => (window as unknown as { securityCaptcha: CaptchaState }).securityCaptcha.removals)).toBeGreaterThanOrEqual(1);
    }
    expect(calls.patches).toBe(mutation === "email" ? 1 : 0);
    expect(calls.deletes).toBe(mutation === "delete" ? 1 : 0);
    expect(calls.logouts).toBe(1);
  });
}

test("accepted email change clears every client tab and redirects without exposing the email", async ({ page, context }) => {
  const sessionState = { authenticated: true };
  const calls = await mockSecurity(page, { sessionState });
  const sibling = await context.newPage();
  await mockSecurity(sibling, { sessionState });
  await sibling.goto("/en/settings");
  await expect(sibling.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await page.goto("/en/settings");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Email", { exact: true }).fill("new@test.local");
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fprofile&reason=emailchanged$/);
  await expect(page.getByText("Your email changed and all sessions ended.", { exact: false })).toBeVisible();
  await expect(sibling).toHaveURL(/\/en\/login/);
  await expectSecurityPageHealthy(sibling);
  expect(calls.patches).toBe(1);
  expect(calls.logouts).toBe(0);
  expect(page.url()).not.toContain("new%40");
  await expect(page.locator('input[name="email"]')).toBeEmpty();
});

for (const next of ["/profile", "/settings?section=phone", "//evil.example"] as const) {
  test(`Google sign-in keeps only the approved return target ${next}`, async ({ page }) => {
    await mockSecurity(page);
    let target = "";
    await page.route("**/v1/auth/google/start?**", async (route) => {
      target = new URL(route.request().url()).searchParams.get("returnTo") ?? "";
      await route.fulfill({ status: 200, contentType: "text/plain", body: "Google start" });
    });
    await page.goto(`/en/login?next=${encodeURIComponent(next)}`);
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect.poll(() => target).toBe(next === "/profile" ? "/en/profile" : next.startsWith("/settings") ? "/en/settings?section=phone" : "/en/dashboard");
  });
}
