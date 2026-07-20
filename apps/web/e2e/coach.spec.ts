import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  CoachAccessDto,
  CoachConversationDto,
  CoachMessageDto,
  TodayPanelResponse,
} from "@mentor/types";

const taskId = "33333333-3333-4333-8333-333333333333";
const conversationId = "44444444-4444-4444-8444-444444444444";

const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "coach@test.local",
  displayName: "Koç Test",
  username: "coach_test",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "KPSS",
  examDate: "2026-09-06",
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const accessNone: CoachAccessDto = {
  canChat: false,
  mode: "NONE",
  reason: "PAYMENT_PREMIUM_REQUIRED",
};

const pendingToday: TodayPanelResponse = {
  greetingName: "Koç Test",
  motivationalLine: "Bugün tek bir adım yeter.",
  countdown: null,
  streak: { currentStreak: 0, longestStreak: 0, freezeTokens: 2 },
  tasks: [
    {
      id: taskId,
      title: "Türkçe: 20 paragraf sorusu",
      subject: "Türkçe",
      status: "PENDING",
      sortOrder: 0,
      taskDate: "2026-07-20",
    },
  ],
  nextAction: {
    kind: "START_TASK",
    title: "Bugünün tek küçük adımı",
    message: "Türkçe göreviyle sakin bir başlangıç yapabilirsin.",
    taskId,
  },
  sessionPresets: [
    { id: "25_5", label: "25 / 5 dk", focusMinutes: 25, breakMinutes: 5 },
  ],
  mood: null,
  focusGoal: { goalMinutes: null, focusMinutesToday: 0 },
  focusingNow: null,
};

test("Free hub erişim hydration'ını beklemeden pending görevi seansa taşır", async ({
  page,
}) => {
  const api = await mockCoachApi(page, {
    today: pendingToday,
    accessDelayMs: 1_200,
  });

  await page.goto("/koc");

  const card = page.getByTestId("coach-next-action");
  await expect(card.getByText("Bugünün tek küçük adımı")).toBeVisible();
  const start = card.getByRole("link", { name: "Odak seansına başla" });
  await expect(start).toHaveAttribute("href", /\/seans\?.*source=coach/);
  await expect(start).toHaveAttribute("href", new RegExp(`taskId=${taskId}`));
  expect(api.conversationCalls).toBe(0);
});

test("boş plan için görev ekleme aksiyonunu gösterir", async ({ page }) => {
  const emptyToday: TodayPanelResponse = {
    ...pendingToday,
    tasks: [],
    nextAction: {
      kind: "ADD_TASK",
      title: "Bugünün tek küçük adımı",
      message: "Bugün için küçük bir görev ekleyebilirsin.",
      taskId: null,
    },
  };
  await mockCoachApi(page, { today: emptyToday });
  await page.goto("/koc");
  await expect(
    page
      .getByTestId("coach-next-action")
      .getByRole("link", { name: "Planına görev ekle" }),
  ).toHaveAttribute("href", /\/plan\?add=1&source=coach/);
});

test("tamamlanmış günü yeni çalışma baskısı olmadan kutlar", async ({
  page,
}) => {
  const completedToday: TodayPanelResponse = {
    ...pendingToday,
    tasks: [{ ...pendingToday.tasks[0]!, status: "DONE" }],
    nextAction: {
      kind: "DAY_COMPLETE",
      title: "Bugün tamam",
      message: "Bugünkü emeğin yeterli. Şimdi dinlenebilirsin.",
      taskId: null,
    },
  };
  await mockCoachApi(page, { today: completedToday });
  await page.goto("/koc");
  const completedCard = page.getByTestId("coach-next-action");
  await expect(
    completedCard.getByText("Bugünkü emeğin yeterli. Şimdi dinlenebilirsin."),
  ).toBeVisible();
  await expect(completedCard.getByRole("link")).toHaveCount(0);
});

test("chat hakkı olmayan kullanıcıyı yalnız chat rotasında gate ile karşılar", async ({
  page,
}) => {
  const api = await mockCoachApi(page, { today: pendingToday });

  await page.goto("/koc/sohbet");

  await expect(page.getByText("AI koç seninle", { exact: true })).toBeVisible();
  await expect(page.getByTestId("coach-next-action")).toHaveCount(0);
  expect(api.todayCalls).toBe(0);
});

test("persisted resmî countdown kartını history yüklemesinden sonra yeniden gösterir", async ({
  page,
}) => {
  const conversations: CoachConversationDto[] = [
    {
      id: conversationId,
      title: "KPSS sınav tarihi",
      lastMessageAt: "2026-07-20T09:01:00.000Z",
      messageCount: 2,
    },
  ];
  const messages: CoachMessageDto[] = [
    {
      id: "66666666-6666-4666-8666-666666666666",
      role: "COACH",
      content: "Resmî sınav tarihini doğrulanmış kartta görebilirsin.",
      sources: [],
      feedback: null,
      createdAt: "2026-07-20T09:01:00.000Z",
      officialCountdown: {
        examType: "KPSS",
        examName: "KPSS Lisans 2026",
        daysRemaining: 48,
        examDateLabel: "6 Eylül 2026",
        source: "ÖSYM",
        sourceUrl: "https://www.osym.gov.tr",
      },
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      role: "USER",
      content: "KPSS sınavı ne zaman?",
      sources: [],
      feedback: null,
      createdAt: "2026-07-20T09:00:00.000Z",
    },
  ];
  await mockCoachApi(page, {
    today: pendingToday,
    access: { canChat: true, mode: "PREMIUM", dailyMessagesRemaining: 10 },
    conversations,
    messages,
  });

  await page.goto(`/koc/sohbet?c=${conversationId}`);

  await expect(page.getByText("48 gün", { exact: true })).toBeVisible();
  await expect(
    page.getByText("KPSS Lisans 2026 · 6 Eylül 2026", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "ÖSYM ↗" })).toHaveAttribute(
    "href",
    "https://www.osym.gov.tr",
  );
});

interface MockCoachOptions {
  today: TodayPanelResponse;
  access?: CoachAccessDto;
  accessDelayMs?: number;
  conversations?: CoachConversationDto[];
  messages?: CoachMessageDto[];
}

async function mockCoachApi(page: Page, options: MockCoachOptions) {
  let todayCalls = 0;
  let conversationCalls = 0;

  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
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
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: corsHeaders,
        body: "",
      });
    }
    if (method === "GET" && path.startsWith("/v1/economy/")) {
      return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }
    if (method === "GET" && path === "/v1/coach/access") {
      if (options.accessDelayMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, options.accessDelayMs),
        );
      }
      return json(route, options.access ?? accessNone);
    }
    if (method === "GET" && path === "/v1/coaching/today") {
      todayCalls += 1;
      return json(route, options.today);
    }
    if (method === "GET" && path === "/v1/coach/memory")
      return json(route, null);
    if (
      method === "GET" &&
      path === "/v1/coach/conversations?page=1&pageSize=20"
    ) {
      conversationCalls += 1;
      const items = options.conversations ?? [];
      return json(route, { items, total: items.length, page: 1, pageSize: 20 });
    }
    if (
      method === "GET" &&
      path ===
        `/v1/coach/conversations/${conversationId}/messages?page=1&pageSize=30`
    ) {
      const items = options.messages ?? [];
      return json(route, { items, total: items.length, page: 1, pageSize: 30 });
    }

    return json(
      route,
      { code: "TEST_UNEXPECTED_REQUEST", message: `${method} ${path}` },
      501,
    );
  });

  return {
    get todayCalls() {
      return todayCalls;
    },
    get conversationCalls() {
      return conversationCalls;
    },
  };
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
