import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser, PlanDto, SubscriptionView } from "@mentor/types";

const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "subscription@test.local",
  displayName: "Subscription Test",
  username: "subscription_test",
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
  createdAt: "2026-01-01T00:00:00.000Z",
};

const plans: PlanDto[] = [
  {
    id: "premium-monthly",
    name: "Premium Aylık",
    periodMonths: 1,
    priceMinor: 24900,
    currency: "TRY",
    trialDays: 7,
    purchaseEnabled: false,
  },
];

const subscription: SubscriptionView = {
  subscription: null,
  entitlement: {
    tier: "FREE",
    isPremium: false,
    validUntil: null,
    reason: "NONE",
  },
  features: {
    "coach.chat": {
      id: "coach.chat",
      freeEnabled: false,
      limit: 1,
      window: "day",
    },
    "photo.categorize": {
      id: "photo.categorize",
      freeEnabled: false,
      limit: 1,
      window: "month",
    },
    "plan.ai": { id: "plan.ai", freeEnabled: false, limit: 1, window: "day" },
    "mood.reflection": {
      id: "mood.reflection",
      freeEnabled: false,
      limit: 1,
      window: "day",
    },
    "ghost.narration": {
      id: "ghost.narration",
      freeEnabled: false,
      limit: 1,
      window: "day",
    },
    "vision.note": {
      id: "vision.note",
      freeEnabled: false,
      limit: 1,
      window: "day",
    },
    "session.reflection": {
      id: "session.reflection",
      freeEnabled: false,
      limit: 1,
      window: "day",
    },
    "weekly.narration": {
      id: "weekly.narration",
      freeEnabled: false,
      limit: 1,
      window: "week",
    },
    "daily.greeting": {
      id: "daily.greeting",
      freeEnabled: false,
      limit: 1,
      window: "day",
    },
    "deep.analysis": {
      id: "deep.analysis",
      freeEnabled: false,
      limit: 1,
      window: "week",
    },
  },
};

const corsHeaders = {
  "access-control-allow-origin": "http://localhost:3100",
  "access-control-allow-credentials": "true",
};

test("ödeme kapalıyken fiyatı gösterir ve checkout kontrollerini kapatır", async ({
  page,
}) => {
  await mockSubscriptionApi(page);
  await page.goto("/abonelik");

  await expect(page.getByText("₺249,00")).toBeVisible();
  await expect(page.getByText("Şu an kullanılamıyor")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Çok yakında" })).toBeDisabled();
});

test("kilitli koç CTA paywall modalını açar", async ({ page }) => {
  await mockSubscriptionApi(page, { premiumRequired: true });
  await page.goto("/koc/sohbet");

  await page.getByRole("button", { name: "Premium'a yükselt" }).click();
  await expect(page.getByTestId("premium-paywall")).toBeVisible();
  await expect(page.getByRole("button", { name: "Çok yakında" })).toBeDisabled();
});

async function mockSubscriptionApi(
  page: Page,
  options: { premiumRequired?: boolean } = {},
) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
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
    if (method === "GET" && path === "/v1/subscription") {
      return json(route, subscription);
    }
    if (method === "GET" && path === "/v1/coach/access") {
      return json(route, {
        canChat: false,
        mode: "NONE",
        reason: options.premiumRequired ? "PAYMENT_PREMIUM_REQUIRED" : "NONE",
      });
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

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: body == null ? "" : JSON.stringify(body),
  });
}
