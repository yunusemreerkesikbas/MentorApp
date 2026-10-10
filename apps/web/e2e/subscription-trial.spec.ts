import { expect, test, type Page } from "@playwright/test";
import type { TrialEligibilityDto } from "@mentor/types";
import { apiUrl, mockSubscriptionApi, plans, subscription } from "./fixtures/subscription";

const sellablePlans = plans.map((plan) => ({ ...plan, purchaseEnabled: true }));

async function openPurchase(page: Page, surface: "paywall" | "subscription") {
  await page.goto(surface === "paywall" ? "/koc/sohbet" : "/abonelik");
  if (surface === "paywall") {
    await page.getByRole("button", { name: "Premium'a yükselt" }).click();
    await expect(page.getByTestId("premium-paywall")).toBeVisible();
  }
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByText("Başlangıç şekli", { exact: true })).toHaveCount(0);
}

async function expectCheckout(page: Page, useTrial: boolean, planId = "premium-monthly") {
  const request = page.waitForRequest((request) =>
    request.method() === "POST" && request.url() === `${apiUrl}/subscription/checkout`,
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: useTrial ? "Denemeyi başlat" : "Ücretli aboneliği başlat", exact: true }).click();
  expect((await request).postDataJSON()).toEqual({ planId, useTrial });
}

for (const surface of ["paywall", "subscription"] as const) {
  test(`${surface}: deneme uygun hesaba otomatik eklenir`, async ({ page }) => {
    await mockSubscriptionApi(page, {
      premiumRequired: true, plans: sellablePlans,
      eligibility: { eligible: true, reason: "AVAILABLE" },
    });
    await openPurchase(page, surface);
    await expect(page.getByText("7 gün ücretsiz deneme aboneliğine otomatik eklenir.")).toBeVisible();
    await expect(page.getByText("7 gün deneme sonrası plan ücreti otomatik alınır; istediğim an iptal edebilirim.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Denemeyi başlat", exact: true })).toBeDisabled();
    await expectCheckout(page, true);
  });

  for (const reason of ["ACCOUNT_USED", "PHONE_USED"] as const) {
    test(`${surface}: ${reason} ücretli başlar`, async ({ page }) => {
      await mockSubscriptionApi(page, {
        premiumRequired: true, plans: sellablePlans,
        eligibility: { eligible: false, reason },
      });
      await openPurchase(page, surface);
      await expect(page.getByText(/deneme daha önce kullanıldı/)).toHaveCount(0);
      await expect(page.getByText("7 gün ücretsiz deneme aboneliğine otomatik eklenir.")).toHaveCount(0);
      await expect(page.getByText(/Plan ücreti ₺249,00 şimdi/)).toBeVisible();
      await expectCheckout(page, false);
    });
  }

  test(`${surface}: telefon doğrulaması denemeyi korur ve onayı sıfırlar`, async ({ page }) => {
    const options = {
      premiumRequired: true, plans: sellablePlans,
      eligibility: { eligible: false, reason: "PHONE_REQUIRED" } as TrialEligibilityDto,
    };
    await mockSubscriptionApi(page, options);
    let releasePhoneStatus!: () => void;
    const phoneStatus = new Promise<void>((resolve) => { releasePhoneStatus = resolve; });
    await page.route(`${apiUrl}/users/me/phone`, async (route) => {
      await phoneStatus;
      await route.fulfill({
        json: { verified: true, maskedPhoneNumber: "+90 5** *** ** 12", available: true, reauthenticationRequired: false },
        headers: {
          "access-control-allow-origin": new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").origin,
          "access-control-allow-credentials": "true",
        },
      });
    });
    await openPurchase(page, surface);
    await expect(page.getByRole("heading", { name: "Telefon doğrulaması" })).toBeVisible();
    await page.getByRole("checkbox").check();
    await expect(page.getByRole("button", { name: "Denemeyi başlat", exact: true })).toBeDisabled();
    options.eligibility = { eligible: true, reason: "AVAILABLE" };
    releasePhoneStatus();
    await expect(page.getByRole("heading", { name: "Telefon doğrulaması" })).toHaveCount(0);
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expectCheckout(page, true);
  });
}

test("paywall: plan değişiminde otomatik deneme korunur", async ({ page }) => {
  const quarterly = { ...sellablePlans[0]!, id: "premium-quarterly", name: "Premium 3 Aylık", periodMonths: 3, priceMinor: 59900 };
  await mockSubscriptionApi(page, {
    premiumRequired: true, plans: [...sellablePlans, quarterly],
    eligibility: { eligible: true, reason: "AVAILABLE" },
  });
  await openPurchase(page, "paywall");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Premium 3 Aylık/ }).click();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expectCheckout(page, true, "premium-quarterly");
});

test("paywall: denemesiz plan ücretli başlar", async ({ page }) => {
  await mockSubscriptionApi(page, {
    premiumRequired: true, plans: sellablePlans.map((plan) => ({ ...plan, trialDays: 0 })),
    eligibility: { eligible: true, reason: "AVAILABLE" },
  });
  await openPurchase(page, "paywall");
  await expect(page.getByText("7 gün ücretsiz deneme aboneliğine otomatik eklenir.")).toHaveCount(0);
  await expectCheckout(page, false);
});

test("paywall: bekleyen deneme yeni checkout başlatmaz", async ({ page }) => {
  await mockSubscriptionApi(page, { premiumRequired: true, plans: sellablePlans });
  await page.route(`${apiUrl}/subscription`, (route) => route.fulfill({
    json: { ...subscription, trialEligibility: { eligible: false, reason: "PENDING" }, pendingTrialCheckoutUrl: "https://checkout.test.local/resume" },
    headers: {
      "access-control-allow-origin": new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").origin,
      "access-control-allow-credentials": "true",
    },
  }));
  await openPurchase(page, "paywall");
  await expect(page.getByRole("button", { name: "Ödemeye devam et" })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Denemeyi başlat", exact: true })).toHaveCount(0);
});

test("paywall: kupon deneme sonrası fiyatı ve checkout kodunu korur", async ({ page }) => {
  await mockSubscriptionApi(page, {
    premiumRequired: true, plans: sellablePlans,
    eligibility: { eligible: true, reason: "AVAILABLE" },
  });
  await page.route(`${apiUrl}/subscription/offers`, (route) => {
    const discounted = route.request().postDataJSON().code === "TRIAL20";
    return route.fulfill({
      json: {
        offers: { "premium-monthly": {
          planId: "premium-monthly", listPriceMinor: 24900,
          discountMinor: discounted ? 5000 : 0, chargedPriceMinor: discounted ? 19900 : 24900,
          renewalPriceMinor: 24900, promotion: null, reason: null,
        } },
        available: [],
      },
      headers: {
        "access-control-allow-origin": new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").origin,
        "access-control-allow-credentials": "true",
      },
    });
  });
  await openPurchase(page, "paywall");
  await page.getByRole("button", { name: "Kupon kodun var mı?" }).click();
  await page.getByRole("textbox", { name: "Kupon kodun", exact: true }).fill("TRIAL20");
  await page.getByRole("button", { name: "Uygula", exact: true }).click();
  await expect(page.getByText("7 gün deneme sonrası ilk ödeme ₺199,00, sonraki yenilemeler ₺249,00 olarak otomatik alınır; istediğim an iptal edebilirim.")).toBeVisible();
  const request = page.waitForRequest((request) => request.method() === "POST" && request.url() === `${apiUrl}/subscription/checkout`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Denemeyi başlat", exact: true }).click();
  expect((await request).postDataJSON()).toEqual({ planId: "premium-monthly", useTrial: true, code: "TRIAL20" });
});
