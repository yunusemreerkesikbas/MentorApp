import { expect, test, type Page } from "@playwright/test";
import { user } from "./helpers/account-security";

async function mockConsentSession(page: Page, authenticated: boolean, pending?: Promise<void>) {
  await page.route("**/v1/auth/refresh", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: {
        "access-control-allow-origin": route.request().headers().origin,
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": "content-type, accept-language",
        "access-control-allow-methods": "POST, OPTIONS",
      } });
      return;
    }
    await pending;
    await route.fulfill({
      status: authenticated ? 200 : 401,
      headers: {
        "access-control-allow-origin": route.request().headers().origin,
        "access-control-allow-credentials": "true",
      },
      contentType: "application/json",
      body: JSON.stringify(authenticated ? { accessToken: "test-token", expiresIn: 3600, user } : {}),
    });
  });
}

test.describe("GA4 açık rıza sözleşmesi", () => {
  test.skip(
    !process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    "GA4 E2E production build'i NEXT_PUBLIC_GA_MEASUREMENT_ID ile hazırlanmalı.",
  );

  test.beforeEach(async ({ page }) => {
    await mockConsentSession(page, false);
  });

  test("oturum kontrolü sırasında ve giriş yapmış kullanıcıda banner açılmaz", async ({ page }) => {
    await page.addInitScript(() => {
      new MutationObserver(() => {
        if (document.querySelector('[role="dialog"][aria-label="Analitik çerez tercihin"]')) {
          document.documentElement.dataset.consentBannerSeen = "true";
        }
      }).observe(document, { childList: true, subtree: true });
    });
    let resolveSession!: () => void;
    const pending = new Promise<void>((resolve) => { resolveSession = resolve; });
    await mockConsentSession(page, true, pending);
    await page.goto("/yasal/kvkk-aydinlatma");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const banner = page.getByRole("dialog", { name: "Analitik çerez tercihin" });
    try {
      await expect(banner).not.toBeVisible();
    } finally {
      resolveSession();
    }
    await expect(page.getByRole("link", { name: "Panele dön", exact: true })).toBeVisible();
    await expect(banner).not.toBeVisible();
    await expect(page.locator("html")).not.toHaveAttribute("data-consent-banner-seen", "true");
    await expect(page.locator("script#mentor-ga4")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("mentor.analytics-consent.v1"))).toBeNull();
  });

  for (const consent of ["accepted", "rejected"] as const) {
    test(`giriş yapmış kullanıcının ${consent} tercihi korunur`, async ({ page }) => {
      await mockConsentSession(page, true);
      await page.addInitScript((value) => localStorage.setItem("mentor.analytics-consent.v1", value), consent);
      await page.route("https://www.googletagmanager.com/gtag/js**", (route) => route.fulfill({
        contentType: "application/javascript", body: "/* GA4 E2E stub */",
      }));
      await page.goto("/yasal/kvkk-aydinlatma");
      await expect(page.getByRole("link", { name: "Panele dön", exact: true })).toBeVisible();
      await expect(page.getByRole("dialog", { name: "Analitik çerez tercihin" })).not.toBeVisible();
      await expect(page.locator("script#mentor-ga4")).toHaveCount(consent === "accepted" ? 1 : 0);
      expect(await page.evaluate(() => localStorage.getItem("mentor.analytics-consent.v1"))).toBe(consent);
    });
  }

  test("reddetmeden önce ve reddettikten sonra Google etiketi yüklenmez", async ({
    page,
  }) => {
    let googleRequests = 0;
    page.on("request", (request) => {
      if (/google(tagmanager|analytics)\.com/.test(request.url())) googleRequests += 1;
    });

    await page.goto("/yasal/kvkk-aydinlatma");
    await expect(
      page.getByRole("dialog", { name: "Analitik çerez tercihin" }),
    ).toBeVisible();
    expect(googleRequests).toBe(0);
    await expect(page.locator("script#mentor-ga4")).toHaveCount(0);

    await page.getByRole("button", { name: "Reddet" }).click();
    await page.waitForTimeout(100);

    expect(googleRequests).toBe(0);
    await expect(page.locator("script#mentor-ga4")).toHaveCount(0);
  });

  test("kabulden sonra etiketi bir kez yükler ve GA4 config kuyruğunu kurar", async ({
    page,
  }) => {
    let scriptRequests = 0;
    await page.route("https://www.googletagmanager.com/gtag/js**", async (route) => {
      scriptRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "/* GA4 E2E stub */",
      });
    });

    await page.goto("/yasal/kvkk-aydinlatma");
    await page.getByRole("button", { name: "Kabul et" }).click();

    await expect(page.locator("script#mentor-ga4")).toHaveCount(1);
    await expect.poll(() => scriptRequests).toBe(1);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window.dataLayer ?? []).map((entry) =>
            Array.isArray(entry) ? String(entry[0]) : "",
          ).filter((command) => command === "js" || command === "config"),
        ),
      )
      .toEqual(["js", "config"]);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window.dataLayer ?? [])
            .filter(
              (entry): entry is unknown[] =>
                Array.isArray(entry) && entry[0] === "event",
            )
            .map((entry) => String(entry[1])),
        ),
      )
      .toContain("web_vital");
  });
});
