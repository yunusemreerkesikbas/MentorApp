import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  CoachPlanItemDto,
  MentorshipRosterRowDto,
} from "@mentor/types";

const COACH_ID = "00000000-0000-4000-8000-000000000001";
const STUDENT_A = "00000000-0000-4000-8000-000000000002";
const STUDENT_B = "00000000-0000-4000-8000-000000000003";

const user: AuthUser = {
  id: COACH_ID,
  email: "coach-plan@test.local",
  displayName: "Koç Test",
  username: "coach_plan",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["COACH"],
  organizationId: null,
  examType: "KPSS",
  examVariant: null,
  examDate: null,
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const roster: MentorshipRosterRowDto[] = [
  rosterRow(STUDENT_A, "Ayşe"),
  rosterRow(STUDENT_B, "Bora"),
];

test("empty attendees create personal task and event while a cohort uses one batch", async ({
  page,
}) => {
  const api = await mockCoachPlanApi(page);
  await page.goto("/plan");

  await page.getByRole("button", { name: "Yeni görev" }).click();
  await page.getByLabel("Başlık").fill("Kendi hazırlığım");
  await page.getByRole("dialog").getByRole("button", { name: "Görevi oluştur" }).click();
  await expect.poll(() => api.personalTasks.length).toBe(1);
  expect(api.personalTasks[0]).not.toHaveProperty("coachNote");

  await page.getByRole("button", { name: "Yeni görev" }).click();
  await page.getByLabel("Başlık").fill("Paragraf");
  await page.getByRole("checkbox", { name: /Ayşe/ }).check();
  await page.getByRole("checkbox", { name: /Bora/ }).check();
  await page.getByRole("dialog").getByRole("button", { name: "Görevi oluştur" }).click();
  await expect.poll(() => api.batchTasks.length).toBe(1);
  expect(api.batchTasks[0]).toMatchObject({
    studentIds: [STUDENT_A, STUDENT_B],
  });

  await page.getByRole("button", { name: "Yeni etkinlik" }).click();
  await expect(
    page.getByRole("dialog", { name: "Yeni etkinlik" })
      .getByLabel("Tarih", { exact: true }),
  ).toHaveAttribute("min", todayIso());
  await page.getByLabel("Başlık").fill("Haftalık hazırlık");
  await page.getByLabel("Tekrar").selectOption("WEEKLY");
  await page.getByLabel("Tekrar bitişi").selectOption("COUNT");
  await page.getByRole("spinbutton", { name: "Tekrar sayısı" }).fill("4");
  await page.getByRole("dialog").getByRole("button", { name: "Etkinliği oluştur" }).click();
  await expect.poll(() => api.events.length).toBe(1);
  expect(api.events[0]).toMatchObject({
    attendeeIds: [],
    recurrence: {
      frequency: "WEEKLY",
      end: { kind: "COUNT", count: 4 },
    },
  });
  expect(api.events[0]).not.toHaveProperty("occurrences");
});

test("group mutations keep done students historical and series cancel requires scope", async ({
  page,
}) => {
  const items: CoachPlanItemDto[] = [
    {
      kind: "TASK",
      task: {
        id: "group:visible",
        assignmentGroupId: "00000000-0000-4000-8000-000000000020",
        status: null,
        taskDate: todayIso(),
        title: "Paragraf",
        subject: null,
        topic: null,
        startTime: null,
        endTime: null,
        coachNote: null,
        participants: [
          participant(STUDENT_A, "Ayşe", "DONE"),
          participant(STUDENT_B, "Bora", "PENDING"),
        ],
      },
    },
    {
      kind: "EVENT",
      event: {
        id: "00000000-0000-4000-8000-000000000030",
        seriesId: "00000000-0000-4000-8000-000000000031",
        organizerUserId: COACH_ID,
        orgId: null,
        title: "Haftalık görüşme",
        description: null,
        eventDate: todayIso(),
        startTime: "10:00",
        endTime: "10:30",
        status: "SCHEDULED",
        attendeeCount: 1,
        recurrence: {
          frequency: "WEEKLY",
          timeZone: "Europe/Istanbul",
          startsOn: todayIso(),
          end: { kind: "COUNT", count: 4 },
        },
        createdAt: "2026-09-09T00:00:00.000Z",
        updatedAt: "2026-09-09T00:00:00.000Z",
        attendees: [],
      },
    },
  ];
  const api = await mockCoachPlanApi(page, items);
  await page.goto("/plan");

  await page.getByRole("button", { name: /Paragraf/ }).first().click();
  const edit = page.getByRole("button", { name: "Düzenle" });
  await edit.click();
  await page.getByRole("dialog").getByRole("button", { name: "Vazgeç" }).click();
  await expect(edit).toBeFocused();
  await edit.click();
  await page.getByLabel("Başlık").fill("Yeni paragraf");
  await page.getByRole("dialog").getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect.poll(() => api.groupUpdates.length).toBe(1);
  expect(api.groupUpdates[0]).toMatchObject({
    studentIds: [STUDENT_B],
    expectedSignature: {
      taskDate: todayIso(),
      title: "Paragraf",
      subject: null,
      topic: null,
      startTime: null,
      endTime: null,
      coachNote: null,
    },
  });

  await page.getByRole("button", { name: /Paragraf/ }).first().click();
  await page.getByRole("button", { name: "Kaldır" }).click();
  await page.getByRole("button", { name: "Görevi kaldır" }).click();
  await expect.poll(() => api.groupDeletes.length).toBe(1);
  expect(api.groupDeletes[0]).toEqual({
    studentIds: [STUDENT_B],
    expectedSignature: {
      taskDate: todayIso(),
      title: "Paragraf",
      subject: null,
      topic: null,
      startTime: null,
      endTime: null,
      coachNote: null,
    },
  });

  await page.getByRole("button", { name: /Haftalık görüşme/ }).first().click();
  await page.getByRole("button", { name: "Düzenle" }).click();
  await page.getByRole("radio", { name: "Tüm seri" }).check();
  await page.getByLabel("Başlık").fill("Yeni görüşme");
  await page.getByRole("checkbox", { name: /Bora/ }).check();
  await page.getByRole("dialog").getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect.poll(() => api.eventUpdates.length).toBe(1);
  expect(api.eventUpdates[0]).toEqual({
    scope: "SERIES",
    title: "Yeni görüşme",
    attendeeIds: [STUDENT_B],
  });

  await page.getByRole("button", { name: /Haftalık görüşme/ }).first().click();
  const cancel = page.getByRole("button", { name: "İptal et" });
  await cancel.click();
  await expect(page.getByRole("dialog", { name: "Etkinlik kapsamı" })).toBeVisible();
  expect(api.eventCancels).toHaveLength(0);
  await page.getByRole("radio", { name: "Tüm seri" }).check();
  await page.getByRole("button", { name: "Devam et" }).click();
  await page.getByRole("dialog", { name: "Etkinlik iptal edilsin mi?" })
    .getByRole("button", { name: "Vazgeç" }).click();
  await expect(cancel).toBeFocused();
  await cancel.click();
  await expect(page.getByRole("radio", { name: "Tüm seri" })).not.toBeChecked();
  await expect(page.getByRole("radio", { name: "Yalnızca bu etkinlik" })).not.toBeChecked();
  await page.getByRole("radio", { name: "Tüm seri" }).check();
  await page.getByRole("button", { name: "Devam et" }).click();
  await page.getByRole("button", { name: "Etkinliği iptal et" }).click();
  await expect.poll(() => api.eventCancels.length).toBe(1);
  expect(api.eventCancels[0]).toEqual({ scope: "SERIES" });
});

test("surfaces backend-localized mutation errors", async ({ page }) => {
  const api = await mockCoachPlanApi(page);
  api.failNextTask = true;
  await page.goto("/plan");

  await page.getByRole("button", { name: "Yeni görev" }).click();
  await page.getByLabel("Başlık").fill("Hata örneği");
  await page.getByRole("dialog").getByRole("button", { name: "Görevi oluştur" }).click();

  await expect(
    page.getByRole("dialog").getByRole("alert"),
  ).toContainText("Bu görev şu anda oluşturulamadı.");
});

test("reloads selected detail from authority and creates on a selected future day", async ({
  page,
}) => {
  const initial = personalTask("Eski başlık");
  const api = await mockCoachPlanApi(page, [initial]);
  await page.goto("/plan");

  await page.getByRole("button", { name: /Eski başlık/ }).first().click();
  api.planItems = [personalTask("Güncel başlık")];
  await page.getByRole("button", { name: "Yeni etkinlik" }).click();
  const eventDialog = page.getByRole("dialog", { name: "Yeni etkinlik" });
  await eventDialog.getByLabel("Başlık").fill("Yenilemeyi tetikle");
  await eventDialog.getByRole("button", { name: "Etkinliği oluştur" }).click();

  await expect(page.getByRole("heading", { name: "Güncel başlık" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Eski başlık" })).toHaveCount(0);

  await page.getByRole("button", { name: "Detayı kapat" }).click();
  await page.getByRole("tab", { name: "Gün" }).click();
  await page.getByRole("button", { name: "Sonraki gün" }).click();
  const future = addDays(todayIso(), 1);
  await page.getByRole("button", { name: "Yeni görev" }).click();
  const taskDialog = page.getByRole("dialog", { name: "Yeni görev" });
  await expect(taskDialog.getByLabel("Tarih", { exact: true })).toHaveValue(future);
  await expect(taskDialog.getByLabel("Tarih", { exact: true }))
    .toHaveAttribute("min", todayIso());
  await taskDialog.getByLabel("Başlık").fill("Yarının görevi");
  await taskDialog.getByRole("button", { name: "Görevi oluştur" }).click();
  await expect.poll(() => api.personalTasks.length).toBe(1);
  expect(api.personalTasks[0]).toMatchObject({ taskDate: future });
});

function rosterRow(studentId: string, studentDisplayName: string): MentorshipRosterRowDto {
  return {
    linkId:
      studentId === STUDENT_A
        ? "00000000-0000-4000-8000-000000000101"
        : "00000000-0000-4000-8000-000000000102",
    studentId,
    studentDisplayName,
    studentUsername: null,
    avatarUrl: null,
    status: "ACTIVE",
    acceptedAt: "2026-09-01T00:00:00.000Z",
    endedAt: null,
    metrics: {
      lastActiveDate: null,
      currentStreak: 0,
      focusMinutes7d: 0,
      sessions7d: 0,
      activeDays7d: 0,
      planCompletionRate7d: null,
      latestMockNet: null,
      latestMockAt: null,
      moodLevel7dAvg: null,
    },
    attendedAt: null,
    needsAttention: false,
    riskFlags: [],
  };
}

function participant(
  studentId: string,
  studentDisplayName: string,
  status: "PENDING" | "DONE",
) {
  return {
    studentId,
    studentDisplayName,
    studentUsername: null,
    avatarUrl: null,
    taskId:
      studentId === STUDENT_A
        ? "00000000-0000-4000-8000-000000000011"
        : "00000000-0000-4000-8000-000000000012",
    status,
  };
}

function personalTask(title: string): CoachPlanItemDto {
  return {
    kind: "TASK",
    task: {
      id: "00000000-0000-4000-8000-000000000040",
      assignmentGroupId: null,
      status: "PENDING",
      taskDate: todayIso(),
      title,
      subject: null,
      topic: null,
      startTime: null,
      endTime: null,
      coachNote: null,
      participants: [],
    },
  };
}

async function mockCoachPlanApi(
  page: Page,
  initialItems: CoachPlanItemDto[] = [],
) {
  const state = {
    personalTasks: [] as Record<string, unknown>[],
    batchTasks: [] as Record<string, unknown>[],
    events: [] as Record<string, unknown>[],
    groupUpdates: [] as Record<string, unknown>[],
    groupDeletes: [] as Record<string, unknown>[],
    eventUpdates: [] as Record<string, unknown>[],
    eventCancels: [] as Record<string, unknown>[],
    failNextTask: false,
    planItems: initialItems,
  };
  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
  });
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && pathname === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && pathname === "/v1/users/me") return json(route, user);
    if (method === "GET" && pathname.startsWith("/v1/notifications")) {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    if (method === "POST" && pathname === "/v1/notifications/stream-token") {
      return json(route, { token: "stream" });
    }
    if (method === "GET" && pathname === "/v1/mentorship/students") {
      return json(route, { items: roster, total: roster.length, page: 1, pageSize: 100 });
    }
    if (method === "GET" && pathname === "/v1/mentorship/plan") {
      return json(route, {
        items: state.planItems,
        total: state.planItems.length,
        page: 1,
        pageSize: 100,
      });
    }
    if (method === "GET" && pathname === "/v1/content/holidays") {
      return json(route, []);
    }
    if (method === "POST" && pathname === "/v1/plan-tasks") {
      if (state.failNextTask) {
        state.failNextTask = false;
        return json(route, {
          code: "COACHING_TASK_CREATE_FAILED",
          message: "Bu görev şu anda oluşturulamadı.",
        }, 422);
      }
      state.personalTasks.push(request.postDataJSON());
      return json(route, {}, 201);
    }
    if (method === "POST" && pathname === "/v1/mentorship/assignments") {
      state.batchTasks.push(request.postDataJSON());
      return json(route, [], 201);
    }
    if (method === "POST" && pathname === "/v1/mentorship/events") {
      state.events.push(request.postDataJSON());
      return json(route, {}, 201);
    }
    if (
      method === "PATCH" &&
      pathname === "/v1/mentorship/assignment-groups/00000000-0000-4000-8000-000000000020"
    ) {
      state.groupUpdates.push(request.postDataJSON());
      return json(route, []);
    }
    if (
      method === "DELETE" &&
      pathname === "/v1/mentorship/assignment-groups/00000000-0000-4000-8000-000000000020"
    ) {
      state.groupDeletes.push(request.postDataJSON());
      return json(route, null, 204);
    }
    if (
      method === "PATCH" &&
      pathname === "/v1/mentorship/events/00000000-0000-4000-8000-000000000030"
    ) {
      state.eventUpdates.push(request.postDataJSON());
      return json(route, {});
    }
    if (
      method === "POST" &&
      pathname === "/v1/mentorship/events/00000000-0000-4000-8000-000000000030/cancel"
    ) {
      state.eventCancels.push(request.postDataJSON());
      return json(route, null, 204);
    }
    return json(route, {
      code: "TEST_UNEXPECTED_REQUEST",
      message: `${method} ${pathname}`,
    }, 501);
  });
  return state;
}

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
  }).format(new Date());
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const corsHeaders = {
  "access-control-allow-origin": new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
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
