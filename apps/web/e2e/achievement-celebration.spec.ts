import { expect, test, type Page, type Route } from "@playwright/test";
import type { AchievementCelebrationDto, AchievementView, AuthUser, PhoneStatusDto } from "@mentor/types";

/**
 * "Işık Yandı", the achievement scene (DESIGN.md §9.1) with motion on. The reduced-motion path is
 * covered next to the journey celebrations (journey-level-celebration.spec.ts).
 */

const user: AuthUser = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "isik@test.local",
  displayName: "Işık Yolcusu",
  username: "isik_yolcusu",
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

function earned(id: AchievementView["id"], title: string): AchievementView {
  return {
    id,
    title,
    description: "QA",
    unlockHint: "QA",
    artKey: id,
    status: "EARNED",
    earnedAt: "2026-09-30T12:00:00.000Z",
    progress: null,
  };
}

const firstStep: AchievementCelebrationDto = {
  kind: "ACHIEVEMENT",
  items: [earned("first_step", "İlk Adım")],
};

const backfill: AchievementCelebrationDto = {
  kind: "BACKFILL_SUMMARY",
  items: [
    earned("first_step", "İlk Adım"),
    earned("route_drawn", "Rotanı Çizdin"),
    earned("rhythm_found", "Ritmi Yakaladın"),
  ],
};

interface SceneApi {
  failClose: boolean;
  readonly closeCalls: number;
}

async function mockSceneApi(page: Page, celebration: AchievementCelebrationDto): Promise<SceneApi> {
  let pending = true;
  let failClose = false;
  let closeCalls = 0;
  const api: SceneApi = {
    get failClose() {
      return failClose;
    },
    set failClose(value) {
      failClose = value;
    },
    get closeCalls() {
      return closeCalls;
    },
  };

  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    class TestEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      close() {}
    }
    Object.defineProperty(window, "EventSource", { configurable: true, value: TestEventSource });
  });

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
    if (method === "GET" && path === "/v1/users/me/phone") {
      return json(route, { verified: false, maskedPhoneNumber: null, available: false, reauthenticationRequired: false } satisfies PhoneStatusDto);
    }
    if (method === "GET" && path === "/v1/users/me/auth-accounts/google") {
      return json(route, { enabled: false, linked: false, providerEmail: null, canLink: false });
    }
    if (method === "GET" && path === "/v1/notifications/preferences") {
      return json(route, { emailEnabled: true, pushEnabled: true });
    }
    if (method === "GET" && path.startsWith("/v1/notifications?")) {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") {
      return json(route, { token: "test-stream" });
    }
    if (method === "GET" && path === "/v1/community/achievements/unseen") {
      return json(route, { celebrations: pending ? [celebration] : [] });
    }
    if (method === "POST" && path.startsWith("/v1/community/achievements/")) {
      closeCalls += 1;
      if (failClose) return json(route, { code: "TEMPORARY_FAILURE" }, 500);
      pending = false;
      return json(route, null, 204);
    }
    if (method === "GET" && path === "/v1/community/journey-levels/unseen") {
      return json(route, { celebrations: [] });
    }
    if (method === "GET" && path.startsWith("/v1/economy/")) {
      return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }
    return json(route, null, 204);
  });

  return api;
}

/** The scene plays by itself: the light gathers, the badge is revealed, the ledge settles. */
const REVEAL = { timeout: 10_000 };

test("sahne kendiliğinden oynar; CTA odağı alır ve tek istekle kapanır", async ({ page }) => {
  const api = await mockSceneApi(page, firstStep);
  await page.goto("/profil");

  const dialog = page.getByRole("dialog", { name: "İlk Adım" });
  await expect(dialog).toBeVisible();
  // Nothing to tap: the dialog holds focus while the light gathers and comes on.
  await expect(dialog).toBeFocused();
  await expect(dialog.getByText("Dokun, ışığı yak")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("hidden");

  const proceed = dialog.getByRole("button", { name: "Devam edelim" });
  await expect(proceed).toBeFocused(REVEAL);
  await expect(dialog.getByText("Yolculuğun başladı")).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("");
  expect(api.closeCalls).toBe(1);

  await page.reload();
  await expect(dialog).toHaveCount(0);
});

test("ışık toplanırken Escape sahneyi tek istekle kapatır", async ({ page }) => {
  const api = await mockSceneApi(page, firstStep);
  await page.goto("/profil");

  const dialog = page.getByRole("dialog", { name: "İlk Adım" });
  await expect(dialog).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(api.closeCalls).toBe(1);
});

test("kapanış başarısız olursa sahne geri gelir ve nedenini söyler", async ({ page }) => {
  const api = await mockSceneApi(page, firstStep);
  await page.goto("/profil");

  const dialog = page.getByRole("dialog", { name: "İlk Adım" });
  const proceed = dialog.getByRole("button", { name: "Devam edelim" });
  await expect(proceed).toBeFocused(REVEAL);

  api.failClose = true;
  await proceed.click();
  await expect(
    dialog.getByText("Kutlamayı şimdilik kapatamadık. Tekrar deneyebilirsin."),
  ).toBeVisible();
  await expect(proceed).toBeFocused();

  api.failClose = false;
  await proceed.click();
  await expect(dialog).toHaveCount(0);
  expect(api.closeCalls).toBe(2);
});

test("geçmiş özeti, yanan ışıkların sayısını söyler", async ({ page }) => {
  const api = await mockSceneApi(page, backfill);
  await page.goto("/profil");

  const dialog = page.getByRole("dialog", { name: "Geçmiş emeklerin de burada" });
  const proceed = dialog.getByRole("button", { name: "Devam edelim" });
  await expect(proceed).toBeFocused(REVEAL);
  await expect(dialog.getByText("3 ışık birden yandı")).toBeVisible();

  await proceed.click();
  await expect(dialog).toHaveCount(0);
  expect(api.closeCalls).toBe(1);
});

const corsHeaders = {
  "access-control-allow-origin": new URL(
    process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100",
  ).origin,
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
