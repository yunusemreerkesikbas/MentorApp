import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

const user: AuthUser = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "profil@test.local",
  displayName: "Profil Test",
  username: "profile_test",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "KPSS",
  examVariant: null,
  examDate: "2026-07-26",
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

test("ayarlar yasal footer bağlantısını AppNav içindeki belgeye açar", async ({ page }) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  await page.goto("/ayarlar");

  const footer = page.getByRole("contentinfo", { name: "Yasal" });
  await expect(footer.getByRole("link")).toHaveCount(7);
  await footer.getByRole("link", { name: "Kullanım Koşulları" }).click();

  await expect(page).toHaveURL(/\/ayarlar\/yasal\/kullanim-kosullari$/);
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await expect(page.getByTestId("app-sidebar")).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Kullanım Koşulları", level: 1 })).toBeVisible();
});

test("hesap silme satırı açıklamayı paylaşılan onay dialogunda gösterir", async ({
  page,
}) => {
  const api = await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  await page.goto("/profil");

  await expect(page.getByRole("heading", { name: "Hesap" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hesabımı sil", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Hesabın ve verilerin kalıcı olarak silinir: koç sohbetlerin, notların, hedef panon ve yüklediğin fotoğraflar. Aktif aboneliğin varsa iptal edilir. Fatura kayıtları yasal saklama yükümlülüğü gereği korunur. Bu işlem geri alınamaz.",
    ),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Hesabımı sil" }).click();

  const dialog = page.getByRole("dialog", { name: "Hesabımı sil" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Hesabımı sil", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(
      "Hesabın ve verilerin kalıcı olarak silinir: koç sohbetlerin, notların, hedef panon ve yüklediğin fotoğraflar. Aktif aboneliğin varsa iptal edilir. Fatura kayıtları yasal saklama yükümlülüğü gereği korunur. Bu işlem geri alınamaz.",
    ),
  ).toBeVisible();
  await expect(api.deleteAccountCalls).toBe(0);

  await page.getByRole("button", { name: "Vazgeç" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(api.deleteAccountCalls).toBe(0);
});

// Guards APP-017's regression: the settings toggle only flipped a flag and no browser was ever
// subscribed, so every push job reached zero endpoints.
test("push anahtarı tarayıcıyı abone edip uç noktayı API'ye kaydeder", async ({ page }) => {
  test.skip(!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, "build has no VAPID public key");
  await mockProfileApi(page);
  const subscriptions: unknown[] = [];
  const preferencePatches: unknown[] = [];
  // Registered after the shared mock, so it answers first and hands everything else back.
  await page.route("http://localhost:3001/v1/notifications/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === "GET" && path === "/v1/notifications/preferences") {
      return json(route, { emailEnabled: true, pushEnabled: false, campaignsEnabled: true });
    }
    if (method === "POST" && path === "/v1/notifications/push-subscriptions") {
      subscriptions.push(request.postDataJSON());
      return json(route, null, 204);
    }
    if (method === "PATCH" && path === "/v1/notifications/preferences") {
      preferencePatches.push(request.postDataJSON());
      return json(route, { emailEnabled: true, pushEnabled: true, campaignsEnabled: true });
    }
    return route.fallback();
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    const endpoint = "https://fcm.googleapis.com/fcm/send/e2e";
    const registration = {
      pushManager: {
        getSubscription: async () => null,
        subscribe: async () => ({
          endpoint,
          toJSON: () => ({ endpoint, keys: { p256dh: "p256dh-e2e", auth: "auth-e2e" } }),
        }),
      },
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "default", requestPermission: async () => "granted" },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: async () => registration,
        getRegistration: async () => undefined,
        ready: Promise.resolve(registration),
      },
    });
  });

  await page.goto("/profil");
  const toggle = page.getByRole("switch", { name: "Push bildirimleri" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(subscriptions).toEqual([
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/e2e",
      keys: { p256dh: "p256dh-e2e", auth: "auth-e2e" },
    },
  ]);
  expect(preferencePatches).toEqual([{ pushEnabled: true }]);
});

test("economy refresh updates the open balance sheet and celebrates ledger rewards once", async ({ page }) => {
  await mockProfileApi(page);
  let xp = 603;
  let coin = 10;
  const rewardId = "44444444-4444-4444-8444-444444444444";
  let rewardAvailable = false;
  let acknowledged = false;
  let acknowledgments = 0;
  const reward = { id: rewardId, amount: 7, unit: "COIN", status: "CONFIRMED", note: null,
    reason: "quest.weekly.effort-allowance", title: "Görev Coin’i", description: "Haftalık emek",
    createdAt: "2026-09-16T12:00:00Z" };
  const level = { tier: 3, xp: 603, nextAt: 1200, key: "compass", chapter: "awakening", currentAt: 600, nextKey: "cycle", progress: { current: 3, target: 600, remaining: 597, percent: 1 } };
  await page.route("http://localhost:3001/v1/economy/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/balance")) return json(route, { xp, coinConfirmed: coin, coinPending: 0, level });
    if (path.endsWith("/quests")) return json(route, []);
    if (path.endsWith("/invite")) return json(route, { code: "MENTOR-TEST" });
    if (path.endsWith("/ledger")) return json(route, rewardAvailable ? [reward] : []);
    if (path.endsWith("/rewards/unseen")) {
      const items = rewardAvailable && !acknowledged ? [reward] : [];
      return json(route, { items, total: items.length, page: 1, pageSize: 20 });
    }
    if (path.endsWith("/rewards/seen")) {
      expect(route.request().postDataJSON()).toEqual({ ledgerIds: [rewardId] });
      acknowledged = true;
      acknowledgments += 1;
      return json(route, null, 204);
    }
    return route.fallback();
  });
  await page.addInitScript(() => {
    localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    (window as unknown as { coinRewards: number[] }).coinRewards = [];
    window.addEventListener("mentor:coin-celebrate", (event) => {
      (window as unknown as { coinRewards: number[] }).coinRewards.push((event as CustomEvent).detail.amount);
    });
  });
  await page.goto("/profil");
  await page.getByRole("button", { name: "Bakiyen", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("603", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { coinRewards: number[] }).coinRewards)).toEqual([]);
  xp = 608;
  coin = 17;
  rewardAvailable = true;
  await page.evaluate(() => window.dispatchEvent(new Event("mentor:economy-changed")));
  await expect(sheet.getByText("608", { exact: true })).toBeVisible();
  await expect(sheet.getByText("17", { exact: true })).toBeVisible();
  await expect.poll(() => acknowledgments).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { coinRewards: number[] }).coinRewards)).toEqual([7]);
  await page.evaluate(() => window.dispatchEvent(new Event("mentor:economy-changed")));
  await expect.poll(() => acknowledged).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { coinRewards: number[] }).coinRewards)).toEqual([7]);
});

async function mockProfileApi(page: Page) {
  let deleteAccountCalls = 0;

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
    // The Google card reads `.enabled` off this body; the empty catch-all 204 crashed the page.
    if (method === "GET" && path === "/v1/users/me/auth-accounts/google") {
      return json(route, { enabled: false, linked: false, providerEmail: null, canLink: false });
    }
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
    if (method === "GET" && path.startsWith("/v1/notifications/stream?")) {
      return route.fulfill({ status: 200, contentType: "text/event-stream", headers: corsHeaders, body: "" });
    }
    if (method === "GET" && path === "/v1/notifications/preferences") {
      return json(route, { emailEnabled: true, pushEnabled: true });
    }
    if (method === "GET" && path.startsWith("/v1/economy/")) {
      return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }
    if (method === "DELETE" && path === "/v1/account") {
      deleteAccountCalls += 1;
      return json(route, null, 204);
    }

    return json(route, null, 204);
  });

  return {
    get deleteAccountCalls() {
      return deleteAccountCalls;
    },
  };
}

const corsHeaders = {
  "access-control-allow-origin": process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
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
