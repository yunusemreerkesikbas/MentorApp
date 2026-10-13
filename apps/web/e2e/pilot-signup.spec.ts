import { expect, test } from "@playwright/test";
import trErrors from "../../api/src/i18n/locales/tr/errors.json";
import enErrors from "../../api/src/i18n/locales/en/errors.json";
import { completeCaptcha, expectSecurityPageHealthy, mockSecurity } from "./helpers/account-security";

test.afterEach(async ({ page }) => expectSecurityPageHealthy(page));

for (const locale of ["tr", "en"] as const) {
  const errors = locale === "tr" ? trErrors : enErrors;
  for (const code of ["AUTH_SIGNUP_CLOSED", "AUTH_PILOT_INVITATION_REQUIRED"] as const) {
    test(`${locale} signup displays the backend ${code} without creating a session`, async ({ page }) => {
      await mockSecurity(page);
      let attempts = 0;
      await page.route("**/v1/auth/signup", async (route) => {
        const headers = {
          "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3100",
          "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type, authorization, accept-language",
          "access-control-allow-methods": "POST, OPTIONS",
        };
        if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        attempts++;
        return route.fulfill({ status: 403, headers, contentType: "application/json",
          body: JSON.stringify({ code, message: errors[code] }) });
      });
      await page.goto(locale === "tr" ? "/kayit" : "/en/signup");
      await page.locator('input[name="displayName"]').fill("Pilot Student");
      await page.locator('input[name="email"]').fill("student@test.local");
      await page.locator('input[name="password"]').fill("Password123");
      await page.getByRole("checkbox").nth(0).click();
      await page.getByRole("checkbox").nth(1).click();
      await completeCaptcha(page);
      await page.locator('button[type="submit"]').click();
      await expect(page.getByRole("alert")).toHaveText(errors[code]);
      expect(attempts).toBe(1);
      await expect(page).toHaveURL(locale === "tr" ? /\/kayit$/ : /\/en\/signup$/);
      await expect(page.locator('input[name="email"]')).toHaveValue("student@test.local");
    });

    test(`${locale} OAuth feedback displays the localized ${code}`, async ({ page }) => {
      await mockSecurity(page);
      const query = new URLSearchParams({ googleError: errors[code], googleErrorCode: code });
      await page.goto(`${locale === "tr" ? "/giris" : "/en/login"}?${query}`);
      await expect(page.getByRole("alert")).toHaveText(errors[code]);
      await expect(page.locator('input[name="email"]')).toBeVisible();
    });
  }
}
