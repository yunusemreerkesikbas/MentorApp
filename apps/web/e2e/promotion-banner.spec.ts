import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  PlanDto,
  PromotionOffersView,
  TodayPanelResponse,
} from "@mentor/types";

/**
 * Dashboard promotion strip. Separate from `promotions.spec.ts` because the dashboard needs a
 * much wider mock surface than the paywall does.
 */

const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "banner@test.local",
  displayName: "Banner Test",
  username: "banner_test",
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
    purchaseEnabled: true,
  },
];

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
        id: "promo-banner-1",
        code: null,
        label: "Hoş geldin hediyesi",
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

const PROMO_ID = "promo-banner-1";
const RIVAL_ID = "promo-banner-2";

/** A different campaign, to prove the "once" is per campaign and not a single global flag. */
const SECOND_CAMPAIGN: PromotionOffersView = {
  offers: {
    "premium-monthly": {
      ...DISCOUNTED_OFFERS.offers["premium-monthly"]!,
      promotion: {
        ...DISCOUNTED_OFFERS.offers["premium-monthly"]!.promotion!,
        id: RIVAL_ID,
        label: "Eylül kampanyası",
      },
    },
  },
  available: [],
};

/** Coded campaign: exercises the ticket and the coupon hand-over to the paywall. */
const CODED_CAMPAIGN: PromotionOffersView = {
  offers: { ...LIST_PRICE_OFFERS.offers },
  available: [
    {
      id: "promo-coded-1",
      code: "HOSGELDIN",
      label: "Hoş geldin hediyen",
      discountType: "PERCENT",
      discountValue: 20,
      planNames: null,
      appliesToPeriods: 1,
      endsAt: null,
    },
  ],
};

const today: TodayPanelResponse = {
  greetingName: "Banner Test",
  motivationalLine: "Bugün tek bir adım yeter.",
  countdown: null,
  streak: { currentStreak: 0, longestStreak: 0, freezeTokens: 2 },
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

const corsHeaders = {
  "access-control-allow-origin": "http://localhost:3100",
  "access-control-allow-credentials": "true",
};

interface Options {
  offers?: PromotionOffersView;
  premium?: boolean;
  /** Serve the rewarded-coin offer too, so the strip has a second item and rotates. */
  rewardedItem?: boolean;
  /** Campaign ids already shown on this device. Default suppresses the dialog entirely. */
  seenCampaigns?: string[];
  /** Collects every code the client sends to /offers, to prove the hand-over happened. */
  captureCodes?: (string | undefined)[];
}

async function mockDashboard(page: Page, options: Options = {}) {
  await page.addInitScript((seen: string) => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    window.localStorage.setItem(
      "mentor_mood_prompt_deferred_date",
      new Date().toISOString().slice(0, 10),
    );
    // Suppresses the promotion dialog so it does not open a modal over the strip.
    window.localStorage.setItem("mentor.promotion-dialog.seen.v1", seen);
    window.sessionStorage.setItem(
      "mentor_panel_welcome_date",
      new Date().toISOString().slice(0, 10),
    );
    window.sessionStorage.setItem("mentor.desktop-coach-fab.nudge-dismissed", "1");
  }, JSON.stringify(options.seenCampaigns ?? [PROMO_ID, RIVAL_ID]));

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
    if (method === "GET" && path === "/v1/coaching/today") return json(route, today);
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
        discount: null,
      });
    }
    if (method === "POST" && path === "/v1/subscription/offers") {
      const body = request.postDataJSON() as { code?: string } | null;
      options.captureCodes?.push(body?.code);
      if (body?.code) {
        return json(route, { ...DISCOUNTED_OFFERS, available: [] });
      }
      return json(route, options.offers ?? LIST_PRICE_OFFERS);
    }
    if (method === "GET" && path === "/v1/ads/reward-offers/dashboard.rewarded.coin") {
      const on = Boolean(options.rewardedItem);
      return json(route, {
        id: "dashboard.rewarded.coin",
        format: "REWARDED",
        enabled: on,
        reason: on ? "ELIGIBLE" : "ROLLOUT_EXCLUDED",
        provider: "GOOGLE_AD_MANAGER",
        adUnitPath: on ? "/22639388115/rewarded_web_example" : null,
        audienceTreatment: "NONE",
        limitedAds: true,
        sizes: [],
        eligible: on,
        rewardCoin: 5,
        dailyRemaining: 2,
        cooldownEndsAt: null,
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
    if (
      method === "GET" &&
      (path === "/v1/community/achievements/unseen" ||
        path === "/v1/community/journey-levels/unseen")
    ) {
      return json(route, { celebrations: [] });
    }
    return json(route, null, 204);
  });
}

const PROMO_TEXT = "Hoş geldin hediyesi seni bekliyor.";
const QUEST_TEXT = "Günlük görevlerinde 10 Coin seni bekliyor.";

test("indirimli ücretsiz kullanıcı panelde promosyon şeridini görür", async ({ page }) => {
  await mockDashboard(page, { offers: DISCOUNTED_OFFERS });
  await page.goto("/panel");

  const banner = page.getByTestId("dashboard-top-banner");
  await expect(banner).toContainText(PROMO_TEXT);

  await banner.getByRole("button", { name: "Premium’a bak" }).click();
  await expect(page.getByTestId("premium-paywall")).toBeVisible();
});

test("premium kullanıcıya promosyon şeridi gösterilmez", async ({ page }) => {
  await mockDashboard(page, { offers: DISCOUNTED_OFFERS, premium: true });
  await page.goto("/panel");

  // A Premium user gets no commercial nudge; with no rewarded item either the strip stays empty.
  await expect(page.getByTestId("dashboard-top-banner")).toHaveCount(0);
});

test("indirim yokken promosyon şeridi çıkmaz", async ({ page }) => {
  await mockDashboard(page);
  await page.goto("/panel");

  await expect(page.getByTestId("dashboard-top-banner")).toHaveCount(0);
});

test("iki item varken şerit döner ve imleç üzerindeyken durur", async ({ page }) => {
  await mockDashboard(page, { offers: DISCOUNTED_OFFERS, rewardedItem: true });
  await page.goto("/panel");

  const banner = page.getByTestId("dashboard-top-banner");
  // The promotion leads: a campaign ends, quests are there every day.
  await expect(banner).toContainText(PROMO_TEXT);
  // Rotation (5s) runs for the first time now that two items can coexist.
  await expect(banner).toContainText(QUEST_TEXT, { timeout: 10_000 });

  // Hover pauses it — the quest item is still there a full cycle later.
  await banner.hover();
  await page.waitForTimeout(6_000);
  await expect(banner).toContainText(QUEST_TEXT);
});

test("bir duyuru kapatılınca diğeri ayakta kalır", async ({ page }) => {
  await mockDashboard(page, { offers: DISCOUNTED_OFFERS, rewardedItem: true });
  await page.goto("/panel");

  const banner = page.getByTestId("dashboard-top-banner");
  await expect(banner).toBeVisible();
  // Hover pauses rotation, then we dismiss whatever is actually on screen — so the assertion does
  // not depend on where the 5s rotation happens to be when the click lands.
  await banner.hover();
  const shown = (await banner.innerText()).includes(PROMO_TEXT) ? PROMO_TEXT : QUEST_TEXT;
  const other = shown === PROMO_TEXT ? QUEST_TEXT : PROMO_TEXT;

  await banner.getByRole("button", { name: "Duyuruyu kapat" }).click();

  await expect(banner).toContainText(other);
  await expect(banner).not.toContainText(shown);

  // The dismissal is per item and survives a reload in the same tab.
  await page.reload();
  const reloaded = page.getByTestId("dashboard-top-banner");
  await expect(reloaded).toContainText(other);
  await expect(reloaded).not.toContainText(shown);
});

test("son duyuru da kapatılınca şerit gider ve yenilemede geri gelmez", async ({ page }) => {
  await mockDashboard(page, { offers: DISCOUNTED_OFFERS, rewardedItem: true });
  await page.goto("/panel");

  const banner = page.getByTestId("dashboard-top-banner");
  await expect(banner).toBeVisible();
  await banner.hover();

  await banner.getByRole("button", { name: "Duyuruyu kapat" }).click();
  await expect(banner).toBeVisible(); // one announcement still standing
  await banner.getByRole("button", { name: "Duyuruyu kapat" }).click();

  await expect(page.getByTestId("dashboard-top-banner")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("dashboard-top-banner")).toHaveCount(0);
});

test("promosyon şeridi varken rail kampanya kartı çekilir", async ({ page }) => {
  await mockDashboard(page, { offers: DISCOUNTED_OFFERS });
  await page.goto("/panel");

  // One commercial ask at a time: the specific discount wins over the generic trial card.
  await expect(page.getByTestId("dashboard-top-banner")).toContainText(PROMO_TEXT);
  await expect(page.getByTestId("premium-campaign-banner")).toHaveCount(0);
});

test("promosyon yokken rail kampanya kartı yerinde durur", async ({ page }) => {
  await mockDashboard(page);
  await page.goto("/panel");

  await expect(page.getByTestId("premium-campaign-banner")).toBeVisible();
  await expect(page.getByTestId("dashboard-top-banner")).toHaveCount(0);
});

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: body == null ? "" : JSON.stringify(body),
  });
}

test("kampanya modalı oranı ve kapsamı gösterir, fiyat göstermez", async ({ page }) => {
  await mockDashboard(page, { offers: DISCOUNTED_OFFERS, seenCampaigns: [] });
  await page.goto("/panel");

  const card = page.getByTestId("promotion-card");
  // The title IS the promotion label — no campaign name is hardcoded in the client.
  await expect(card).toContainText("Hoş geldin hediyesi");
  await expect(card).toContainText("%20");
  // Scope, not price: a price would presuppose a plan the user has not chosen.
  await expect(card).toContainText("Tüm planlarda geçerli.");
  await expect(card).toContainText("Ödemende otomatik uygulanır, kod gerekmez.");
  await expect(card).not.toContainText("₺");

  await card.getByRole("button", { name: "Premium’a bak" }).click();
  await expect(page.getByTestId("premium-paywall")).toBeVisible();
});

test("kısıtlı kampanya hangi planda geçerli olduğunu söyler", async ({ page }) => {
  const scoped: PromotionOffersView = {
    offers: {
      "premium-monthly": {
        ...DISCOUNTED_OFFERS.offers["premium-monthly"]!,
        promotion: {
          ...DISCOUNTED_OFFERS.offers["premium-monthly"]!.promotion!,
          id: "promo-scoped",
          planNames: ["Premium 3 Aylık"],
        },
      },
    },
    available: [],
  };
  await mockDashboard(page, { offers: scoped, seenCampaigns: [] });
  await page.goto("/panel");

  // This is the case where showing a price would have been outright wrong.
  await expect(page.getByTestId("promotion-card")).toContainText(
    "Yalnız Premium 3 Aylık için geçerli.",
  );
});

test("kuponlu kampanyada bilet çıkar ve kod paywall'a devredilir", async ({ page }) => {
  const codes: (string | undefined)[] = [];
  await mockDashboard(page, { offers: CODED_CAMPAIGN, seenCampaigns: [], captureCodes: codes });
  await page.goto("/panel");

  const card = page.getByTestId("promotion-card");
  await expect(card).toContainText("Kupon kodun");
  await expect(card).toContainText("HOSGELDIN");

  await card.getByRole("button", { name: "Uygula ve devam et" }).click();
  await expect(page.getByTestId("premium-paywall")).toBeVisible();

  // The user never retypes it: the paywall re-resolves offers WITH the handed-over code.
  await expect(page.getByTestId("premium-paywall")).toContainText("Kupon uygulandı: HOSGELDIN");
  expect(codes).toContain("HOSGELDIN");
});

test("aynı kampanya ikinci yüklemede modal açmaz", async ({ page }) => {
  await mockDashboard(page, { offers: DISCOUNTED_OFFERS, seenCampaigns: [] });
  await page.goto("/panel");
  await expect(page.getByTestId("promotion-card")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("promotion-card")).toHaveCount(0);
});

test("yeni bir kampanya kendi bir kezini alır", async ({ page }) => {
  // The whole reason for keying on campaign id: a single "seen" flag would swallow this one.
  await mockDashboard(page, { offers: SECOND_CAMPAIGN, seenCampaigns: [PROMO_ID] });
  await page.goto("/panel");

  await expect(page.getByTestId("promotion-card")).toContainText("Eylül kampanyası");
});

test("premium kullanıcıya kampanya modalı açılmaz", async ({ page }) => {
  await mockDashboard(page, { offers: DISCOUNTED_OFFERS, premium: true, seenCampaigns: [] });
  await page.goto("/panel");

  await expect(page.getByTestId("dashboard-top-banner")).toHaveCount(0);
  await expect(page.getByTestId("promotion-card")).toHaveCount(0);
});
