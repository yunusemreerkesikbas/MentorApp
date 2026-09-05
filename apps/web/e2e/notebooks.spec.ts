import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  ExamCalendarDto,
  NotebookDto,
  NotebookPageDto,
  NotebookSummaryDto,
} from "@mentor/types";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const SYSTEM_ID = "99999999-9999-4999-8999-999999999999";
const CUSTOM_ID = "88888888-8888-4888-8888-888888888888";

const user: AuthUser = {
  id: USER_ID,
  email: "defterler@test.local",
  displayName: "Defter Test",
  username: "defter_test",
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

const systemNotebook: NotebookSummaryDto = {
  id: SYSTEM_ID,
  kind: "MISTAKE",
  examId: null,
  subjectRef: null,
  subjectName: null,
  title: null,
  cover: { color: "navy", material: "cloth" },
  pageCount: 2,
  dueCount: 3,
  updatedAt: "2026-08-25T09:00:00.000Z",
};

const calendar = {
  exam: {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "kpss-lisans-2026",
    name: "KPSS Lisans 2026",
    family: "KPSS",
    variant: "LISANS",
    isCurrent: true,
  },
  events: [],
  daysToExam: 120,
} as unknown as ExamCalendarDto;

function corsHeaders(route: Route) {
  return {
    "access-control-allow-origin":
      route.request().headers()["origin"] ?? "http://localhost:3100",
    "access-control-allow-credentials": "true",
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: corsHeaders(route),
    contentType: "application/json",
    body: body === null ? "" : JSON.stringify(body),
  });
}

interface MockApiOptions {
  initialCustoms?: NotebookDto[];
  failPageTwoOnce?: boolean;
  failFirstPageAfterDeleteOnce?: boolean;
}

async function mockApi(page: Page, options: MockApiOptions = {}) {
  let customs = [...(options.initialCustoms ?? [])];
  let failPageTwo = options.failPageTwoOnce ?? false;
  let failFirstPageAfterDelete = options.failFirstPageAfterDeleteOnce ?? false;
  let deleted = false;
  const state = { listCalls: 0, pagePuts: 0, deleteCalls: 0 };

  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
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
    if (method === "GET" && path === "/v1/notifications") {
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
    if (method === "GET" && path === "/v1/notifications/stream") {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: corsHeaders(route),
        body: "",
      });
    }
    if (
      method === "GET" &&
      path === "/v1/content/exams/by-type/KPSS/calendar"
    ) {
      return json(route, calendar);
    }
    if (
      method === "GET" &&
      path === `/v1/content/exams/${calendar.exam.slug}/subjects`
    ) {
      return json(route, [
        {
          slug: "matematik",
          name: "Matematik",
          questionCount: 30,
          sortOrder: 1,
        },
      ]);
    }
    if (method === "GET" && path === "/v1/coaching/notebooks") {
      state.listCalls += 1;
      const requestedPage = Number(url.searchParams.get("page") ?? 1);
      if (requestedPage === 1 && deleted && failFirstPageAfterDelete) {
        failFirstPageAfterDelete = false;
        return json(route, { code: "TEMPORARY_ERROR", message: "temporary" }, 503);
      }
      if (requestedPage === 2 && failPageTwo) {
        failPageTwo = false;
        return json(route, { code: "TEMPORARY_ERROR", message: "temporary" }, 503);
      }
      const all = [systemNotebook, ...customs];
      const pageSize = Number(url.searchParams.get("pageSize") ?? 12);
      const items = all.slice((requestedPage - 1) * pageSize, requestedPage * pageSize);
      return json(route, {
        items,
        total: all.length,
        page: requestedPage,
        pageSize,
      });
    }
    if (method === "POST" && path === "/v1/coaching/notebooks") {
      const body = request.postDataJSON() as {
        title: string;
        examId: string | null;
        subjectRef: string | null;
        cover: NotebookDto["cover"];
      };
      const custom: NotebookDto = {
        id: CUSTOM_ID,
        kind: "CUSTOM",
        title: body.title,
        examId: body.examId,
        subjectRef: body.subjectRef,
        subjectName: "Matematik",
        cover: body.cover,
        pageCount: 0,
        dueCount: 0,
        createdAt: "2026-08-25T10:00:00.000Z",
        updatedAt: "2026-08-25T10:00:00.000Z",
      };
      customs = [custom, ...customs.filter((item) => item.id !== CUSTOM_ID)];
      return json(route, custom, 201);
    }
    if (method === "GET" && path === `/v1/coaching/notebooks/${CUSTOM_ID}`) {
      return json(route, customs.find((item) => item.id === CUSTOM_ID) ?? null);
    }
    if (method === "PATCH" && path === `/v1/coaching/notebooks/${CUSTOM_ID}`) {
      const current = customs.find((item) => item.id === CUSTOM_ID);
      const body = request.postDataJSON() as Partial<NotebookDto>;
      const updated = current ? { ...current, ...body } : null;
      if (updated) customs = [updated, ...customs.filter((item) => item.id !== CUSTOM_ID)];
      return json(route, updated);
    }
    if (method === "DELETE" && path === `/v1/coaching/notebooks/${CUSTOM_ID}`) {
      state.deleteCalls += 1;
      deleted = true;
      customs = customs.filter((item) => item.id !== CUSTOM_ID);
      return json(route, null, 204);
    }
    const pageMatch = path.match(
      new RegExp(`/v1/coaching/notebooks/${CUSTOM_ID}/pages/(\\d+)$`),
    );
    if (method === "GET" && pageMatch) {
      const pageIndex = Number(pageMatch[1]);
      const result: NotebookPageDto = {
        pageIndex,
        doc: { version: 1, paper: "ruled", items: [], ink: [] },
        entries: [],
      };
      return json(route, result);
    }
    if (method === "PUT" && pageMatch) {
      state.pagePuts += 1;
      return json(route, {
        pageIndex: Number(pageMatch[1]),
        doc: (request.postDataJSON() as { doc: unknown }).doc,
        entries: [],
      });
    }
    return json(route, null, 204);
  });
  return state;
}

test("koleksiyondan ders defteri oluşturulur, serbest editör açılır ve defter silinir", async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto("/defterlerim");

  await expect(page.locator("article h2").first()).toHaveText(
    "Yanlış Defterim",
  );
  await page.getByRole("button", { name: "Yeni defter" }).click();
  await page.getByLabel("Defter adı").fill("Matematik Notlarım");
  await page.getByLabel("Ders (isteğe bağlı)").click();
  await page.getByRole("option", { name: "Matematik" }).click();
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect(page).toHaveURL(new RegExp(`/defterlerim/${CUSTOM_ID}$`));
  await expect(page.getByText("Matematik Notlarım").first()).toBeVisible();
  await page.getByRole("button", { name: "Defteri aç" }).click();
  await expect(page.getByRole("button", { name: "Sticker" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Not" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ekle", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ara", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Not" }).click();
  await page.getByRole("textbox").fill("Autosave notu");
  await page.getByRole("textbox").press("Escape");
  await expect.poll(() => state.pagePuts).toBeGreaterThan(0);

  await page.goto("/defterlerim");
  // Card actions are revealed by card hover (or keyboard focus) wherever hover exists; touch
  // devices keep them on permanently so they stay reachable. Playwright's own auto-hover aims at
  // the button, which is still hidden at that point, so the CARD has to be hovered first.
  await page.getByRole("heading", { name: "Matematik Notlarım" }).hover();
  await page
    .getByRole("button", { name: "Matematik Notlarım defterini sil" })
    .click();
  await page.getByRole("button", { name: "Defteri sil" }).click();
  await expect(
    page.getByRole("heading", { name: "Matematik Notlarım" }),
  ).toHaveCount(0);
});

test("daha fazla hatası yeniden denenir ve mutation sonrası sayfalama server ile senkronlanır", async ({
  page,
}) => {
  const initialCustoms = Array.from({ length: 13 }, (_, index): NotebookDto => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    kind: "CUSTOM",
    title: `Defter ${index + 1}`,
    examId: null,
    subjectRef: null,
    subjectName: null,
    cover: { color: "navy", material: "cloth" },
    pageCount: 0,
    dueCount: 0,
    createdAt: "2026-08-25T10:00:00.000Z",
    updatedAt: new Date(Date.UTC(2026, 7, 25, 10, index)).toISOString(),
  }));
  const state = await mockApi(page, { initialCustoms, failPageTwoOnce: true });
  await page.goto("/defterlerim");
  await expect(page.locator("article")).toHaveCount(12);

  await page.getByRole("button", { name: "Daha fazla" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "devamı yüklenemedi" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yeniden dene" }).click();
  await expect(page.locator("article")).toHaveCount(14);

  const callsBeforeCreate = state.listCalls;
  await page.getByRole("button", { name: "Yeni defter" }).click();
  await expect(page.getByLabel("Defter adı")).toBeFocused();
  await page.getByLabel("Defter adı").fill("Yeni Eklenen");
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect.poll(() => state.listCalls).toBeGreaterThan(callsBeforeCreate);
  await expect(page.locator("article")).toHaveCount(12);
  await expect(page.getByRole("heading", { name: "Yeni Eklenen" })).toBeVisible();
  const createButton = page.getByRole("button", { name: "Yeni defter" });
  expect((await createButton.boundingBox())?.height).toBeGreaterThanOrEqual(44);
});

test("silme başarılıyken liste yenileme tekrarı ikinci DELETE göndermez", async ({ page }) => {
  const custom: NotebookDto = {
    id: CUSTOM_ID,
    kind: "CUSTOM",
    title: "Silinecek Defter",
    examId: null,
    subjectRef: null,
    subjectName: null,
    cover: { color: "navy", material: "cloth" },
    pageCount: 0,
    dueCount: 0,
    createdAt: "2026-08-25T10:00:00.000Z",
    updatedAt: "2026-08-25T10:00:00.000Z",
  };
  const state = await mockApi(page, {
    initialCustoms: [custom],
    failFirstPageAfterDeleteOnce: true,
  });
  await page.goto("/defterlerim");

  await page.getByRole("heading", { name: "Silinecek Defter" }).hover();
  await page.getByRole("button", { name: "Silinecek Defter defterini sil" }).click();
  await page.getByRole("button", { name: "Defteri sil" }).click();

  const syncAlert = page.getByRole("alert").filter({ hasText: "Defter silindi" });
  await expect(syncAlert).toBeVisible();
  await expect(page.getByRole("heading", { name: "Silinecek Defter" })).toHaveCount(0);

  const callsAfterFailedSync = state.listCalls;
  const retryButton = syncAlert.getByRole("button", { name: "Yeniden dene" });
  await retryButton.focus();
  await expect(retryButton).toBeFocused();
  await retryButton.press("Enter");
  await expect.poll(() => state.listCalls).toBeGreaterThan(callsAfterFailedSync);
  await expect(syncAlert).toHaveCount(0);
  expect(state.deleteCalls).toBe(1);
});

test("İngilizce route reduced-motion altında koleksiyonu erişilebilir gösterir", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockApi(page);
  await page.goto("/en/notebooks");

  await expect(page.getByRole("heading", { name: "My notebooks" })).toBeVisible();
  await expect(page.locator("article h2").first()).toHaveText("My Mistake Notebook");
  await expect(page.getByRole("button", { name: "New notebook" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Delete Mistake Notebook/ })).toHaveCount(0);
});
