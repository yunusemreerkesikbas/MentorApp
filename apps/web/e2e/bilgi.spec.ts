import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser, ExamCalendarDto, InfoArticleDto } from "@mentor/types";

const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "bilgi@test.local",
  displayName: "Bilgi Test",
  username: "bilgi_test",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "KPSS",
  examDate: "2026-07-26",
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const article: InfoArticleDto = {
  slug: "kpss-basvuru-sureci",
  title: "KPSS Başvuru Süreci",
  body: "## Başvuru özeti\n\nDoğrulanmış başvuru rehberi.",
  family: "KPSS",
  category: "APPLICATION",
  metaTitle: "KPSS Başvuru Süreci | Mentor Bilgi Merkezi",
  metaDescription: "KPSS başvuru rehberi.",
  publishedAt: "2026-01-01T12:00:00.000Z",
  source: "ÖSYM",
  sourceUrl: "https://www.osym.gov.tr",
  verifiedAt: "2026-01-02T10:00:00.000Z",
  verifiedBy: "editorial-test",
};

const exam = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "kpss-lisans-2026",
  name: "KPSS Lisans 2026",
  family: "KPSS",
  variant: "LISANS",
  isCurrent: true,
};

const calendar: ExamCalendarDto = {
  exam,
  events: [
    event("RESULT_DATE", "2026-08-01T07:00:00.000Z"),
    event("EXAM_DATE", "2026-07-12T07:00:00.000Z"),
    event("APPLICATION_START", "2026-05-01T07:00:00.000Z"),
    event("APPLICATION_END", "2026-05-15T07:00:00.000Z"),
  ],
  examDateLabel: "12 Temmuz 2026",
  daysRemaining: 10,
  nextEvent: event("RESULT_DATE", "2026-08-01T07:00:00.000Z"),
  daysUntilNextEvent: 14,
};

test("doğrulanmış sınav sürecini kronolojik ve kaynaklı gösterir", async ({
  page,
}) => {
  const api = await mockKnowledgeApi(page);
  await page.goto("/tr/bilgi");

  const section = page
    .getByRole("heading", { name: "Sınav süreci", exact: true })
    .locator("..");
  const items = section.getByRole("listitem");
  await expect(items).toHaveText([
    /Başvuru başlangıcı.*1 Mayıs 2026/,
    /Başvuru sonu.*15 Mayıs 2026/,
    /Sınav günü.*12 Temmuz 2026/,
    /Sonuç tarihi.*1 Ağustos 2026/,
  ]);
  await expect(
    items.first().getByRole("link", { name: /ÖSYM/ }),
  ).toHaveAttribute("href", "https://www.osym.gov.tr");
  await expect(items.first()).toContainText("Son doğrulama: 2 Ocak 2026");
  await expect(items.last()).toContainText(
    "S\u0131radaki ad\u0131m \u00b7 14 g\u00fcn sonra",
  );

  const calendarLink = page.getByRole("link", { name: "Takvime ekle" });
  await expect(calendarLink).toHaveAttribute(
    "download",
    "kpss-lisans-2026-takvim.ics",
  );
  const calendarHref = await calendarLink.getAttribute("href");
  const calendarContent = decodeURIComponent(calendarHref?.split(",")[1] ?? "");
  expect(calendarContent).toContain(
    "UID:11111111-1111-4111-8111-111111111111-RESULT_DATE@mentor",
  );
  expect(calendarContent).not.toContain("EXAM_DATE@mentor");
  expect(api.usersMeCalls).toBe(0);
  expect(api.unexpected).toEqual([]);
});

test("yalnız sınav günü varken timeline tekrarını göstermez", async ({
  page,
}) => {
  const api = await mockKnowledgeApi(page, {
    calendar: {
      ...calendar,
      events: [event("EXAM_DATE", "2026-07-12T07:00:00.000Z")],
      nextEvent: event("EXAM_DATE", "2026-07-12T07:00:00.000Z"),
      daysUntilNextEvent: 0,
    },
  });
  await page.goto("/tr/bilgi");

  await expect(page.getByText("12 Temmuz 2026", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sınav süreci", exact: true }),
  ).toHaveCount(0);
  expect(api.unexpected).toEqual([]);
});

test("makaleyi Koç composerına taşır ama otomatik göndermez", async ({
  page,
}) => {
  const api = await mockKnowledgeApi(page);
  await page.goto(`/tr/bilgi/${article.slug}`);
  await page.getByRole("link", { name: "Koçla konuş" }).click();

  await expect(
    page.getByRole("textbox", { name: "Koçuna mesaj yaz" }),
  ).toHaveValue(
    '"KPSS Başvuru Süreci" konusunu doğrulanmış kaynaklara dayanarak açıklar mısın?',
  );
  expect(
    api.requests.some(
      ({ method, path }) => method === "POST" && path === "/v1/coach/chat",
    ),
  ).toBe(false);
  expect(api.unexpected).toEqual([]);
});

test("anonim ve İngilizce ziyaretçiye lokalize rehberlik sunar", async ({
  page,
}) => {
  const api = await mockKnowledgeApi(page, { authenticated: false });
  await page.goto(`/en/bilgi/${article.slug}`);

  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in to ask the Coach" }),
  ).toHaveAttribute("href", "/en/giris");
  expect(api.unexpected).toEqual([]);

  const hub = await page.context().newPage();
  const hubApi = await mockKnowledgeApi(hub);
  await hub.goto("/en/bilgi");
  await expect(
    hub.getByRole("heading", { name: "Exam process", exact: true }),
  ).toBeVisible();
  await expect(hub.getByText("Application", { exact: true })).toBeVisible();
  await expect(
    hub.getByRole("link", { name: "Add to calendar" }),
  ).toBeVisible();
  await expect(
    hub.getByText("Next step \u00b7 in 14 days", { exact: true }),
  ).toBeVisible();
  expect(hubApi.unexpected).toEqual([]);
});

function event(type: string, eventAt: string) {
  return {
    type,
    eventAt,
    source: "ÖSYM",
    sourceUrl: "https://www.osym.gov.tr",
    verifiedAt: "2026-01-02T10:00:00.000Z",
    verifiedBy: "editorial-test",
  };
}

async function mockKnowledgeApi(
  page: Page,
  options: { authenticated?: boolean; calendar?: ExamCalendarDto } = {},
) {
  const authenticated = options.authenticated ?? true;
  const requests: Array<{ method: string; path: string }> = [];
  const unexpected: string[] = [];
  let usersMeCalls = 0;

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname + url.search;
    const method = request.method();
    requests.push({ method, path });

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return authenticated
        ? json(route, { accessToken: "test-token", expiresIn: 3600, user })
        : json(
            route,
            { code: "AUTH_INVALID_REFRESH", message: "Oturum bulunamadı." },
            401,
          );
    }
    if (method === "GET" && path === "/v1/users/me") {
      usersMeCalls += 1;
      return json(route, user);
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
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: corsHeaders,
        body: "",
      });
    }
    if (
      method === "GET" &&
      path === "/v1/content/exams/by-type/KPSS/calendar"
    ) {
      return json(route, options.calendar ?? calendar);
    }
    if (
      method === "GET" &&
      path.startsWith("/v1/content/info-articles?family=KPSS")
    ) {
      return json(route, { items: [article], total: 1, page: 1, pageSize: 20 });
    }
    if (
      method === "GET" &&
      path === `/v1/content/info-articles/${article.slug}`
    ) {
      return json(route, article);
    }
    if (method === "GET" && path === "/v1/coach/access") {
      return json(route, {
        canChat: true,
        mode: "PREMIUM",
        dailyMessagesRemaining: 20,
      });
    }
    if (method === "GET" && path.startsWith("/v1/coach/conversations?")) {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20 });
    }

    unexpected.push(`${method} ${path}`);
    return json(route, { code: "TEST_UNEXPECTED_REQUEST", message: path }, 501);
  });

  return {
    requests,
    unexpected,
    get usersMeCalls() {
      return usersMeCalls;
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
