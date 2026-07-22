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

interface MockPlanOptions {
  preview: CoachPlanAdaptationDto;
  premium?: boolean;
  staleApplyOnce?: boolean;
}

async function mockPlanApi(page: Page, options: MockPlanOptions) {
  let previewCalls = 0;
  let staleApply = options.staleApplyOnce ?? false;
  const previewBodies: unknown[] = [];
  const applyBodies: unknown[] = [];
  const subscription: SubscriptionView = {
    subscription: null,
    entitlement: {
      tier: options.premium === false ? "FREE" : "PREMIUM",
      isPremium: options.premium !== false,
      validUntil: options.premium === false ? null : "2026-08-21T00:00:00.000Z",
      reason: options.premium === false ? "NONE" : "ACTIVE",
    },
  };

  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    window.localStorage.removeItem("mentor.plan.view");
  });
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
      return json(route, { dates: [task.taskDate] });
    }
    if (method === "GET" && path === "/v1/plan-tasks") {
      return json(route, { items: [task], total: 1, page: 1, pageSize: 50 });
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
