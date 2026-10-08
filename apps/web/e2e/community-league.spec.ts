import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser, LeaderboardEntry, LeaderboardView } from "@mentor/types";

/** Topluluk Tur 2, stop E: Emek panosu became Haftalık lig (list + your card, no podium). */

const user: AuthUser = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "mentor@test.local",
  displayName: "Ada Yılmaz",
  username: "ada",
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"));
});

test("Haftalık lig: senin kartın, tek kartta liste, sekmeye göre başlık; eski adres yönlenir", async ({ page }, testInfo) => {
  const windows = await mockApi(page);
  await page.goto("/topluluk/siralama");

  await expect(page).toHaveURL(/\/topluluk\/lig$/);
  await expect(page.getByRole("heading", { level: 1, name: "Haftalık lig" })).toBeVisible();
  await expect(page.getByText("Ligde 14. sıradasın")).toBeVisible();
  await expect(page.getByText("Harika gidiyorsun, yoldasın!")).toBeVisible();
  const list = page.getByRole("region", { name: "Ligdekiler" });
  await expect(list.getByRole("listitem").first()).toContainText("Selin Aksoy");
  // You sit below the shown places, after the gap, on the tinted row.
  await expect(list.locator('li[aria-current="true"]')).toContainText("Sen");
  await expect(page.locator('img[src*="podium"]')).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await expect(
      page.locator(".community-workspace__sidebar").getByRole("link", { name: "Haftalık lig" }),
    ).toHaveAttribute("aria-current", "page");
  }
  // The card rolls its XP up from 0; shoot the settled number.
  await expect(page.getByText("320 XP", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("league.png"), fullPage: true, animations: "disabled" });

  await page.getByRole("tab", { name: "Bugün" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Bugünün ligi" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Bugün" })).toHaveAttribute("aria-selected", "true");
  expect(windows).toContain("today");

  // Dark theme: the selected window stays readable (it used to be a hard-coded white pill).
  await page.context().addCookies([{ name: "mentor-theme", value: "dark", url: page.url() }]);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Haftalık lig" })).toBeVisible();
  const selected = page.getByRole("tab", { name: "Bu hafta" });
  const [color, background] = await selected.evaluate((el) => {
    const style = getComputedStyle(el);
    return [style.color, getComputedStyle(el.parentElement!).backgroundColor];
  });
  expect(color).not.toBe(background);
  await expect(page.getByText("320 XP", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("league-dark.png"), fullPage: true, animations: "disabled" });
});

const people = [
  ["Selin Aksoy", 1240, "same"],
  ["Can Öztürk", 1115, "up"],
  ["Elif Demir", 980, "down"],
  ["Kerem Polat", 905, "up"],
  ["Mert Arslan", 870, "new"],
] as const;

function entry(rank: number, name: string, xp: number, movement: LeaderboardEntry["movement"], isMe = false): LeaderboardEntry {
  return { rank, userId: `u${rank}`, displayName: name, avatarUrl: null, xp, isMe, movement };
}

function board(window: LeaderboardView["window"]): LeaderboardView {
  return {
    window,
    examType: "KPSS",
    items: people.map(([name, xp, movement], index) => entry(index + 1, name, xp, movement)),
    me: entry(14, "Ada Yılmaz", 320, "up", true),
    totalParticipants: 186,
  };
}

async function mockApi(page: Page) {
  const windows: string[] = [];
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path === "/v1/community/summary") {
      return json(route, { streak: 5, economyEnabled: true, badges: ["marathon", "motivator"], xp: 320, level: null, leaderboard: board("weekly") });
    }
    if (method === "GET" && path === "/v1/community/leaderboard") {
      const window = url.searchParams.get("window") as LeaderboardView["window"];
      windows.push(window);
      return json(route, board(window));
    }
    if (method === "GET" && path === "/v1/forum/zones") return json(route, { items: [], page: 1, pageSize: 100, total: 0 });
    if (method === "GET" && path === "/v1/coaching/today") return json(route, { focusingNow: 38 });
    if (method === "GET" && path.startsWith("/v1/notifications")) {
      if (path.endsWith("/stream")) return route.fulfill({ status: 200, contentType: "text/event-stream", headers: corsHeaders(route), body: "" });
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") return json(route, { token: "test-stream" });
    if (method === "GET" && path.startsWith("/v1/economy/")) return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    return json(route, null, 204);
  });
  return windows;
}

const corsHeaders = (route: Route) => ({
  "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3100",
  "access-control-allow-credentials": "true",
});

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders(route),
    body: body == null ? "" : JSON.stringify(body),
  });
}
