import { expect, test, type Page, type Route } from "../../../apps/web/node_modules/@playwright/test";
import type {
  AuthUser,
  MoodCheckinDto,
  PlanTaskDto,
  QuestProgressView,
  TodayPanelResponse,
  CommunityLevelView,
} from "../../../packages/types/src/index";
import { IDLE_STREAK } from "../../../apps/web/e2e/streak.fixture";
import { visionWithBoard } from "../../../apps/web/e2e/vision-board-editor.fixture";

/**
 * The "Bugün" panel (APP-103 Faz 2): one tap on the greeting row checks in, a path node opens a
 * small menu instead of acting on the tap, an empty day has exactly one way forward, and on a
 * phone the day's quests follow the hero directly.
 */

const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "panel@test.local",
  displayName: "Selin Kaya",
  username: "selin_panel",
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

function task(id: string, title: string, status: PlanTaskDto["status"]): PlanTaskDto {
  return {
    id,
    title,
    subject: null,
    topic: null,
    status,
    sortOrder: 0,
    taskDate: "2026-09-21",
    startTime: null,
    endTime: null,
    description: null,
    coachNote: null,
    origin: null,
    assignmentGroupId: null,
    durationMinutes: null,
    sessionFocusMinutes: 25,
  };
}

const FIRST_TASK = "55555555-5555-4555-8555-555555555555";
const SECOND_TASK = "66666666-6666-4666-8666-666666666666";

function today(tasks: PlanTaskDto[]): TodayPanelResponse {
  return {
    greetingName: user.displayName,
    motivationalLine: "Bugün tek küçük adım bile yeter.",
    countdown: null,
    streak: IDLE_STREAK,
    tasks,
    nextAction: {
      kind: tasks.length === 0 ? "ADD_TASK" : "START_TASK",
      title: "Bugünün tek küçük adımı",
      message: "Küçük bir adımla başla.",
      taskId: tasks[0]?.id ?? null,
    },
    sessionPresets: [{ id: "25_5", label: "25 / 5 dk", focusMinutes: 25, breakMinutes: 5 }],
    mood: null,
    focusGoal: { goalMinutes: null, focusMinutesToday: 0 },
    focusingNow: null,
    weeklyRecapPeriod: null,
  };
}

const QUESTS: QuestProgressView[] = [
  {
    id: "daily.plan-task-completed",
    category: "daily_ritual",
    period: "daily",
    periodKey: "2026-09-21",
    type: "DAILY_RITUAL",
    title: "Planından 1 görev tamamla",
    badgeLabel: "Günlük",
    action: "plan",
    rewardUnit: "XP",
    rewardAmount: 5,
    rewardCoin: 0,
    completed: false,
    completedAt: null,
  },
];

const corsHeaders = {
  "access-control-allow-origin": process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3100",
  "access-control-allow-credentials": "true",
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: body == null ? "" : JSON.stringify(body),
  });
}

async function mockPanel(page: Page, initialTasks: PlanTaskDto[]) {
  const tasks = initialTasks.map((item) => ({ ...item }));
  const moodBodies: unknown[] = [];
  const taskPatches: { id: string; body: unknown }[] = [];

  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    window.sessionStorage.setItem("mentor.desktop-coach-fab.nudge-dismissed", "1");
  });
  await page.route(`${process.env.QA_STAGE2_API_URL?.trim() || "http://localhost:3001/v1"}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path === "/v1/notifications") {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
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
    if (method === "GET" && path === "/v1/subscription") {
      return json(route, {
        subscription: null,
        entitlement: { tier: "FREE", isPremium: false, validUntil: null, reason: "NONE" },
        features: {},
        discount: null,
      });
    }
    if (method === "GET" && path === "/v1/coaching/today") {
      return json(route, today(tasks));
    }
    if (method === "PATCH" && path.startsWith("/v1/plan-tasks/")) {
      const id = path.split("/").pop()!;
      const body = request.postDataJSON() as { status: PlanTaskDto["status"] };
      taskPatches.push({ id, body });
      const target = tasks.find((item) => item.id === id);
      if (target) target.status = body.status;
      return json(route, target);
    }
    if (method === "POST" && path === "/v1/coaching/mood-checkins") {
      const body = request.postDataJSON() as { mood: number };
      moodBodies.push(body);
      const saved: MoodCheckinDto = {
        checkinDate: "2026-09-21",
        mood: body.mood,
        code: "GOOD",
        message: "Güzel bir enerji. Bugün sıradaki adımı rahatça atarsın.",
        struggleNote: null,
        aiReflection: null,
      };
      return json(route, saved);
    }
    if (method === "GET" && path === "/v1/economy/quests") return json(route, QUESTS);
    if (method === "GET" && path.startsWith("/v1/economy/")) {
      return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }
    if (method === "GET" && path.startsWith("/v1/forum/")) {
      return json(route, { code: "FORUM_DISABLED", message: "Kapalı" }, 404);
    }
    if (method === "GET" && path === "/v1/coaching/vision") return json(route, null);
    return json(route, null, 204);
  });

  return { moodBodies, taskPatches };
}

test("closed responses hide economy on fresh page while core dashboard remains usable", async ({ page }) => {
  const calls: string[] = [];
  const api = await mockPanel(page, [task(FIRST_TASK, "Paragraf: 20 soru", "PENDING")]);
  await page.route("**/v1/economy/**", route => { calls.push(new URL(route.request().url()).pathname); return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404); });
  await page.goto("/panel");
  await expect(page.getByTestId("today-path-card")).toBeVisible();
  await expect(page.getByTestId("panel-quests-card")).toHaveCount(0);
  await expect(page.getByLabel("Coin ve XP", { exact: true })).toHaveCount(0);
  await page.getByTestId("today-path-node").first().click();
  await page.getByRole("menuitem", { name: "Bitti olarak işaretle" }).click();
  await expect.poll(() => api.taskPatches.length).toBe(1);
  await expect(page.getByTestId("today-path-node").first()).toHaveAccessibleName(/bitti/);
  await expect(page.getByTestId("panel-quests-card")).toHaveCount(0);
  console.log("CLOSED PAGE: core task works, no economy pills/card; disabled requests still emitted:", [...new Set(calls)]);
});

test("reproduces stale XP promise in an open quest sheet after economy closes", async ({ page }, testInfo) => {
  let enabled = true;
  await mockPanel(page, [task(FIRST_TASK, "Paragraf: 20 soru", "PENDING")]);
  await page.route("**/v1/economy/quests", route => json(route, enabled ? QUESTS : { code: "ECONOMY_DISABLED", message: "Kapalı" }, enabled ? 200 : 404));
  await page.goto("/panel");
  await page.getByRole("button", { name: "Tüm görevler", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("+5 XP");
  enabled = false;
  const closed = page.waitForResponse(response => response.url().endsWith("/v1/economy/quests") && response.status() === 404);
  await page.evaluate(() => window.dispatchEvent(new Event("mentor:economy-changed")));
  await closed;
  await expect(sheet).toContainText("+5 XP");
  await page.screenshot({ path: testInfo.outputPath("closed-economy-stale-quest.png") });
  console.log("REPRO: economy quests return ECONOMY_DISABLED, open sheet still displays +5 XP.");
});
