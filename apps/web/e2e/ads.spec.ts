import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser, TodayPanelResponse } from "@mentor/types";
import { IDLE_STREAK } from "./streak.fixture";

const sessionIds = [
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
] as const;
test.use({ serviceWorkers: "block" });
const baseUser: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "ads@test.local",
  displayName: "Reklam Test",
  username: "ads_test",
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

test("Premium ve STAFF hesapları rewarded GPT isteği oluşturmaz", async ({ page, context }) => {
  let premiumGptRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/tag/js/gpt.js")) premiumGptRequests += 1;
  });
  await mockDashboard(page, { ineligibleReason: "PREMIUM_AD_FREE", premium: true });
  await page.goto("/panel");
  await page.waitForTimeout(200);
  expect(premiumGptRequests).toBe(0);
  // A member's rail has no announcement card at all; the quests are one tap away in their own card.
  await expect(page.getByTestId("dashboard-top-banner")).toHaveCount(0);
  await page
    .getByTestId("panel-quests-card")
    .getByRole("button", { name: "Tüm görevler" })
    .click();
  await expect(page.getByRole("heading", { name: "Görevler", exact: true })).toBeVisible();
  await expect(page.getByTestId("rewarded-ad-quest")).toHaveCount(0);
  expect(premiumGptRequests).toBe(0);

  const staffPage = await context.newPage();
  let staffGptRequests = 0;
  staffPage.on("request", (request) => {
    if (request.url().includes("/tag/js/gpt.js")) staffGptRequests += 1;
  });
  await mockDashboard(staffPage, {
    ineligibleReason: "STAFF_AD_FREE",
    roles: ["STUDENT", "STAFF"],
  });
  await staffPage.goto("/panel");
  await staffPage.waitForTimeout(200);
  expect(staffGptRequests).toBe(0);
  // Staff is on the free tier, so the trial may show; the coin offer never does.
  await expect(staffPage.getByTestId("dashboard-top-banner")).toBeVisible();
  await expect(
    staffPage.getByTestId("dashboard-top-banner").getByRole("button", { name: "Görevleri aç" }),
  ).toHaveCount(0);
});

test("uygun Free kullanıcı duyuru kartından görevleri açar ve GPT yalnız modal açılınca yüklenir", async ({ page }) => {
  let gptRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/tag/js/gpt.js")) gptRequests += 1;
  });
  await installRewardedGpt(page, "grant");
  await mockDashboard(page);
  await page.goto("/panel");

  const banner = await showAnnouncement(page, 1);
  await expect(banner.getByText("Günlük görevlerinde 10 Coin seni bekliyor.")).toBeVisible();
  expect(gptRequests).toBe(0);

  await banner.getByRole("button", { name: "Görevleri aç" }).click();
  await expect(page.getByRole("heading", { name: "Görevler", exact: true })).toBeVisible();
  await expect(page.getByTestId("rewarded-ad-quest")).toBeVisible();
  await expect(page.getByTestId("daily-quest-row").first()).toHaveText(/Bugünün planından 1 görev tamamla/);
  await expect.poll(() => gptRequests).toBe(1);
});

test("kapatılan ödül duyurusu aynı sekmedeki yenilemede geri gelmez", async ({ page }) => {
  await mockDashboard(page);
  await page.goto("/panel");

  const banner = await showAnnouncement(page, 1);
  await expect(banner.getByText("Günlük görevlerinde 10 Coin seni bekliyor.")).toBeVisible();
  await banner.getByRole("button", { name: "Duyuruyu kapat" }).click();
  // Only the coin offer goes; the trial beside it stays, alone, so the card stops rotating.
  await expect(banner.getByRole("button", { name: "Görevleri aç" })).toHaveCount(0);
  await expect(banner.getByRole("button", { name: /^Duyuru \d/ })).toHaveCount(0);

  await page.reload();
  const reloaded = page.getByTestId("dashboard-top-banner");
  await expect(reloaded).toBeVisible();
  await expect(reloaded.getByRole("button", { name: "Görevleri aç" })).toHaveCount(0);
});

test("iki günlük reklam hakkı ayrı tıklamalarla arka arkaya tamamlanır", async ({ page }) => {
  await installRewardedGpt(page, "grant");
  const api = await mockDashboard(page);
  await page.goto("/panel");

  await openRewardedQuest(page);
  const trigger = page.getByRole("button", { name: "Reklamı izle" });
  await expect(trigger).toBeEnabled();
  await trigger.click();

  await expect(page.getByText("5 Coin hesabına işlendi.")).toBeVisible();
  await expect(page.getByTestId("rewarded-ad-quest")).not.toContainText(
    "5 Coin hesabına işlendi.",
  );
  // One right left: the coin offer is still one of the card's two slides.
  await expect(
    page.getByTestId("dashboard-top-banner").getByRole("button", { name: /^Duyuru \d \/ 2$/ }),
  ).toHaveCount(2);
  await expect(trigger).toBeEnabled();
  await trigger.click();

  await expect(page.getByTestId("rewarded-ad-quest")).toContainText("2/2");
  // Both rights used: the coin offer leaves the card, the trial is all that is left.
  await expect(
    page.getByTestId("dashboard-top-banner").getByRole("button", { name: /^Duyuru / }),
  ).toHaveCount(0);
  expect(api.createKeys).toHaveLength(2);
  expect(api.createKeys[0]).toMatch(/^[0-9a-f-]{36}$/i);
  expect(new Set(api.createKeys).size).toBe(2);
  expect(api.completeCalls).toBe(2);
  expect(api.closeCalls).toBe(0);
});

test("reward retry aynı idempotency anahtarıyla tek Coin tamamlar", async ({ page }) => {
  await installRewardedGpt(page, "grant");
  const api = await mockDashboard(page, {
    failFirstCreate: true,
    failFirstComplete: true,
  });
  await page.goto("/panel");

  await openRewardedQuest(page);
  await page.getByRole("button", { name: "Reklamı izle" }).click();

  await expect(page.getByText("5 Coin hesabına işlendi.")).toBeVisible();
  expect(api.createKeys).toHaveLength(2);
  expect(api.createKeys[0]).toMatch(/^[0-9a-f-]{36}$/i);
  expect(new Set(api.createKeys).size).toBe(1);
  expect(api.completeCalls).toBe(2);
  expect(api.closeCalls).toBe(0);
});

test("rewarded no-fill ve kapatma Coin vermez; focus sakin duruma döner", async ({ page }) => {
  await installRewardedGpt(page, "close");
  const api = await mockDashboard(page);
  await page.goto("/panel");

  await openRewardedQuest(page);
  await page.getByRole("button", { name: "Reklamı izle" }).click();
  const unavailable = page.getByText(
    "Reklam görevi şu anda hazır değil. Daha sonra yeniden bakabilirsin.",
  );
  await expect(unavailable).toBeVisible();
  await expect(unavailable).toBeFocused();
  await expect(page.getByRole("button", { name: "Reklamı izle" })).toHaveCount(0);
  expect(api.closeCalls).toBe(1);
  expect(api.completeCalls).toBe(0);
});

test("empty rewarded slot Coin CTA göstermeden unavailable olur", async ({ page }) => {
  await installRewardedGpt(page, "empty");
  const api = await mockDashboard(page);
  await page.goto("/panel");

  await openRewardedQuest(page);
  await expect(page.getByText(/Reklam görevi şu anda hazır değil/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reklamı izle" })).toHaveCount(0);
  expect(api.createKeys).toHaveLength(0);
});

test("rewarded slot 10 saniyede hazır olmazsa hazırlanıyor durumunda kalmaz", async ({ page }) => {
  await installRewardedGpt(page, "timeout");
  const api = await mockDashboard(page);
  await page.goto("/panel");

  await openRewardedQuest(page);
  await expect(page.getByRole("button", { name: "Reklam hazırlanıyor" })).toBeDisabled();
  await expect(page.getByText(/Reklam görevi şu anda hazır değil/)).toBeVisible({
    timeout: 12_000,
  });
  await page.waitForTimeout(750);
  await expect(page.getByRole("button", { name: "Reklam hazırlanıyor" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reklamı izle" })).toHaveCount(0);
  expect(api.createKeys).toHaveLength(0);
});

test("session başlatma reddedilirse odak sakin hata mesajına döner", async ({ page }) => {
  await installRewardedGpt(page, "close");
  const api = await mockDashboard(page, { createFailureStatus: 422 });
  await page.goto("/panel");

  await openRewardedQuest(page);
  await page.getByRole("button", { name: "Reklamı izle" }).click();
  const failure = page.getByText("Reklam şu anda açılamadı. Daha sonra tekrar deneyebilirsin.");
  await expect(failure).toBeVisible();
  await expect(failure).toBeFocused();
  expect(api.createKeys).toHaveLength(1);
});

const today: TodayPanelResponse = {
  greetingName: "Reklam Test",
  motivationalLine: "Bugün tek bir adım yeter.",
  countdown: null,
  streak: IDLE_STREAK,
  tasks: [],
  nextAction: {
    kind: "ADD_TASK",
    title: "Bugünün tek küçük adımı",
    message: "Bugün için küçük bir görev ekleyebilirsin.",
    taskId: null,
  },
  sessionPresets: [{ id: "25_5", label: "25 / 5 dk", focusMinutes: 25, breakMinutes: 5 }],
  mood: null,
  focusGoal: { goalMinutes: null, focusMinutesToday: 0 },
  focusingNow: null,
  weeklyRecapPeriod: null,
};

const dailyQuests = [
  {
    id: "daily.plan-task",
    category: "daily_ritual" as const,
    period: "daily" as const,
    periodKey: "2026-08-30",
    type: "plan_task",
    title: "Bugünün planından 1 görev tamamla",
    badgeLabel: "Ritim",
    action: "plan" as const,
    rewardUnit: "XP" as const,
    rewardAmount: 5,
    rewardCoin: 0,
    progressCurrent: 0,
    progressTarget: 1,
    completed: false,
    completedAt: null,
  },
];

interface DashboardOptions {
  ineligibleReason?: string;
  premium?: boolean;
  roles?: AuthUser["roles"];
  failFirstCreate?: boolean;
  failFirstComplete?: boolean;
  createFailureStatus?: number;
}

async function mockDashboard(page: Page, options: DashboardOptions = {}) {
  const createKeys: string[] = [];
  let completeCalls = 0;
  let closeCalls = 0;
  let rewardedCount = 0;
  const rewardExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    window.sessionStorage.setItem("mentor.desktop-coach-fab.nudge-dismissed", "1");
  });
  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname + url.search;
    const method = request.method();
    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, {
        accessToken: "test-token",
        expiresIn: 3600,
        user: { ...baseUser, roles: options.roles ?? baseUser.roles },
      });
    }
    if (method === "GET" && path === "/v1/users/me") {
      return json(route, { ...baseUser, roles: options.roles ?? baseUser.roles });
    }
    if (method === "GET" && path.startsWith("/v1/notifications?")) {
      return json(route, { items: [], unreadCount: 0, hasMore: false });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") {
      return json(route, { token: "test-stream" });
    }
    if (method === "GET" && path.startsWith("/v1/notifications/stream?")) {
      return route.fulfill({ status: 200, contentType: "text/event-stream", headers: corsHeaders(route), body: "" });
    }
    if (
      method === "GET" &&
      (path === "/v1/community/achievements/unseen" ||
        path === "/v1/community/journey-levels/unseen")
    ) {
      return json(route, { celebrations: [] });
    }
    if (method === "GET" && path === "/v1/coaching/today") return json(route, today);
    if (method === "POST" && path === "/v1/coach/daily-greeting") {
      return json(route, { greeting: today.motivationalLine, model: "fake" });
    }
    if (method === "GET" && path === "/v1/coaching/vision") return json(route, null);
    if (method === "GET" && path === "/v1/subscription") {
      return json(route, {
        subscription: null,
        entitlement: {
          tier: options.premium ? "PREMIUM" : "FREE",
          isPremium: Boolean(options.premium),
          validUntil: null,
          reason: options.premium ? "ACTIVE" : "NONE",
        },
        features: {},
      });
    }
    if (method === "GET" && path === "/v1/economy/quests") {
      return json(route, dailyQuests);
    }
    if (method === "GET" && path.startsWith("/v1/economy/")) {
      return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }
    if (method === "GET" && path === "/v1/ads/reward-offers/dashboard.rewarded.coin") {
      const ineligible = options.ineligibleReason;
      const dailyLimitReached = !ineligible && rewardedCount >= sessionIds.length;
      return json(route, {
        id: "dashboard.rewarded.coin",
        format: "REWARDED",
        enabled: !ineligible && !dailyLimitReached,
        reason: ineligible ?? (dailyLimitReached ? "DAILY_LIMIT_REACHED" : "ELIGIBLE"),
        provider: "GOOGLE_AD_MANAGER",
        adUnitPath: ineligible || dailyLimitReached ? null : "/22639388115/rewarded_web_example",
        audienceTreatment: "NONE",
        limitedAds: true,
        sizes: [],
        eligible: !ineligible && !dailyLimitReached,
        rewardCoin: 5,
        dailyRemaining: Math.max(0, sessionIds.length - rewardedCount),
        cooldownEndsAt: null,
      });
    }
    if (method === "POST" && path === "/v1/ads/reward-sessions") {
      createKeys.push(request.headers()["idempotency-key"] ?? "");
      if (options.createFailureStatus) {
        return json(route, { code: "VALIDATION_FAILED", message: "rejected" }, options.createFailureStatus);
      }
      if (options.failFirstCreate && createKeys.length === 1) {
        return json(route, { code: "SERVICE_UNAVAILABLE", message: "retry" }, 503);
      }
      const sessionId = sessionIds[Math.min(rewardedCount, sessionIds.length - 1)];
      return json(route, {
        id: sessionId,
        status: "CREATED",
        rewardCoin: 5,
        expiresAt: rewardExpiresAt,
      });
    }
    const completedSessionIndex = sessionIds.findIndex(
      (sessionId) => path === `/v1/ads/reward-sessions/${sessionId}/complete`,
    );
    if (method === "POST" && completedSessionIndex >= 0) {
      completeCalls += 1;
      if (options.failFirstComplete && completeCalls === 1) {
        return json(route, { code: "SERVICE_UNAVAILABLE", message: "retry" }, 503);
      }
      rewardedCount = Math.max(rewardedCount, completedSessionIndex + 1);
      return json(route, {
        id: sessionIds[completedSessionIndex],
        status: "REWARDED",
        rewardCoin: 5,
        expiresAt: rewardExpiresAt,
        balance: rewardedCount * 5,
      });
    }
    const closedSessionIndex = sessionIds.findIndex(
      (sessionId) => path === `/v1/ads/reward-sessions/${sessionId}/close`,
    );
    if (method === "POST" && closedSessionIndex >= 0) {
      closeCalls += 1;
      return json(route, {
        id: sessionIds[closedSessionIndex],
        status: "CLOSED",
        rewardCoin: 5,
        expiresAt: rewardExpiresAt,
      });
    }
    return json(route, { code: "TEST_NOT_RELEVANT", message: `${method} ${path}` }, 404);
  });
  return {
    createKeys,
    get completeCalls() { return completeCalls; },
    get closeCalls() { return closeCalls; },
  };
}

/** Through the panel's quest card: the announcement card rotates, the quest card holds still. */
async function openRewardedQuest(page: Page): Promise<void> {
  await page
    .getByTestId("panel-quests-card")
    .getByRole("button", { name: "Tüm görevler" })
    .click();
  await expect(page.getByTestId("rewarded-ad-quest")).toBeVisible();
}

/** Holds the rotating announcement card on one slide: hover pauses it, the dot picks the slide. */
async function showAnnouncement(page: Page, index: number) {
  const card = page.getByTestId("dashboard-top-banner");
  await card.hover();
  await card.getByRole("button", { name: new RegExp(`^Duyuru ${index} / `) }).click();
  return card;
}

async function installRewardedGpt(page: Page, mode: "grant" | "close" | "empty" | "timeout") {
  await page.addInitScript((rewardMode) => {
    type Event = { slot: object; isEmpty?: boolean; makeRewardedVisible?: () => void };
    const listeners = new Map<string, Array<(event: Event) => void>>();
    const emit = (name: string, event: Event) => {
      for (const listener of listeners.get(name) ?? []) listener(event);
    };
    const pubads = {
      addEventListener(name: string, listener: (event: Event) => void) {
        listeners.set(name, [...(listeners.get(name) ?? []), listener]);
      },
      removeEventListener(name: string, listener: (event: Event) => void) {
        listeners.set(name, (listeners.get(name) ?? []).filter((item) => item !== listener));
      },
      collapseEmptyDivs() {},
      setPrivacySettings() {},
    };
    const googletag = {
      cmd: { push(callback: () => void) { callback(); return 1; } },
      enums: { OutOfPageFormat: { REWARDED: "REWARDED" } },
      defineSlot: () => null,
      defineOutOfPageSlot: () => {
        const slot = {};
        return { addService: () => slot };
      },
      pubads: () => pubads,
      enableServices() {},
      display(slot: object) {
        setTimeout(() => {
          if (rewardMode === "timeout") {
            setTimeout(() => emit("rewardedSlotReady", { slot, makeRewardedVisible() {} }), 10_500);
            return;
          }
          if (rewardMode === "empty") {
            emit("slotRenderEnded", { slot, isEmpty: true });
            return;
          }
          emit("slotRenderEnded", { slot, isEmpty: false });
          emit("rewardedSlotReady", {
            slot,
            makeRewardedVisible: () => setTimeout(() => {
              if (rewardMode === "grant") {
                emit("rewardedSlotGranted", { slot });
                emit("rewardedSlotGranted", { slot });
              }
              emit("rewardedSlotClosed", { slot });
              emit("rewardedSlotClosed", { slot });
            }, 0),
          });
        }, 0);
      },
      destroySlots: () => true,
    };
    Object.assign(window, { googletag });
  }, mode);
  await page.route("https://pagead2.googlesyndication.com/tag/js/gpt.js", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
}

function corsHeaders(route: Route) {
  return {
    "access-control-allow-origin": route.request().headers()["origin"] ?? "http://localhost:3100",
    "access-control-allow-credentials": "true",
  };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders(route),
    body: body == null ? "" : JSON.stringify(body),
  });
}
