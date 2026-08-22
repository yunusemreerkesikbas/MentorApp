import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  CoachPlanAdaptationDto,
  PlanTaskDto,
  SubscriptionView,
} from "@mentor/types";

const taskId = "33333333-3333-4333-8333-333333333333";
const revision = "a".repeat(64);
const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "plan@test.local",
  displayName: "Plan Test",
  username: "plan_test",
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

const task: PlanTaskDto = {
  id: taskId,
  title: "Matematik çöz",
  subject: "Matematik",
  status: "PENDING",
  sortOrder: 0,
  taskDate: "2026-07-21",
  startTime: null,
  endTime: null,
  description: null,
  origin: null,
};

const readyPreview: CoachPlanAdaptationDto = {
  status: "READY",
  message: "Planına dokunmadan güvenli bir önizleme hazırladım.",
  window: { from: "2026-07-21", to: "2026-07-27" },
  planRevision: revision,
  model: "fake",
  changes: [
    {
      kind: "MOVE",
      taskId,
      title: task.title,
      subject: task.subject,
      fromDate: "2026-07-21",
      toDate: "2026-07-23",
    },
    {
      kind: "ADD",
      title: "Kısa tekrar",
      subject: null,
      taskDate: "2026-07-22",
    },
  ],
};

test("tek Koçla planla akışında MOVE ve ADD seçimlerini atomik uygular", async ({
  page,
}) => {
  const api = await mockPlanApi(page, { preview: readyPreview });
  await page.goto("/plan");

  await page.getByRole("button", { name: "Koçla planla" }).click();
  await page.getByRole("button", { name: "Önizlemeyi hazırla" }).click();

  await expect(page.getByText("Taşı", { exact: true })).toBeVisible();
  await expect(page.getByText("Ekle", { exact: true })).toBeVisible();
  await expect(page.getByText(/21 Temmuz.*23 Temmuz/)).toBeVisible();
  await page.getByRole("button", { name: "Seçilenleri uygula" }).click();

  await expect(page.getByText("Planın güncellendi")).toBeVisible();
  expect(api.previewCalls).toBe(1);
  expect(api.applyBodies).toEqual([
    {
      planRevision: revision,
      changes: readyPreview.changes,
    },
  ]);
});

test("Free kullanıcıyı LLM isteği yapmadan aboneliğe yönlendirir", async ({
  page,
}) => {
  const api = await mockPlanApi(page, {
    preview: readyPreview,
    premium: false,
  });
  await page.goto("/plan");

  await page.getByRole("button", { name: "Koçla planla" }).click();

  await expect(page).toHaveURL(/\/abonelik$/);
  expect(api.previewCalls).toBe(0);
});

test("mood query akışını StrictMode altında bir kez tüketir", async ({
  page,
}) => {
  const preview: CoachPlanAdaptationDto = {
    ...readyPreview,
    status: "NO_CHANGE",
    message: "Şu an planını değiştirmen gerekmiyor.",
    changes: [],
    model: "rules",
  };
  const api = await mockPlanApi(page, { preview });

  await page.goto("/plan?coach=adapt&source=mood");

  await expect(
    page.getByText("Şu an planını değiştirmen gerekmiyor."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/plan$/);
  expect(api.previewCalls).toBe(1);
  expect(api.previewBodies).toEqual([{ source: "MOOD" }]);
});

test("stale preview seçimlerini korur ve ikinci çağrıyı yalnız manuel yeniden hazırla ile yapar", async ({
  page,
}) => {
  const api = await mockPlanApi(page, {
    preview: readyPreview,
    staleApplyOnce: true,
  });
  await page.goto("/plan");
  await page.getByRole("button", { name: "Koçla planla" }).click();
  await page.getByRole("button", { name: "Önizlemeyi hazırla" }).click();
  await page.getByRole("button", { name: "Seçilenleri uygula" }).click();

  await expect(page.getByText("Planın bu sırada değişti.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Yeniden hazırla" }),
  ).toBeVisible();
  expect(api.previewCalls).toBe(1);

  await page.getByRole("button", { name: "Yeniden hazırla" }).click();
  await expect.poll(() => api.previewCalls).toBe(2);
});

/** Today in the browser's local calendar — the calendar view's "past is read-only" rule uses it. */
const todayIso = new Date().toISOString().slice(0, 10);

const timedTask: PlanTaskDto = {
  id: "55555555-5555-4555-8555-555555555555",
  title: "Matematik tekrar",
  subject: "Matematik",
  status: "PENDING",
  sortOrder: 0,
  taskDate: todayIso,
  startTime: "13:00",
  endTime: "14:30",
  description: "Problemler + hız",
  origin: null,
};

test.describe("Takvim", () => {
  test("Ay ızgarasında saatli etkinliği gösterir ve aylar arasında gezinir", async ({
    page,
  }) => {
    await mockPlanApi(page, {
      preview: readyPreview,
      tasks: [timedTask],
      calendar: { scale: "month" },
    });
    await page.goto("/plan");

    const monthTitle = page.getByRole("heading", { level: 2 }).first();
    const shownMonth = await monthTitle.textContent();

    // Chips only render on the desktop board; the 375px grid falls back to dots.
    // A month cell is one line: start time + title (the subject rides on the color).
    const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024;
    if (isDesktop) {
      // `.last()`, not `.first()`: the Takvim view's left rail also lists the selected day's
      // tasks (`PlanDayTodoList`) — a checkbox and an options kebab, both named after the same
      // task and both earlier in the DOM than the grid itself — so an unscoped `/Matematik
      // tekrar/` match picks up the rail before it reaches the actual month-grid chip.
      const chip = page.getByRole("button", { name: /Matematik tekrar/ }).last();
      await expect(chip).toHaveText("13:00 Matematik tekrar");
    }

    // exact: the mini calendar's own nav is "Sonraki aya git".
    await page.getByRole("button", { name: "Sonraki ay", exact: true }).click();
    await expect(monthTitle).not.toHaveText(shownMonth ?? "");

    await page.getByRole("button", { name: "Önceki ay", exact: true }).click();
    await expect(monthTitle).toHaveText(shownMonth ?? "");
  });

  test("Hafta ölçeği masaüstünde saat ızgarası, mobilde ajanda gösterir", async ({
    page,
  }) => {
    await mockPlanApi(page, {
      preview: readyPreview,
      tasks: [timedTask],
      calendar: { scale: "week" },
    });
    await page.goto("/plan");

    const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024;
    await expect(
      page.getByRole("tab", { name: isDesktop ? "Hafta" : "Ajanda" }),
    ).toHaveAttribute("aria-selected", "true");

    if (isDesktop) {
      // Seven-column hour grid: the event is a positioned block with its full range.
      // `.last()` for the same reason as the month-grid test: the left rail's day-todo-list
      // repeats this task's name earlier in the DOM than the grid's own block chip.
      await expect(
        page.getByRole("button", { name: /Matematik tekrar/ }).last(),
      ).toContainText("13:00 – 14:30");
    } else {
      // Agenda: a tap-to-open row, not a checkbox — completion still toggles, but from the
      // details sheet the tap opens, same as every other calendar event on mobile.
      // `.last()`: the collapsed date strip above the agenda shows its own tiny per-day chip for
      // the same task, earlier in the DOM than the agenda row itself.
      await expect(
        page.getByRole("button", { name: /Matematik tekrar/ }).last(),
      ).toContainText("13:00 – 14:30");
    }
  });

  test("Gün ızgarasında boş saate tıklayınca saatli etkinlik oluşturur", async ({
    page,
  }) => {
    const api = await mockPlanApi(page, {
      preview: readyPreview,
      tasks: [],
      calendar: { scale: "day" },
    });
    await page.goto("/plan");

    await page.getByRole("button", { name: "09:00 için plan ekle" }).click();
    // Named for the sheet itself, not just text on the page: the calendar also carries its own
    // floating "Görev ekle" add button, and an unscoped role lookup below would match both.
    const sheet = page.getByLabel("Yeni etkinlik");
    await expect(sheet).toBeVisible();

    // The slot click turns "all day" off and seeds the start time.
    await expect(page.getByRole("checkbox", { name: "Tüm gün" })).not.toBeChecked();
    await expect(page.getByLabel("Başlangıç")).toHaveValue("09:00");

    await page.getByLabel("Yeni görev").fill("Deneme çöz");
    await page.getByLabel("Bitiş").fill("10:30");
    await page.getByLabel("Açıklama").fill("Sayısal bölüm");
    await sheet.getByRole("button", { name: "Görev ekle" }).click();

    await expect.poll(() => api.createBodies.length).toBe(1);
    expect(api.createBodies[0]).toMatchObject({
      title: "Deneme çöz",
      taskDate: todayIso,
      startTime: "09:00",
      endTime: "10:30",
      description: "Sayısal bölüm",
    });
  });

  test("bitiş saati başlangıçtan önceyse kaydetmez", async ({ page }) => {
    const api = await mockPlanApi(page, {
      preview: readyPreview,
      tasks: [],
      calendar: { scale: "day" },
    });
    await page.goto("/plan");

    await page.getByRole("button", { name: "09:00 için plan ekle" }).click();
    await page.getByLabel("Yeni görev").fill("Geçersiz aralık");
    // Setting the start after the end is auto-corrected, so push the END backwards instead.
    await page.getByLabel("Bitiş").fill("08:00");
    // Scoped to the sheet — the calendar's own floating "Görev ekle" add button otherwise ties it.
    await page.getByLabel("Yeni etkinlik").getByRole("button", { name: "Görev ekle" }).click();

    await expect(
      page.getByText("Bitiş saati başlangıçtan sonra olmalı."),
    ).toBeVisible();
    expect(api.createBodies).toHaveLength(0);
  });
});

interface MockPlanOptions {
  preview: CoachPlanAdaptationDto;
  premium?: boolean;
  staleApplyOnce?: boolean;
  /** Overrides the default single-task list. */
  tasks?: PlanTaskDto[];
  /** Seeds the persisted Takvim view + scale before the app boots. */
  calendar?: { scale: "day" | "week" | "month" };
}

async function mockPlanApi(page: Page, options: MockPlanOptions) {
  let previewCalls = 0;
  let staleApply = options.staleApplyOnce ?? false;
  const previewBodies: unknown[] = [];
  const applyBodies: unknown[] = [];
  const createBodies: Record<string, unknown>[] = [];
  const tasks = options.tasks ?? [task];
  const subscription: SubscriptionView = {
    subscription: null,
    entitlement: {
      tier: options.premium === false ? "FREE" : "PREMIUM",
      isPremium: options.premium !== false,
      validUntil: options.premium === false ? null : "2026-08-21T00:00:00.000Z",
      reason: options.premium === false ? "NONE" : "ACTIVE",
    },
    features: {} as SubscriptionView["features"],
  };

  await page.addInitScript((scale: string | null) => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    window.localStorage.removeItem("mentor.plan.view");
    if (scale) {
      window.localStorage.setItem("mentor.plan.viewMode", "calendar");
      window.localStorage.setItem("mentor.plan.calendarScale", scale);
    }
  }, options.calendar?.scale ?? null);
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path.startsWith("/v1/notifications")) {
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
    if (method === "GET" && path === "/v1/subscription") {
      return json(route, subscription);
    }
    if (method === "GET" && path === "/v1/plan-tasks/calendar") {
      return json(route, { dates: tasks.map((x) => x.taskDate) });
    }
    if (method === "POST" && path === "/v1/plan-tasks") {
      const body = request.postDataJSON() as Record<string, unknown>;
      createBodies.push(body);
      return json(
        route,
        {
          id: "66666666-6666-4666-8666-666666666666",
          subject: null,
          status: "PENDING",
          sortOrder: 0,
          startTime: null,
          endTime: null,
          description: null,
          ...body,
        },
        201,
      );
    }
    if (method === "GET" && path === "/v1/plan-tasks") {
      return json(route, {
        items: tasks,
        total: tasks.length,
        page: 1,
        pageSize: 50,
      });
    }
    if (method === "POST" && path === "/v1/coach/plan-adaptation") {
      previewCalls += 1;
      previewBodies.push(request.postDataJSON());
      return json(route, options.preview);
    }
    if (method === "POST" && path === "/v1/plan-tasks/adapt") {
      applyBodies.push(request.postDataJSON());
      if (staleApply) {
        staleApply = false;
        return json(
          route,
          {
            code: "COACHING_PLAN_CHANGED",
            message: "Planın bu sırada değişti.",
          },
          409,
        );
      }
      return json(route, {
        moved: [{ ...task, taskDate: "2026-07-23", sortOrder: 1 }],
        added: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            title: "Kısa tekrar",
            subject: null,
            status: "PENDING",
            sortOrder: 0,
            taskDate: "2026-07-22",
          },
        ],
      });
    }
    if (method === "GET" && path.startsWith("/v1/economy/")) {
      return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }

    return json(
      route,
      {
        code: "TEST_UNEXPECTED_REQUEST",
        message: `${method} ${url.pathname}${url.search}`,
      },
      501,
    );
  });

  return {
    get previewCalls() {
      return previewCalls;
    },
    previewBodies,
    applyBodies,
    createBodies,
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
