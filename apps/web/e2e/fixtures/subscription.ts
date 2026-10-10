import { type Page, type Route } from "@playwright/test";
import type { AuthUser, PlanDto, SubscriptionView, TrialEligibilityDto } from "@mentor/types";

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

export const plans: PlanDto[] = [
  {
    id: "premium-monthly",
    name: "Premium Aylık",
    periodMonths: 1,
    priceMinor: 24900,
    currency: "TRY",
    trialDays: 7,
    seatCount: 0,
    purchaseEnabled: false,
    redirectToMobile: false,
  },
];

export const subscription: SubscriptionView = {
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
    "mentorship.brief": {
      id: "mentorship.brief",
      freeEnabled: false,
      limit: 1,
      window: "day",
    },
    "mentorship.cohort_brief": {
      id: "mentorship.cohort_brief",
      freeEnabled: false,
      limit: 1,
      window: "day",
    },
    "mentorship.suggestions": {
      id: "mentorship.suggestions",
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
  discount: null,
  trialEligibility: { eligible: false, reason: "PHONE_REQUIRED" },
  pendingTrialCheckoutUrl: null,
  pendingCheckoutUrl: null,
};

export const apiUrl = process.env.QA_STAGE3_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001/v1";
const corsHeaders = {
  "access-control-allow-origin": new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").origin,
  "access-control-allow-credentials": "true",
};

const activeSubscription: SubscriptionView = {
  ...subscription,
  subscription: {
    id: "33333333-3333-4333-8333-333333333333",
    planId: "premium-monthly",
    status: "ACTIVE",
    startedAt: "2026-04-12T12:00:00.000Z",
    trialEndsAt: null,
    currentPeriodStart: "2026-08-12T12:00:00.000Z",
    currentPeriodEnd: "2026-09-12T12:00:00.000Z",
    cancelAtPeriodEnd: false,
    sponsored: false,
  },
  entitlement: {
    tier: "PREMIUM",
    isPremium: true,
    validUntil: "2026-09-12T12:00:00.000Z",
    reason: "ACTIVE",
  },
};

export async function mockSubscriptionApi(
  page: Page,
  options: { premiumRequired?: boolean; subscribed?: boolean; plans?: PlanDto[]; eligibility?: TrialEligibilityDto } = {},
) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
  });
  await page.route(`${apiUrl}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path === "/v1/plans") return json(route, options.plans ?? plans);
    if (method === "GET" && path === "/v1/subscription") {
      return json(route, options.subscribed ? activeSubscription : { ...subscription, trialEligibility: options.eligibility ?? subscription.trialEligibility });
    }
    if (method === "POST" && path === "/v1/subscription/offers") {
      return json(route, { offers: {}, available: [] });
    }
    if (method === "POST" && path === "/v1/subscription/checkout") {
      return json(route, { checkoutUrl: new URL("/abonelik/sonuc?status=success", process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").href });
    }
    if (method === "GET" && path === "/v1/users/me/phone") {
      return json(route, { verified: false, maskedPhoneNumber: null, available: false, reauthenticationRequired: false });
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
