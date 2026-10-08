import { expect, test } from "@playwright/test";
import { completeCaptcha, expectSecurityPageHealthy, mockSecurity, user, type SecurityOptions } from "./helpers/account-security";

test.afterEach(async ({ page }) => expectSecurityPageHealthy(page));

const copy = {
  tr: {
    login: "Giriş yap", forgot: "Sıfırlama bağlantısı gönder", edit: "Düzenle", save: "Kaydet",
    email: "E-posta", name: "Ad soyad", remove: "Hesabımı sil", cancel: "Vazgeç",
    reauth: "Hesabını korumak için yeniden giriş yapman gerekiyor.",
    changed: "E-posta adresin değişti ve tüm oturumların kapandı.",
    generic: "Bu e-posta kayıtlıysa sıfırlama bağlantısı yolda. Gelen kutuna bir bak.",
  },
  en: {
    login: "Sign in", forgot: "Send reset link", edit: "Edit", save: "Save",
    email: "Email", name: "Full name", remove: "Delete my account", cancel: "Cancel",
    reauth: "Sign in again to keep your account secure.",
    changed: "Your email changed and all sessions ended.",
    generic: "If this email is registered, a reset link is on its way. Have a look in your inbox.",
  },
} as const;

const routes = {
  tr: { login: "/giris", "forgot-password": "/sifremi-unuttum", settings: "/ayarlar", dashboard: "/panel" },
  en: { login: "/en/login", "forgot-password": "/en/forgot-password", settings: "/en/settings", dashboard: "/en/dashboard" },
} as const;

for (const locale of ["tr", "en"] as const) {
  const text = copy[locale];
  const paths = routes[locale];
  for (const form of ["login", "forgot-password"] as const) {
    test(`${locale} ${form}: rate error requires a new challenge before retry`, async ({ page }) => {
      test.skip(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, "Requires the dedicated CAPTCHA build");
      const options: SecurityOptions = { authError: { status: 429, code: "AUTH_RATE_LIMITED", message: "Wait before trying again" } };
      const calls = await mockSecurity(page, options);
      await page.goto(form === "login" ? `${paths.login}?next=%2Fprofile` : paths[form]);
      await page.locator('input[name="email"]').fill(user.email);
      if (form === "login") await page.locator('input[name="password"]').fill("safe-password");
      const submit = page.getByRole("button", { name: form === "login" ? text.login : text.forgot, exact: true });
      await completeCaptcha(page, "first-challenge");
      await submit.click();
      await expect(page.locator("form").getByRole("alert")).toHaveText("Wait before trying again");
      await expect(submit).toBeDisabled();
      await page.locator("form").evaluate((node) => (node as HTMLFormElement).requestSubmit());
      expect([...calls.login, ...calls.forgot]).toHaveLength(1);
      options.authError = undefined;
      await completeCaptcha(page, "second-challenge");
      await submit.click();
      if (form === "login") {
        await expect(page).toHaveURL(new RegExp(`${paths.settings}$`));
        await expect(page.getByRole("button", { name: text.edit, exact: true })).toBeVisible();
      }
      else await expect(page.locator("form").getByRole("status")).toHaveText(text.generic);
      expect([...calls.login, ...calls.forgot].map((body) => body.turnstileToken)).toEqual(["first-challenge", "second-challenge"]);
    });

    test(`${locale} ${form}: pending request blocks repeated submissions`, async ({ page }) => {
      let release!: () => void;
      const pending = new Promise<void>((resolve) => { release = resolve; });
      const calls = await mockSecurity(page, { authPending: pending, failure: true });
      try {
        await page.goto(paths[form]);
        await page.locator('input[name="email"]').fill(user.email);
        if (form === "login") await page.locator('input[name="password"]').fill("safe-password");
        await completeCaptcha(page);
        const submit = page.getByRole("button", { name: form === "login" ? text.login : text.forgot, exact: true });
        await submit.click();
        await expect.poll(() => calls.login.length + calls.forgot.length).toBe(1);
        await expect(submit).toBeDisabled();
        await page.locator("form").evaluate((node) => {
          (node as HTMLFormElement).requestSubmit();
          (node as HTMLFormElement).requestSubmit();
        });
        release();
        await expect(page.locator("form").getByRole("alert")).toHaveText("Try again");
        expect([...calls.login, ...calls.forgot]).toHaveLength(1);
      } finally { release(); }
    });

    test(`${locale} ${form}: invalid email sends no request`, async ({ page }) => {
      const calls = await mockSecurity(page);
      await page.goto(paths[form]);
      await page.locator('input[name="email"]').fill("invalid-email");
      if (form === "login") await page.locator('input[name="password"]').fill("safe-password");
      await completeCaptcha(page);
      await page.getByRole("button", { name: form === "login" ? text.login : text.forgot, exact: true }).click();
      await expect(page.locator('input[name="email"]:invalid')).toHaveCount(1);
      expect([...calls.login, ...calls.forgot]).toHaveLength(0);
    });
  }

  for (const email of [user.email, "unknown@test.local"]) {
    test(`${locale} forgot-password: generic confirmation for ${email}`, async ({ page }) => {
      const calls = await mockSecurity(page);
      await page.goto(paths["forgot-password"]);
      await page.locator('input[name="email"]').fill(email);
      await completeCaptcha(page);
      await page.getByRole("button", { name: text.forgot, exact: true }).click();
      await expect(page.locator("form").getByRole("status")).toHaveText(text.generic);
      expect(calls.forgot).toHaveLength(1);
      await expect(page.locator('input[name="email"]')).toHaveCount(0);
      expect(page.url()).not.toContain(encodeURIComponent(email));
    });
  }

  test(`${locale} profile: unchanged email is omitted and session remains active`, async ({ page }) => {
    const calls = await mockSecurity(page, { authenticated: true });
    await page.goto(paths.settings);
    await page.getByRole("button", { name: text.edit, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(text.name, { exact: true }).fill("Updated Test Name");
    await dialog.getByLabel(text.email, { exact: true }).fill(user.email.toUpperCase());
    await dialog.getByRole("button", { name: text.save, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(calls.patchBodies).toHaveLength(1);
    expect(calls.patchBodies[0]).not.toHaveProperty("email");
    expect(calls.logouts).toBe(0);
    await page.reload();
    await expect(page.getByRole("button", { name: text.edit, exact: true })).toBeVisible();
  });

  for (const error of [
    { status: 409, code: "EMAIL_ALREADY_EXISTS", message: "Email is unavailable" },
    { status: 403, code: "FORBIDDEN", message: "This change is unavailable" },
  ]) {
    test(`${locale} email change: ${error.status} does not trigger reauthentication or logout`, async ({ page }) => {
      const calls = await mockSecurity(page, { authenticated: true, patchError: error });
      await page.goto(paths.settings);
      await page.getByRole("button", { name: text.edit, exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(text.email, { exact: true }).fill("new@test.local");
      await dialog.getByRole("button", { name: text.save, exact: true }).click();
      await expect(dialog.getByRole("alert")).toHaveText(error.message);
      await expect(page).toHaveURL(new RegExp(`${paths.settings}$`));
      await expect(dialog.getByRole("button", { name: text.save, exact: true })).toBeEnabled();
      expect(calls.patches).toBe(1);
      expect(calls.logouts).toBe(0);
    });
  }

  test(`${locale} delete: cancelling confirmation sends no deletion`, async ({ page }) => {
    const calls = await mockSecurity(page, { authenticated: true });
    await page.goto(paths.settings);
    await page.getByRole("button", { name: text.remove, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: text.cancel, exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(calls.deletes).toBe(0);
    expect(calls.logouts).toBe(0);
    await expect(page).toHaveURL(new RegExp(`${paths.settings}$`));
  });

  for (const reason of ["reauth", "emailchanged"] as const) {
    test(`${locale} login: localized ${reason} explanation`, async ({ page }) => {
      await mockSecurity(page);
      await page.goto(`${paths.login}?next=%2Fprofile&reason=${reason}`);
      await expect(page.locator("form").getByRole("status")).toContainText(reason === "reauth" ? text.reauth : text.changed);
      await expect(page.locator('input[name="email"]')).toBeEmpty();
    });
  }

  test(`${locale} login: unrecognized security reason is not rendered`, async ({ page }) => {
    await mockSecurity(page);
    await page.goto(`${paths.login}?reason=${encodeURIComponent("<img src=x onerror=alert(1)>")}`);
    await expect(page.locator("form").getByRole("heading", { name: text.login, exact: true })).toBeVisible();
    await expect(page.locator("form [role=status]")).toHaveCount(0);
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
  });
}
