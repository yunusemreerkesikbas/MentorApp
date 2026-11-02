import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser, TodayPanelResponse, WeeklyChestView } from "@mentor/types";
import { IDLE_STREAK } from "./streak.fixture";

/**
 * Weekly chest (spec 2026-11-01 "Masa lambası"): a running week opens the info sheet, a ready
 * chest opens the desk scene (lamps → lid → the week's note), the scene stamps the chest once, and
 * away from the panel a ready chest is announced once with a way back to it.
 * Run: `pnpm --filter @mentor/web exec playwright test -c playwright.weekly-chest.config.ts`.
 */

const API = process.env.QA_STAGE2_API_URL?.trim() || "http://localhost:3502/v1";
const cors = {
  "access-control-allow-origin": process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3512",
  "access-control-allow-credentials": "true",
};

const user: AuthUser = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "chest@test.local",
  displayName: "Deniz Ay",
  username: "deniz_chest",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "KPSS",
  examVariant: null,
  examDate: "2026-09-06",
  dailyFocusGoalMinutes: null,
  careerGroup: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const days = (active: boolean[]): WeeklyChestView["days"] =>
  active.map((on, index) => ({ date: `2026-11-0${index + 2}`, active: on }));

const PROGRESS: WeeklyChestView = {
  state: "PROGRESS",
  periodKey: "2026-W45",
  carriedOver: false,
  current: 3,
  target: 5,
  days: days([true, true, false, true, false, false, false]),
  today: "2026-11-05",
  reward: { unit: "COIN", amount: 15 },
};
const READY: WeeklyChestView = {
  ...PROGRESS,
  state: "READY",
  current: 5,
  days: days([true, true, true, true, true, false, false]),
  // The real UTC day, so the shell's "nothing can change today" memory matches the browser's clock.
  today: new Date().toISOString().slice(0, 10),
  summary: { activeDays: 5, focusSessions: 4, planTasks: 6, focusMinutes: 200 },
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", headers: cors, body: body == null ? "" : JSON.stringify(body) });
}

function today(): TodayPanelResponse {
  return {
    greetingName: user.displayName,
    motivationalLine: "Bugün tek küçük adım bile yeter.",
    countdown: null,
    streak: IDLE_STREAK,
    tasks: [],
    nextAction: { kind: "ADD_TASK", title: "Bugünün tek küçük adımı", message: "Küçük bir adımla başla.", taskId: null },
    sessionPresets: [{ id: "25_5", label: "25 / 5 dk", focusMinutes: 25, breakMinutes: 5 }],
    mood: null,
    focusGoal: { goalMinutes: null, focusMinutesToday: 0 },
    focusingNow: null,
    canLightenPlan: false,
    weeklyRecapPeriod: null,
  };
}

/** Everything the app shell and panel ask for; the chest follows `state.chest`, opening stamps it. */
async function mockApp(page: Page, initial: WeeklyChestView) {
  const state = { chest: initial, chestGets: 0, opens: [] as unknown[] };
  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    window.sessionStorage.setItem("mentor.desktop-coach-fab.nudge-dismissed", "1");
  });
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path === "/v1/notifications") return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    if (method === "GET" && path.startsWith("/v1/notifications/stream")) {
      return route.fulfill({ status: 200, contentType: "text/event-stream", headers: cors, body: "" });
    }
    if (method === "GET" && path.endsWith("/unseen") && path.startsWith("/v1/community/")) return json(route, { celebrations: [] });
    if (method === "GET" && path === "/v1/subscription") {
      return json(route, { subscription: null, entitlement: { tier: "FREE", isPremium: false, validUntil: null, reason: "NONE" }, features: {}, discount: null });
    }
    if (method === "GET" && path === "/v1/coaching/today") return json(route, today());
    if (method === "GET" && path === "/v1/economy/quests") return json(route, []);
    if (method === "GET" && path === "/v1/economy/weekly-chest") {
      state.chestGets += 1;
      return json(route, state.chest);
    }
    if (method === "POST" && path === "/v1/economy/weekly-chest/open") {
      state.opens.push(request.postDataJSON());
      const opened: WeeklyChestView = { ...state.chest, state: "OPENED" };
      // After the stamp the panel moves on to this week's chest, like the API does.
      state.chest = { ...PROGRESS, current: 0, days: days([false, false, false, false, false, false, false]), today: "2026-11-09", periodKey: "2026-W46" };
      return json(route, opened);
    }
    if (method === "GET" && path.startsWith("/v1/economy/")) return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    if (method === "GET" && path.startsWith("/v1/forum/")) return json(route, { code: "FORUM_DISABLED", message: "Kapalı" }, 404);
    return json(route, null, 204);
  });
  return state;
}

test("a running week opens the info sheet with the days that counted", async ({ page }, testInfo) => {
  await mockApp(page, PROGRESS);
  await page.goto("/panel");
  const node = page.getByTestId("today-path-chest");
  await expect(node).toHaveAttribute("data-state", "PROGRESS");
  await expect(node).toHaveAccessibleName("Haftalık sandık, 3/5 gün · 15 Coin");
  await expect(page.getByTestId("panel-chest-row")).toContainText("2 gün kaldı");

  await node.click();
  const sheet = page.getByTestId("weekly-chest-sheet");
  await expect(sheet).toContainText("2 gün daha, sandık açılıyor!");
  await expect(sheet).toContainText("Bir gün sayılır: 1 odak seansı ya da 1 biten plan görevi.");
  await expect(sheet.getByRole("listitem").filter({ hasText: "sayıldı" })).toHaveCount(3);
  await expect(sheet).toContainText("15 Coin");
  await expect(page.getByTestId("weekly-chest-scene")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("chest-sheet.png") });
});

test("a ready chest opens on the desk, stamps once and shows the week's note with its Coin", async ({ page }, testInfo) => {
  const api = await mockApp(page, READY);
  await page.goto("/panel");
  const node = page.getByTestId("today-path-chest");
  await expect(node).toHaveAttribute("data-state", "READY");
  await expect(node).toHaveAccessibleName("Sandığın hazır!, Aç bakalım");
  await expect(page.getByTestId("panel-chest-row")).toContainText("5 gün tamam!");
  await page.screenshot({ path: testInfo.outputPath("chest-panel-ready.png"), fullPage: true });

  await node.click();
  const scene = page.getByTestId("weekly-chest-scene");
  await expect(scene).toHaveAttribute("data-phase", "ready");
  await expect(scene).toContainText("5 gün masadaydın!");
  await expect(scene.getByRole("button", { name: "Sandığı aç" })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("chest-scene-ready.png") });

  await scene.getByRole("button", { name: "Sandığı aç" }).click();
  await expect.poll(() => api.opens).toEqual([{ periodKey: "2026-W45" }]);
  // Headless Chromium has no H.264: the clip is skipped exactly like a refused autoplay.
  await expect(scene).toHaveAttribute("data-phase", "inside", { timeout: 15_000 });
  const note = page.getByTestId("weekly-chest-note");
  await expect(note).toContainText("Bu haftanın emeği");
  for (const line of ["5 gün masadaydın", "4 odak seansı", "6 plan görevi", "3 sa 20 dk odak"]) await expect(note).toContainText(line);
  await expect(scene).toContainText("+15 Coin");
  await expect(scene).toContainText("Hesabına geçti.");
  await expect(scene.getByRole("button", { name: "Devam edelim" })).toBeFocused();
  await page.waitForTimeout(900);
  await page.screenshot({ path: testInfo.outputPath("chest-scene-inside.png") });

  await scene.getByRole("button", { name: "Devam edelim" }).click();
  await expect(scene).toHaveCount(0);
  await expect(page.getByTestId("today-path-chest")).toHaveAttribute("data-state", "PROGRESS");
  expect(api.opens).toHaveLength(1);
});

test("later and Escape leave the chest ready without stamping it", async ({ page }) => {
  const api = await mockApp(page, READY);
  await page.goto("/panel");
  await page.getByTestId("today-path-chest").click();
  const scene = page.getByTestId("weekly-chest-scene");
  await scene.getByRole("button", { name: "Sonra" }).click();
  await expect(scene).toHaveCount(0);
  await expect(page.getByTestId("today-path-chest")).toBeFocused();
  await page.getByTestId("panel-chest-row").click();
  await expect(scene).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(scene).toHaveCount(0);
  expect(api.opens).toEqual([]);
  await expect(page.getByTestId("today-path-chest")).toHaveAttribute("data-state", "READY");
});

test("economy off, reduced motion, carried over: last week's note and Puhu instead of Coin", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockApp(page, { ...READY, carriedOver: true, reward: null, periodKey: "2026-W44" });
  await page.goto("/panel");
  const node = page.getByTestId("today-path-chest");
  await expect(node).toHaveAccessibleName("Geçen haftanın sandığı, Aç bakalım");
  await node.click();
  const scene = page.getByTestId("weekly-chest-scene");
  await expect(scene).toContainText("Geçen hafta 5 gün masadaydın!");
  await scene.getByRole("button", { name: "Sandığı aç" }).click();
  // Reduced motion: no clip at all, straight to the note.
  await expect(scene).toHaveAttribute("data-phase", "inside");
  await expect(scene.locator("video")).toHaveCount(0);
  await expect(page.getByTestId("weekly-chest-note")).toContainText("Geçen haftanın emeği");
  await expect(scene).toContainText("Pazartesi yeni sandık geliyor!");
  await expect(scene).not.toContainText("Coin");
  await page.screenshot({ path: testInfo.outputPath("chest-scene-economy-off.png") });
});

test("away from the panel a ready chest is announced once and the toast opens it", async ({ page }) => {
  const api = await mockApp(page, READY);
  await page.goto("/plan");
  const toast = page.getByText("Haftalık sandığın hazır!");
  await expect(toast).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Aç", exact: true }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByTestId("weekly-chest-scene")).toHaveAttribute("data-phase", "ready");
  await page.keyboard.press("Escape");

  // Heard about once: another page and another day's check stay quiet.
  const gets = api.chestGets;
  await page.goto("/plan");
  await page.waitForTimeout(1500);
  await expect(page.getByText("Haftalık sandığın hazır!")).toHaveCount(0);
  expect(api.chestGets).toBe(gets);
});
