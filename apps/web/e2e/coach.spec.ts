import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
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
  examVariant: null,
  examDate: "2026-09-06",
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

/**
 * Returns the history surface for the current viewport and makes sure it is open.
 *
 * Both surfaces are always mounted (the rail is `hidden lg:flex`, the drawer is `lg:hidden`), so
 * conversation titles and history errors match twice in the DOM — assertions MUST be scoped to the
 * returned locator or they hit a strict-mode violation. Desktop needs no click: the rail starts
 * expanded.
 */
async function openHistory(page: Page): Promise<Locator> {
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    return page.getByTestId("coach-history-rail");
  }
  await page.getByTestId("coach-history-open").click();
  return page.getByTestId("coach-history-drawer");
}

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
      startTime: null,
      endTime: null,
      description: null,
      origin: null,
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
  weeklyRecapPeriod: null,
};

test("landing next-action chip pending görevi seansa taşır", async ({
  page,
}) => {
  const api = await mockCoachApi(page, {
    today: pendingToday,
    access: { canChat: true, mode: "PREMIUM", dailyMessagesRemaining: 10 },
  });

  await page.goto("/koc");
  await expect(page).toHaveURL(/\/koc\/sohbet/);
  await expect(page.getByTestId("coach-empty-landing")).toBeVisible();

  const chip = page.getByTestId("coach-next-action-chip");
  await expect(chip).toHaveText("Odak seansına başla");
  await expect(chip).toHaveAttribute("href", /\/seans\?.*source=coach/);
  await expect(chip).toHaveAttribute("href", new RegExp(`taskId=${taskId}`));
  expect(api.todayCalls).toBeGreaterThanOrEqual(1);
  expect(api.dailyGreetingCalls).toBe(0);
});

test("dashboard ve koç landing aynı aksiyonu gösterir; dashboard bugün verisini yalnız bir kez ister", async ({
  page,
  context,
}) => {
  const dashboardApi = await mockCoachApi(page, { today: pendingToday });
  await page.goto("/panel");

  const dashboardCard = page.getByTestId("coach-next-action");
  await expect(
    dashboardCard.getByText(pendingToday.nextAction.message),
  ).toBeVisible();
  await expect(
    dashboardCard.getByRole("link", { name: "Odak seansına başla" }),
  ).toHaveAttribute("href", /source=dashboard/);
  expect(dashboardApi.todayCalls).toBe(1);
  expect(dashboardApi.dailyGreetingCalls).toBe(1);

  const coachPage = await context.newPage();
  const coachApi = await mockCoachApi(coachPage, {
    today: pendingToday,
    access: { canChat: true, mode: "PREMIUM", dailyMessagesRemaining: 10 },
  });
  await coachPage.goto("/koc/sohbet");
  await expect(coachPage.getByTestId("coach-next-action-chip")).toHaveAttribute(
    "href",
    /source=coach/,
  );
  expect(coachApi.todayCalls).toBe(1);
  expect(coachApi.dailyGreetingCalls).toBe(0);
});

test("dashboard recap teaser'ını aynı cihazda haftada bir gösterir", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "mentor_mood_prompt_deferred_date",
      new Date().toISOString().slice(0, 10),
    );
  });
  const period = {
    examId: "exam-recap-1",
    startDate: "2026-07-13",
    endDate: "2026-07-19",
    timeZone: "Europe/Istanbul" as const,
    status: "READY" as const,
  };
  const api = await mockCoachApi(page, {
    today: { ...pendingToday, weeklyRecapPeriod: period },
  });
  await page.goto("/panel");

  const teaser = page.getByTestId("weekly-recap-teaser-dashboard");
  await expect(teaser).toBeVisible();
  const todayCallsBeforeOpen = api.todayCalls;
  const open = teaser.getByRole("link", { name: "Hikâyeyi aç" });
  await open.evaluate((element) =>
    element.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    }),
  );
  await open.click();
  await expect(teaser).toHaveCount(0);
  expect(api.todayCalls).toBe(todayCallsBeforeOpen);
  await expect
    .poll(() =>
      page.evaluate(
        (startDate) =>
          window.localStorage.getItem(
            `mentor.weekly-recap.opened.v2:${startDate}`,
          ),
        period.startDate,
      ),
    )
    .toBe("1");

  await page.reload();
  await expect(page.getByTestId("weekly-recap-teaser-dashboard")).toHaveCount(
    0,
  );
  expect(api.todayCalls).toBeGreaterThan(todayCallsBeforeOpen);
});

test("boş plan için görev ekleme chip'ini gösterir", async ({ page }) => {
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
  await mockCoachApi(page, {
    today: emptyToday,
    access: { canChat: true, mode: "PREMIUM", dailyMessagesRemaining: 10 },
  });
  await page.goto("/koc/sohbet");
  await expect(page.getByTestId("coach-next-action-chip")).toHaveAttribute(
    "href",
    /\/plan\?add=1&source=coach/,
  );
  await expect(page.getByTestId("coach-next-action-chip")).toHaveText(
    "Planına görev ekle",
  );
});

test("tamamlanmış günde next-action chip göstermez", async ({ page }) => {
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
  await mockCoachApi(page, {
    today: completedToday,
    access: { canChat: true, mode: "PREMIUM", dailyMessagesRemaining: 10 },
  });
  await page.goto("/koc/sohbet");
  await expect(page.getByTestId("coach-empty-landing")).toBeVisible();
  await expect(page.getByTestId("coach-next-action-chip")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Bugün nasıl çalışmalıyım?" }),
  ).toBeVisible();
});

test("chat hakkı olmayan kullanıcıyı yalnız chat rotasında gate ile karşılar", async ({
  page,
}) => {
  const api = await mockCoachApi(page, { today: pendingToday });

  await page.goto("/koc/sohbet");

  await expect(page.getByText("AI koç seninle", { exact: true })).toBeVisible();
  await expect(page.getByTestId("coach-next-action-chip")).toHaveCount(0);
  await expect(page.getByTestId("coach-empty-landing")).toHaveCount(0);
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
      origin: null,
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

test("conversation list hatasını gerçek boş durumdan ayırır ve retry eder", async ({
  page,
}) => {
  const api = await mockCoachApi(page, {
    today: pendingToday,
    access: { canChat: true, mode: "PREMIUM", dailyMessagesRemaining: 10 },
    conversationFailures: 1,
    conversations: [
      {
        id: conversationId,
        title: "Devam eden sohbet",
        lastMessageAt: "2026-07-20T09:01:00.000Z",
        messageCount: 2,
        origin: null,
      },
    ],
  });

  await page.goto("/koc/sohbet");
  const history = await openHistory(page);

  await expect(
    history.getByText("Sohbetlerin şu an yüklenemedi."),
  ).toBeVisible();
  api.allowConversations();
  await history.getByRole("button", { name: "Tekrar dene" }).click();
  await expect(history.getByText("Devam eden sohbet")).toBeVisible();
});

test("history hatasında composerı kilitler ve retry sonrası konuşmayı açar", async ({
  page,
}) => {
  await mockCoachApi(page, {
    today: pendingToday,
    access: { canChat: true, mode: "PREMIUM", dailyMessagesRemaining: 10 },
    messageFailures: 1,
    messages: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        role: "COACH",
        content: "Tekrar buradayım.",
        sources: [],
        feedback: null,
        createdAt: "2026-07-20T09:01:00.000Z",
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        role: "USER",
        content: "Devam edelim.",
        sources: [],
        feedback: null,
        createdAt: "2026-07-20T09:00:00.000Z",
      },
    ],
  });

  await page.goto("/koc/sohbet?c=" + conversationId);

  await expect(
    page.getByText("Sohbet geçmişi şu an yüklenemedi."),
  ).toBeVisible();
  await expect(page.getByLabel("Koçuna mesaj yaz")).toBeDisabled();
  await page.getByRole("button", { name: "Tekrar dene" }).click();
  await expect(page.getByText("Tekrar buradayım.")).toBeVisible();
  await expect(page.getByLabel("Koçuna mesaj yaz")).toBeEnabled();
});
test("eski mesajları sırayla başa ekler ve görünür konumu korur", async ({
  page,
}) => {
  const recentMessages = makeRecentMessages();
  const oldUser: CoachMessageDto = {
    id: "99999999-9999-4999-8999-999999999999",
    role: "USER",
    content: "En eski soru",
    sources: [],
    feedback: null,
    createdAt: "2026-07-01T10:00:00.000Z",
  };
  const oldCoach: CoachMessageDto = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    role: "COACH",
    content: "En eski yanıt",
    sources: [],
    feedback: null,
    createdAt: "2026-07-01T10:01:00.000Z",
  };

  await mockCoachApi(page, {
    today: pendingToday,
    access: { canChat: true, mode: "PREMIUM", dailyMessagesRemaining: 10 },
    messagePages: {
      1: recentMessages,
      2: [oldCoach, oldUser, recentMessages[0]!],
    },
    messageTotal: 32,
  });

  await page.goto("/koc/sohbet?c=" + conversationId);
  const loadOlder = page.getByRole("button", {
    name: "Daha eski mesajları yükle",
  });
  await expect(loadOlder).toBeVisible();
  await loadOlder.scrollIntoViewIfNeeded();

  const anchor = page.getByText(/Yakın geçmiş ankrajı/);
  const before = await anchor.boundingBox();
  await loadOlder.click();

  await expect(page.getByText("En eski soru", { exact: true })).toHaveCount(1);
  await expect(page.getByText("En eski yanıt", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Yakın geçmiş 0", { exact: false })).toHaveCount(
    1,
  );
  const transcript = await page
    .getByRole("log", { name: "Koç sohbeti" })
    .textContent();
  expect(transcript?.indexOf("En eski soru")).toBeLessThan(
    transcript?.indexOf("En eski yanıt") ?? -1,
  );

  const after = await anchor.boundingBox();
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(20);
});

test("eski sayfa hatasında görünür geçmişi korur ve yeniden dener", async ({
  page,
}) => {
  const recentMessages = makeRecentMessages();
  await mockCoachApi(page, {
    today: pendingToday,
    access: { canChat: true, mode: "PREMIUM", dailyMessagesRemaining: 10 },
    messagePages: {
      1: recentMessages,
      2: [
        {
          id: "abababab-abab-4bab-8bab-abababababab",
          role: "USER",
          content: "Retry ile gelen eski mesaj",
          sources: [],
          feedback: null,
          createdAt: "2026-07-01T08:00:00.000Z",
        },
      ],
    },
    messageTotal: 31,
    olderMessageFailures: 1,
  });

  await page.goto("/koc/sohbet?c=" + conversationId);
  const loadOlder = page.getByRole("button", {
    name: "Daha eski mesajları yükle",
  });
  await loadOlder.click();

  await expect(page.getByText("Daha eski mesajlar yüklenemedi.")).toBeVisible();
  await expect(page.getByText(/Yakın geçmiş ankrajı/)).toBeVisible();
  await expect(page.getByLabel("Koçuna mesaj yaz")).toBeEnabled();

  await loadOlder.click();
  await expect(page.getByText("Retry ile gelen eski mesaj")).toBeVisible();
});
test("eski sayfa yüklenirken sohbet değişince loading durumunu temizler", async ({
  page,
}) => {
  const firstConversationId = "12121212-1212-4212-8212-121212121212";
  const secondConversationId = "34343434-3434-4434-8434-343434343434";
  await mockCoachApi(page, {
    today: pendingToday,
    access: { canChat: true, mode: "PREMIUM", dailyMessagesRemaining: 10 },
    conversations: [
      {
        id: firstConversationId,
        title: "Sayfalı sohbet",
        lastMessageAt: "2026-07-20T09:00:00.000Z",
        messageCount: 31,
        origin: null,
      },
      {
        id: secondConversationId,
        title: "Hızlı sohbet",
        lastMessageAt: "2026-07-20T08:00:00.000Z",
        messageCount: 1,
        origin: null,
      },
    ],
    messagePagesByConversation: {
      [firstConversationId]: {
        1: makeRecentMessages(),
        2: [
          {
            id: "56565656-5656-4656-8656-565656565656",
            role: "USER",
            content: "Geciken eski mesaj",
            sources: [],
            feedback: null,
            createdAt: "2026-07-01T08:00:00.000Z",
          },
        ],
      },
      [secondConversationId]: {
        1: [
          {
            id: "78787878-7878-4878-8878-787878787878",
            role: "COACH",
            content: "Hızlı sohbet hazır",
            sources: [],
            feedback: null,
            createdAt: "2026-07-20T08:00:00.000Z",
          },
        ],
      },
    },
    messagePageDelaysMs: {
      [firstConversationId]: { 2: 1_200 },
    },
    messageTotal: 31,
  });

  await page.goto("/koc/sohbet?c=" + firstConversationId);
  const loadOlder = page.getByRole("button", {
    name: "Daha eski mesajları yükle",
  });
  await loadOlder.click();

  const history = await openHistory(page);
  await history.getByRole("link", { name: /Hızlı sohbet/ }).click();

  await expect(page.getByText("Hızlı sohbet hazır")).toBeVisible();
  await expect(page.getByLabel("Koçuna mesaj yaz")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Daha eski mesajları yükle" }),
  ).toHaveCount(0);
});
test("yarışan history isteklerinde yalnız son seçilen sohbeti gösterir", async ({
  page,
}) => {
  const firstConversationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const secondConversationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  await mockCoachApi(page, {
    today: pendingToday,
    access: { canChat: true, mode: "PREMIUM", dailyMessagesRemaining: 10 },
    conversations: [
      {
        id: firstConversationId,
        title: "Birinci sohbet",
        lastMessageAt: "2026-07-20T09:00:00.000Z",
        messageCount: 1,
        origin: null,
      },
      {
        id: secondConversationId,
        title: "İkinci sohbet",
        lastMessageAt: "2026-07-20T08:00:00.000Z",
        messageCount: 1,
        origin: null,
      },
    ],
    messagesByConversation: {
      [firstConversationId]: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          role: "COACH",
          content: "Geç dönen birinci sohbet",
          sources: [],
          feedback: null,
          createdAt: "2026-07-20T09:00:00.000Z",
        },
      ],
      [secondConversationId]: [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          role: "COACH",
          content: "Son seçilen ikinci sohbet",
          sources: [],
          feedback: null,
          createdAt: "2026-07-20T08:00:00.000Z",
        },
      ],
    },
    messageDelaysMs: { [firstConversationId]: 1_200 },
  });

  await page.goto("/koc/sohbet");
  const history = await openHistory(page);
  const firstRequest = page.waitForRequest((request) =>
    request.url().includes(`/${firstConversationId}/messages`),
  );
  await history.getByRole("link", { name: /Birinci sohbet/ }).click();
  await firstRequest;
  await expect(page.getByLabel("Sohbet geçmişin yükleniyor…")).toBeVisible();
  await expect(page.getByLabel("Koçuna mesaj yaz")).toBeDisabled();

  const historyAgain = await openHistory(page);
  await historyAgain.getByRole("link", { name: /İkinci sohbet/ }).click();

  await expect(page.getByText("Son seçilen ikinci sohbet")).toBeVisible();
  await page.waitForTimeout(1_300);
  await expect(page.getByText("Geç dönen birinci sohbet")).toHaveCount(0);
});
test("stream hatasında optimistic exchangei geri alır ve metni inputa döndürür", async ({
  page,
}) => {
  await mockCoachApi(page, {
    today: pendingToday,
    access: { canChat: true, mode: "PREMIUM", dailyMessagesRemaining: 10 },
    streamError: true,
  });
  await page.goto("/koc/sohbet");

  const composer = page.getByLabel("Koçuna mesaj yaz");
  await composer.fill("Bu mesajı tekrar deneyeceğim");
  await page.getByRole("button", { name: "Gönder" }).click();

  await expect(
    page.getByText("Yanıt alınamadı — lütfen tekrar dene."),
  ).toBeVisible();
  await expect(composer).toHaveValue("Bu mesajı tekrar deneyeceğim");
  const transcript = page.getByRole("log", { name: "Koç sohbeti" });
  await expect(
    transcript.getByText("Bu mesajı tekrar deneyeceğim", { exact: true }),
  ).toHaveCount(0);
  await expect(
    transcript.getByText("Yarım yanıt", { exact: true }),
  ).toHaveCount(0);
});
function makeRecentMessages(): CoachMessageDto[] {
  return Array.from(
    { length: 30 },
    (_, index): CoachMessageDto => ({
      id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      role: index % 2 === 0 ? "COACH" : "USER",
      content:
        index === 29
          ? "Yakın geçmiş ankrajı " + "uzun içerik ".repeat(8)
          : `Yakın geçmiş ${index} ` + "uzun içerik ".repeat(8),
      sources: [],
      feedback: null,
      createdAt: `2026-07-20T10:${String(29 - index).padStart(2, "0")}:00.000Z`,
    }),
  );
}
interface MockCoachOptions {
  today: TodayPanelResponse;
  access?: CoachAccessDto;
  accessDelayMs?: number;
  conversations?: CoachConversationDto[];
  messages?: CoachMessageDto[];
  conversationFailures?: number;
  messageFailures?: number;
  olderMessageFailures?: number;
  messagePages?: Record<number, CoachMessageDto[]>;
  messagePagesByConversation?: Record<
    string,
    Record<number, CoachMessageDto[]>
  >;
  messagePageDelaysMs?: Record<string, Record<number, number>>;
  messageTotal?: number;
  messagesByConversation?: Record<string, CoachMessageDto[]>;
  messageDelaysMs?: Record<string, number>;
  streamError?: boolean;
}

async function mockCoachApi(page: Page, options: MockCoachOptions) {
  let todayCalls = 0;
  let dailyGreetingCalls = 0;
  let conversationCalls = 0;
  let conversationsBlocked = (options.conversationFailures ?? 0) > 0;
  let messageFailures = options.messageFailures ?? 0;
  let olderMessageFailures = options.olderMessageFailures ?? 0;

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
    if (method === "POST" && path === "/v1/coach/daily-greeting") {
      dailyGreetingCalls += 1;
      return json(route, {
        greeting: "Bugün tek küçük adım yeter.",
        model: "fake",
      });
    }
    if (method === "GET" && path === "/v1/coaching/vision") {
      return json(route, null);
    }
    if (method === "GET" && path === "/v1/coach/memory")
      return json(route, null);
    if (
      method === "GET" &&
      path === "/v1/coach/conversations?page=1&pageSize=20"
    ) {
      conversationCalls += 1;
      if (conversationsBlocked) {
        return json(
          route,
          {
            code: "SERVICE_UNAVAILABLE",
            message: "Sohbetlerin şu an yüklenemedi.",
          },
          503,
        );
      }
      const items = options.conversations ?? [];
      return json(route, { items, total: items.length, page: 1, pageSize: 20 });
    }
    if (
      method === "GET" &&
      url.pathname.startsWith("/v1/coach/conversations/") &&
      url.pathname.endsWith("/messages")
    ) {
      const requestedConversationId = url.pathname.split("/")[4]!;
      const pageNumber = Number(url.searchParams.get("page") ?? "1");
      const delayMs =
        options.messagePageDelaysMs?.[requestedConversationId]?.[pageNumber] ??
        options.messageDelaysMs?.[requestedConversationId] ??
        0;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      if (pageNumber === 1 && messageFailures > 0) {
        messageFailures -= 1;
        return json(
          route,
          {
            code: "SERVICE_UNAVAILABLE",
            message: "Sohbet geçmişi şu an yüklenemedi.",
          },
          503,
        );
      }
      if (pageNumber > 1 && olderMessageFailures > 0) {
        olderMessageFailures -= 1;
        return json(
          route,
          {
            code: "SERVICE_UNAVAILABLE",
            message: "Daha eski mesajlar yüklenemedi.",
          },
          503,
        );
      }
      const conversationPages =
        options.messagePagesByConversation?.[requestedConversationId];
      const items =
        conversationPages?.[pageNumber] ??
        options.messagePages?.[pageNumber] ??
        (pageNumber === 1
          ? (options.messagesByConversation?.[requestedConversationId] ??
            options.messages ??
            [])
          : []);
      // Per-conversation suites must report THAT conversation's total: a shared `messageTotal`
      // makes a 1-message chat look paginated, so "load older" never goes away when switching.
      const total = conversationPages
        ? Object.values(conversationPages).reduce(
            (sum, pageItems) => sum + pageItems.length,
            0,
          )
        : (options.messagesByConversation?.[requestedConversationId]?.length ??
          options.messageTotal ??
          Object.values(options.messagePages ?? {}).reduce(
            (sum, pageItems) => sum + pageItems.length,
            options.messages?.length ?? 0,
          ));
      return json(route, {
        items,
        total,
        page: pageNumber,
        pageSize: 30,
      });
    }
    if (
      method === "POST" &&
      path === "/v1/coach/chat/stream" &&
      options.streamError
    ) {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: corsHeaders,
        body:
          'data: {"delta":"Yarım yanıt"}\n\n' +
          'data: {"error":{"code":"AI_PROVIDER_ERROR"}}\n\n',
      });
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
    get dailyGreetingCalls() {
      return dailyGreetingCalls;
    },
    allowConversations() {
      conversationsBlocked = false;
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
