import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  JourneyLevelCelebrationView,
} from "@mentor/types";

const user: AuthUser = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "journey@test.local",
  displayName: "Gece Yolcusu",
  username: "gece_yolcusu",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "KPSS",
  examVariant: null,
  examDate: "2027-07-25",
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const introduction: JourneyLevelCelebrationView = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "INTRODUCTION",
  tier: 4,
  key: "cycle",
  chapter: "harmony",
  unlockedAt: "2026-08-22T10:00:00.000Z",
};

const levelUp: JourneyLevelCelebrationView = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "LEVEL_UP",
  tier: 5,
  key: "rhythm",
  chapter: "harmony",
  unlockedAt: "2026-08-22T11:00:00.000Z",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");

    class TestEventSource {
      static readonly CLOSED = 2;
      readonly readyState = 1;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor() {
        const testWindow = window as typeof window & {
          __journeyEventSources?: TestEventSource[];
        };
        testWindow.__journeyEventSources ??= [];
        testWindow.__journeyEventSources.push(this);
      }

      close() {}
    }

    Object.defineProperty(window, "EventSource", {
      configurable: true,
      value: TestEventSource,
    });
  });
});

test("tanışmayı bir kez gösterir; hata, odak ve scroll davranışlarını korur", async ({
  page,
}) => {
  const api = await mockJourneyCelebrationApi(page, introduction);
  await page.goto("/profil");

  const dialog = page.getByRole("dialog", { name: "Seviye 4 · Döngü" });
  const continueButton = dialog.getByRole("button", {
    name: "Devam et",
  });
  const closeButton = dialog.getByRole("button", { name: "Kapat" });

  await expect(dialog).toBeVisible();
  await expect(continueButton).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("hidden");

  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(continueButton).toBeFocused();

  api.failAcknowledgement = true;
  await continueButton.click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(
      "Kutlamayı şimdilik kapatamadık. Tekrar deneyebilirsin.",
    ),
  ).toBeVisible();

  api.failAcknowledgement = false;
  await continueButton.click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("");

  await page.reload();
  await expect(dialog).toHaveCount(0);
  expect(api.acknowledgementCalls).toBe(2);
});

test("canlı SSE sinyali seviyeyi açar ve kapanınca önceki odağı geri verir", async ({
  page,
}) => {
  const api = await mockJourneyCelebrationApi(page, null);
  await page.goto("/profil");

  const previousFocus = page.locator("button:visible").first();
  await previousFocus.focus();
  await expect(previousFocus).toBeFocused();

  api.celebration = levelUp;
  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __journeyEventSources?: Array<{
        onmessage: ((event: MessageEvent) => void) | null;
      }>;
    };
    testWindow.__journeyEventSources?.forEach((source) =>
      source.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ event: "journey_level_unlocked" }),
        }),
      ),
    );
  });

  const dialog = page.getByRole("dialog", {
    name: "Seviye 5 · Nabız",
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Devam et" }),
  ).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(1);

  await dialog.getByRole("button", { name: "Devam et" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(previousFocus).toBeFocused();
});

test("kaçırılan canlı sinyali sonraki açılışta kalıcı kaynaktan toparlar", async ({
  page,
}) => {
  await mockJourneyCelebrationApi(page, levelUp);
  await page.goto("/profil");

  await expect(
    page.getByRole("dialog", { name: "Seviye 5 · Nabız" }),
  ).toBeVisible();
});

interface JourneyCelebrationApi {
  celebration: JourneyLevelCelebrationView | null;
  failAcknowledgement: boolean;
  readonly acknowledgementCalls: number;
}

async function mockJourneyCelebrationApi(
  page: Page,
  initialCelebration: JourneyLevelCelebrationView | null,
): Promise<JourneyCelebrationApi> {
  let celebration = initialCelebration;
  let failAcknowledgement = false;
  let acknowledgementCalls = 0;

  const state: JourneyCelebrationApi = {
    get celebration() {
      return celebration;
    },
    set celebration(value) {
      celebration = value;
    },
    get failAcknowledgement() {
      return failAcknowledgement;
    },
    set failAcknowledgement(value) {
      failAcknowledgement = value;
    },
    get acknowledgementCalls() {
      return acknowledgementCalls;
    },
  };

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname + url.search;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path.startsWith("/v1/notifications?")) {
      return json(route, {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        unreadCount: 0,
      });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") {
      return json(route, { token: "test-stream" });
    }
    if (method === "GET" && path === "/v1/notifications/preferences") {
      return json(route, { emailEnabled: true, pushEnabled: true });
    }
    if (method === "GET" && path === "/v1/community/achievements/unseen") {
      return json(route, { celebrations: [] });
    }
    if (
      method === "GET" &&
      path === "/v1/community/journey-levels/unseen"
    ) {
      return json(route, { celebrations: celebration ? [celebration] : [] });
    }
    if (
      method === "POST" &&
      path === "/v1/community/journey-levels/celebrated"
    ) {
      acknowledgementCalls += 1;
      if (failAcknowledgement) {
        return json(route, { code: "TEMPORARY_FAILURE" }, 500);
      }
      celebration = null;
      return json(route, null, 204);
    }
    if (method === "GET" && path.startsWith("/v1/economy/")) {
      return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }

    return json(route, null, 204);
  });

  return state;
}

const corsHeaders = {
  "access-control-allow-origin": "http://localhost:3100",
  "access-control-allow-credentials": "true",
};

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: body == null ? "" : JSON.stringify(body),
  });
}
