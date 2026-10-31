import type { Page, Route } from "@playwright/test";
import type { AuthUser, EconomyUsesView } from "@mentor/types";
import { browserApiUrl, browserWebOrigin } from "../api.fixture";

const user: AuthUser = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "catalog@example.test",
  displayName: "Catalog QA",
  username: "catalog_qa",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "KPSS",
  examVariant: "LISANS",
  examDate: null,
  dailyFocusGoalMinutes: null,
  careerGroup: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};
export const economyUsesFixture: EconomyUsesView = {
  coinConfirmed: 42,
  items: [
    {
      id: "NOTEBOOK_SLOT",
      status: "AVAILABLE",
      cost: 37,
      premiumIncluded: false,
      canOpen: true,
      slotsOwned: 1,
      slotLimit: 2,
    },
    {
      id: "COACH_CHAT",
      status: "AVAILABLE",
      cost: 7,
      premiumIncluded: false,
      canOpen: true,
      dailyRemaining: 3,
    },
    {
      id: "DEEP_ANALYSIS",
      status: "REVIEW_NOT_READY",
      cost: 29,
      premiumIncluded: false,
      canOpen: false,
    },
  ],
};
export async function mockEconomyUses(
  page: Page,
  options: {
    closed?: boolean;
    error?: boolean;
    hold?: boolean;
    view?: EconomyUsesView;
  } = {},
) {
  const state = {
    closed: options.closed ?? false,
    error: options.error ?? false,
    view: options.view ?? economyUsesFixture,
    requests: 0,
    writes: 0,
  };
  let release = () => {};
  const held = options.hold
    ? new Promise<void>((resolve) => {
        release = resolve;
      })
    : Promise.resolve();
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      headers: {
        "access-control-allow-origin": browserWebOrigin,
        "access-control-allow-credentials": "true",
      },
      contentType: "application/json",
      body: body === null ? "" : JSON.stringify(body),
    });
  await page.addInitScript(() =>
    localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  await page.route(`${browserApiUrl}/**`, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "OPTIONS") return json(route, null, 204);
    if (path === "/v1/auth/refresh")
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    if (path === "/v1/users/me") return json(route, user);
    if (path === "/v1/users/me/auth-accounts/google")
      return json(route, {
        enabled: false,
        linked: false,
        canLink: false,
        providerEmail: null,
      });
    if (path === "/v1/users/me/phone")
      return json(route, {
        verified: false,
        maskedPhoneNumber: null,
        available: false,
        reauthenticationRequired: false,
      });
    if (path === "/v1/notifications")
      return json(route, {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        unreadCount: 0,
      });
    if (path === "/v1/notifications/preferences")
      return json(route, { emailEnabled: false, pushEnabled: false });
    if (path === "/v1/notifications/stream-token")
      return json(route, { token: "stream-token" }, 201);
    if (path === "/v1/notifications/stream")
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "",
      });
    if (path === "/v1/economy/quests") return json(route, []);
    if (path.startsWith("/v1/economy/")) {
      if (req.method() === "POST") state.writes++;
      if (path === "/v1/economy/uses") {
        state.requests++;
        await held;
        if (options.hold) return json(route, state.view); // an already-started open snapshot can arrive after closure
        if (state.error)
          return json(route, { code: "INTERNAL_ERROR", message: "Hata" }, 503);
      }
      if (state.closed)
        return json(
          route,
          { code: "ECONOMY_DISABLED", message: "Kapalı" },
          404,
        );
      if (path === "/v1/economy/uses") return json(route, state.view);
      if (path === "/v1/economy/balance")
        return json(route, {
          xp: 0,
          coinConfirmed: state.view.coinConfirmed,
          coinPending: 0,
          level: {
            tier: 1,
            xp: 0,
            nextAt: 100,
            key: "spark",
            chapter: "awakening",
            currentAt: 0,
            nextKey: "trail",
            progress: { current: 0, target: 100, remaining: 100, percent: 0 },
          },
        });
      if (path === "/v1/economy/ledger") return json(route, []);
      if (path === "/v1/economy/rewards/unseen")
        return json(route, { items: [], total: 0, page: 1, pageSize: 20 });
      if (path === "/v1/economy/invite")
        return json(route, {
          code: "PUHU-TEST2345",
          rewardCoin: 20,
          joined: [],
          joinedCount: 0,
          convertedCount: 0,
          redeemed: null,
          canRedeem: false,
          checkoutBlocked: false,
          friendDiscount: null,
        });
    }
    return json(route, null, 204);
  });
  return { state, release };
}
export async function openEconomyUses(page: Page, english = false) {
  await page.goto(english ? "/en/settings" : "/ayarlar");
  await page
    .getByRole("button", {
      name: english ? "Your balance" : "Bakiyen",
      exact: true,
    })
    .click();
  return page.getByRole("region", {
    name: english
      ? "What can I unlock with Coin?"
      : "Coin ile neler açabilirim?",
  });
}
