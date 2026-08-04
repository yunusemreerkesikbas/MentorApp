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
};

test("ödeme kapalıyken fiyatı gösterir ve checkout kontrollerini kapatır", async ({ page }) => {
  await mockSubscriptionApi(page);
  await page.goto("/subscription");

  await expect(page.getByText("₺249,00")).toBeVisible();
  await expect(page.getByText("Şu an kullanılamıyor")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Çok yakında" })).toBeDisabled();
});

async function mockSubscriptionApi(page: Page) {
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
    if (method === "GET" && path === "/v1/subscription") return json(route, subscription);
    if (method === "GET" && path.startsWith("/v1/notifications")) {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") {
      return json(route, { token: "test-stream" });
    }

    return json(route, {});
  });
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: body == null ? "" : JSON.stringify(body),
  });
}
