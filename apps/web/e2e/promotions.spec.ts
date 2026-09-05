import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  PlanDto,
  PromotionOffersView,
  SubscriptionView,
} from "@mentor/types";

const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "promotions@test.local",
  displayName: "Promotions Test",
  username: "promotions_test",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "KPSS",
  examVariant: null,
  examDate: "2026-09-06",
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-08-28T00:00:00.000Z",
};

const plans: PlanDto[] = [
  {
    id: "premium-monthly",
    name: "Premium Aylık",
    periodMonths: 1,
    priceMinor: 24900,
    currency: "TRY",
    trialDays: 7,
    // Purchase is live so the consent copy and the coupon field render.
    seatCount: 0,
  purchaseEnabled: true,
  },
];

const subscription: SubscriptionView = {
  subscription: null,
  entitlement: { tier: "FREE", isPremium: false, validUntil: null, reason: "NONE" },
  features: {} as SubscriptionView["features"],
  discount: null,
};

const LIST_PRICE_OFFERS: PromotionOffersView = {
  offers: {
    "premium-monthly": {
      planId: "premium-monthly",
      listPriceMinor: 24900,
      discountMinor: 0,
      chargedPriceMinor: 24900,
      renewalPriceMinor: 24900,
      promotion: null,
      reason: null,
    },
  },
  available: [],
};

const DISCOUNTED_OFFERS: PromotionOffersView = {
  offers: {
    "premium-monthly": {
      planId: "premium-monthly",
      listPriceMinor: 24900,
      discountMinor: 4980,
      chargedPriceMinor: 19920,
      renewalPriceMinor: 24900,
      promotion: {
        id: "promo-paywall-1",
        code: "HOSGELDIN",
        label: "Hoş geldin hediyesi",
        eyebrow: null,
        description: null,
        discountType: "PERCENT",
        discountValue: 20,
        planNames: null,
        appliesToPeriods: 1,
        endsAt: null,
      },
      reason: null,
    },
  },
  available: [],
};

const corsHeaders = {
  "access-control-allow-origin": "http://localhost:3100",
  "access-control-allow-credentials": "true",
};

interface Options {
  /** Offers returned when the client asks WITHOUT a code (the automatic path). */
  auto?: PromotionOffersView;
  /** Offers returned when the client sends this exact code; anything else is rejected. */
  validCode?: { code: string; offers: PromotionOffersView };
}

async function mockPaywall(page: Page, options: Options = {}) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    // Keep the promotion dialog out of the way; the banner spec covers it.
    window.localStorage.setItem("mentor.promotion-dialog.seen.v1", '["seeded"]');
  });

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path === "/v1/plans") return json(route, plans);
    if (method === "GET" && path === "/v1/subscription") return json(route, subscription);

    if (method === "POST" && path === "/v1/subscription/offers") {
      const body = request.postDataJSON() as { code?: string } | null;
      const code = body?.code;
      if (!code) return json(route, options.auto ?? LIST_PRICE_OFFERS);
      if (options.validCode && code === options.validCode.code) {
        return json(route, options.validCode.offers);
      }
      // Mirrors the API: an unusable code is an error, never a silent list-price fallback.
      return json(
        route,
        { code: "PROMOTION_NOT_FOUND", message: "Bu kupon kodunu bulamadık." },
        422,
      );
    }

    if (method === "GET" && path === "/v1/coach/access") {
      return json(route, { canChat: false, mode: "NONE", reason: "PAYMENT_PREMIUM_REQUIRED" });
    }
    if (method === "GET" && path.startsWith("/v1/economy/")) {
      return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }
    if (method === "GET" && path === "/v1/notifications") {
      return json(route, { items: [], unreadCount: 0, hasMore: false });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") {
      return json(route, { token: "test-stream" });
    }
    if (method === "GET" && path.startsWith("/v1/notifications/stream")) {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: corsHeaders,
        body: "",
      });
    }
    if (method === "GET" && path === "/v1/community/achievements/unseen") {
      return json(route, { celebrations: [] });
    }
    return json(route, null, 204);
  });
}

async function openPaywall(page: Page) {
  await page.goto("/koc/sohbet");
  await page.getByRole("button", { name: "Premium'a yükselt" }).click();
  await expect(page.getByTestId("premium-paywall")).toBeVisible();
}

test("indirimsiz kullanıcı yalnızca liste fiyatını görür", async ({ page }) => {
  await mockPaywall(page);
  await openPaywall(page);

  const paywall = page.getByTestId("premium-paywall");
  await expect(paywall.getByText("₺249,00")).toBeVisible();
  // No struck-through price and no promotion badge when nothing applies.
  await expect(paywall.locator("s")).toHaveCount(0);
  await expect(paywall.getByText("Hoş geldin hediyesi")).toHaveCount(0);
});

test("otomatik indirimde eski fiyat üstü çizili, yeni fiyat ve rozet görünür", async ({
  page,
}) => {
  await mockPaywall(page, { auto: DISCOUNTED_OFFERS });
  await openPaywall(page);

  // Scoped to the card: the discounted figure also appears in the consent copy by design.
  const planCard = page
    .getByTestId("premium-paywall")
    .getByRole("button", { name: /Premium Aylık/ });
  await expect(planCard.locator("s")).toHaveText("₺249,00");
  await expect(planCard.getByText("₺199,20")).toBeVisible();
  await expect(planCard.getByText("Hoş geldin hediyesi")).toBeVisible();
});

test("indirimli onay metni hem ilk ödemeyi hem yenileme fiyatını açıklar", async ({
  page,
}) => {
  await mockPaywall(page, { auto: DISCOUNTED_OFFERS });
  await openPaywall(page);

  // Ön bilgilendirme formu: the actual total AND what renews afterwards must both be stated.
  await expect(
    page.getByTestId("premium-paywall").getByText(/ilk ödeme[\s\S]*₺199,20[\s\S]*₺249,00/),
  ).toBeVisible();
});

test("geçerli kupon kodu fiyatı düşürür", async ({ page }) => {
  await mockPaywall(page, {
    validCode: { code: "HOSGELDIN", offers: DISCOUNTED_OFFERS },
  });
  await openPaywall(page);

  const paywall = page.getByTestId("premium-paywall");
  await expect(paywall.getByText("₺249,00")).toBeVisible();

  await paywall.getByRole("button", { name: "Kupon kodun var mı?" }).click();
  await paywall.getByLabel("Kupon kodu").fill("hosgeldin");
  await paywall.getByRole("button", { name: "Uygula" }).click();

  const planCard = paywall.getByRole("button", { name: /Premium Aylık/ });
  await expect(planCard.locator("s")).toHaveText("₺249,00");
  await expect(planCard.getByText("₺199,20")).toBeVisible();
  await expect(paywall.getByText("Kupon uygulandı: HOSGELDIN")).toBeVisible();
});

test("geçersiz kupon backend mesajını gösterir ve fiyatı değiştirmez", async ({
  page,
}) => {
  await mockPaywall(page, {
    validCode: { code: "HOSGELDIN", offers: DISCOUNTED_OFFERS },
  });
  await openPaywall(page);

  const paywall = page.getByTestId("premium-paywall");
  await paywall.getByRole("button", { name: "Kupon kodun var mı?" }).click();
  await paywall.getByLabel("Kupon kodu").fill("YANLIS");
  await paywall.getByRole("button", { name: "Uygula" }).click();

  await expect(paywall.getByText("Bu kupon kodunu bulamadık.")).toBeVisible();
  await expect(paywall.getByText("₺249,00")).toBeVisible();
  await expect(paywall.locator("s")).toHaveCount(0);
});

// The welcome dialog's selection rule is covered by src/lib/promotions.spec.ts —
// a pure unit test, per apps/web/AGENTS.md (DOM-free logic does not belong in e2e).

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: body == null ? "" : JSON.stringify(body),
  });
}
