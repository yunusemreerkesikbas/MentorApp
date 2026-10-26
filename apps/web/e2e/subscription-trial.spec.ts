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
  await page.getByRole("button", { name: useTrial ? /gün ücretsiz başla/ : /ile Premium'a geç/, exact: true }).click();
  expect((await request).postDataJSON()).toEqual({ planId, useTrial });
}

for (const surface of ["paywall", "subscription"] as const) {
  test(`${surface}: deneme uygun hesaba otomatik eklenir`, async ({ page }) => {
    await mockSubscriptionApi(page, {
      premiumRequired: true, plans: sellablePlans,
      eligibility: { phoneVerificationRequired: true, eligible: true, reason: "AVAILABLE" },
    });
    await openPurchase(page, surface);
    await expect(page.getByText("7 gün ücretsiz deneme aboneliğine otomatik eklenir.")).toBeVisible();
    await expect(page.getByText("7 gün deneme sonrası plan ücreti otomatik alınır; istediğim an iptal edebilirim.")).toBeVisible();
    // The CTA stays live on both surfaces: without consent it points at the box and starts nothing.
    await page.getByRole("button", { name: /gün ücretsiz başla/, exact: true }).click();
    await expect(page.getByText("Başlamadan önce bir onayın gerekiyor.")).toBeVisible();
    await expect(page.getByRole("checkbox")).toBeFocused();
    await expectCheckout(page, true);
  });

  for (const reason of ["ACCOUNT_USED", "PHONE_USED"] as const) {
    test(`${surface}: ${reason} ücretli başlar`, async ({ page }) => {
      await mockSubscriptionApi(page, {
        premiumRequired: true, plans: sellablePlans,
        eligibility: { phoneVerificationRequired: true, eligible: false, reason },
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
      eligibility: { phoneVerificationRequired: true, eligible: false, reason: "PHONE_REQUIRED" } as TrialEligibilityDto,
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
    await expect(page.getByRole("button", { name: /gün ücretsiz başla/, exact: true })).toBeDisabled();
    options.eligibility = { phoneVerificationRequired: true, eligible: true, reason: "AVAILABLE" };
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
    eligibility: { phoneVerificationRequired: true, eligible: true, reason: "AVAILABLE" },
  });
  await openPurchase(page, "paywall");
  // The recommended (longest) plan opens selected and speaks per month, with its charged total.
  const quarterlyCard = page.getByRole("button", { name: /Premium 3 Aylık/ });
  await expect(quarterlyCard).toHaveAttribute("aria-pressed", "true");
  await expect(quarterlyCard).toContainText("₺199,67/ay");
  await expect(quarterlyCard).toContainText("3 ayda ₺599,00");
  await expect(quarterlyCard).toContainText("%19 tasarruf");
  await expect(page.getByRole("button", { name: "7 gün ücretsiz başla" })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Premium Aylık/ }).click();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expectCheckout(page, true, "premium-monthly");
});

test("paywall: denemesiz plan ücretli başlar", async ({ page }) => {
  await mockSubscriptionApi(page, {
    premiumRequired: true, plans: sellablePlans.map((plan) => ({ ...plan, trialDays: 0 })),
    eligibility: { phoneVerificationRequired: true, eligible: true, reason: "AVAILABLE" },
  });
  await openPurchase(page, "paywall");
  await expect(page.getByText("7 gün ücretsiz deneme aboneliğine otomatik eklenir.")).toHaveCount(0);
  await expectCheckout(page, false);
});

test("paywall: bekleyen deneme yeni checkout başlatmaz", async ({ page }) => {
  await mockSubscriptionApi(page, { premiumRequired: true, plans: sellablePlans });
  await page.route(`${apiUrl}/subscription`, (route) => route.fulfill({
    json: { ...subscription, trialEligibility: { phoneVerificationRequired: true, eligible: false, reason: "PENDING" }, pendingTrialCheckoutUrl: "https://checkout.test.local/resume" },
    headers: {
      "access-control-allow-origin": new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").origin,
      "access-control-allow-credentials": "true",
    },
  }));
  await openPurchase(page, "paywall");
  await expect(page.getByRole("button", { name: "Ödemeye devam et" })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /gün ücretsiz başla/, exact: true })).toHaveCount(0);
});

test("paywall: kupon deneme sonrası fiyatı ve checkout kodunu korur", async ({ page }) => {
  await mockSubscriptionApi(page, {
    premiumRequired: true, plans: sellablePlans,
    eligibility: { phoneVerificationRequired: true, eligible: true, reason: "AVAILABLE" },
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
  await page.getByRole("button", { name: /gün ücretsiz başla/, exact: true }).click();
  expect((await request).postDataJSON()).toEqual({ planId: "premium-monthly", useTrial: true, code: "TRIAL20" });
});


for (const surface of ["paywall", "subscription"] as const) {
  test(`${surface}: phone-optional carded trials remain usable without SMS`, async ({ page }) => {
    await mockSubscriptionApi(page, {
      premiumRequired: true, plans: sellablePlans,
      eligibility: { eligible: true, reason: "AVAILABLE", phoneVerificationRequired: false },
    });
    await openPurchase(page, surface);
    await expect(page.getByText("7 gün ücretsiz deneme aboneliğine otomatik eklenir.")).toBeVisible();
    await expect(page.getByText("Deneme başladığında telefonunun", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Telefon doğrulaması", exact: true })).toHaveCount(0);
    await expectCheckout(page, true);
  });
}
