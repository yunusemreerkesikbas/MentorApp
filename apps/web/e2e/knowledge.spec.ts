import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  ExamCalendarDto,
  InfoArticleDto,
  SubscriptionView,
  TodayPanelResponse,
} from "@mentor/types";

const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "bilgi@test.local",
  displayName: "Bilgi Test",
  username: "knowledge_test",
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

const article: InfoArticleDto = {
  slug: "kpss-basvuru-sureci",
  title: "KPSS Başvuru Süreci",
  body: "## Başvuru özeti\n\nDoğrulanmış başvuru rehberi.",
  bodyFormat: "MARKDOWN",
  author: null,
  coverImage: {
    url: "https://cdn.test.local/cover.jpg",
    alt: "KPSS kapak",
    width: 1200,
    height: 675,
  },
  galleryImages: [
    {
      url: "https://cdn.test.local/gallery.jpg",
      alt: "KPSS galeri",
      width: 1200,
      height: 675,
    },
  ],
  isFeatured: false,
  featuredUntil: null,
  family: "KPSS",
  category: "APPLICATION",
  metaTitle: "KPSS Başvuru Süreci | Mentor Bilgi Merkezi",
  metaDescription: "KPSS başvuru rehberi.",
  publishedAt: "2026-01-01T12:00:00.000Z",
  source: "ÖSYM",
  sourceUrl: "https://www.osym.gov.tr",
  verifiedAt: "2026-01-02T10:00:00.000Z",
  verifiedBy: "editorial-test",
  updatedAt: "2026-01-03T10:00:00.000Z",
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

test("hub aile filtresi, öne çıkan ve sidebar countdown gösterir", async ({
  page,
}) => {
  const api = await mockKnowledgeApi(page);
  await page.goto("/bilgi");

  await expect(page.getByRole("tab", { name: "KPSS" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: article.title }).first()).toBeVisible();
  await expect(page.getByText("Mentor Editör").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Başvuru" })).toBeVisible();
  await expect(page.getByText("12 Temmuz 2026", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bilgi Merkezi" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Panele dön" })).toHaveCount(0);

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

test("konu filtresi ve sayfalama URL query kullanır", async ({ page }) => {
  const api = await mockKnowledgeApi(page, { articleTotal: 20 });
  await page.goto("/bilgi");

  await page.getByRole("button", { name: "Başvuru" }).click();
  await expect(page).toHaveURL(/category=APPLICATION/);
  await expect
    .poll(() =>
      api.requests.some(
        ({ method, path }) =>
          method === "GET" &&
          path.includes("/v1/content/info-articles?") &&
          path.includes("category=APPLICATION"),
      ),
    )
    .toBe(true);

  await page.getByRole("button", { name: "Sonraki" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/category=APPLICATION/);
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
  await page.goto("/bilgi");

  await expect(page.getByText("12 Temmuz 2026", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sınav süreci", exact: true }),
  ).toHaveCount(0);
  expect(api.unexpected).toEqual([]);
});

test("makaleyi Koç composerına taşır ama otomatik göndermez", async ({
  page,
}) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  const api = await mockKnowledgeApi(page);
  await page.goto(`/bilgi/${article.slug}`);
  const jsonLd = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(jsonLd.join(" ")).toContain("Article");
  expect(jsonLd.join(" ")).toContain("BreadcrumbList");
  expect(jsonLd.join(" ")).toContain("https://www.osym.gov.tr");
  await expect(
    page.getByRole("link", { name: "WhatsApp ile paylaş" }),
  ).toHaveAttribute("href", /wa\.me/);
  await expect(page.getByRole("link", { name: "X ile paylaş" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Facebook ile paylaş" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Bağlantıyı kopyala" })).toBeVisible();
  await page.getByRole("link", { name: "Koçla konuş" }).click();

  await expect
    .poll(() => new URL(page.url()).searchParams.get("contextArticleSlug"))
    .toBe(article.slug);

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
  await page.goto(`/en/knowledge/${article.slug}`);

  await expect(page.getByRole("link", { name: "Mentor" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in to ask the Coach" }),
  ).toHaveAttribute("href", "/en/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex, follow/i,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`/bilgi/${article.slug}$`),
  );
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
    "content",
    "Mentor",
  );
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
    "content",
    "en_US",
  );
  await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute(
    "content",
    /^https?:\/\//,
  );
  await expect(page.locator('meta[name="twitter:image"]').first()).toHaveAttribute(
    "content",
    /^https?:\/\//,
  );
  expect(api.unexpected).toEqual([]);

  const hub = await page.context().newPage();
  const hubApi = await mockKnowledgeApi(hub);
  await hub.goto("/en/knowledge");
  await expect(hub.getByRole("tab", { name: "KPSS" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(hub.getByRole("heading", { name: article.title }).first()).toBeVisible();
  await expect(
    hub.getByRole("link", { name: "Add to calendar" }),
  ).toBeVisible();
  expect(hubApi.unexpected).toEqual([]);
});

test("oturumlu ziyaretçi de public chrome görür ve panel bağlantısı alır", async ({
  page,
}) => {
  const api = await mockKnowledgeApi(page);

  await page.goto(`/bilgi/${article.slug}`);

  await expect(page.getByRole("link", { name: "Mentor" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Panele dön" })).toHaveAttribute(
    "href",
    "/panel",
  );
  await expect(page.getByTestId("app-sidebar")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Giriş yap" })).toHaveCount(0);
  expect(api.unexpected).toEqual([]);
});

test("refresh oturumu yoksa public header giriş bağlantısını korur", async ({
  page,
}) => {
  const api = await mockKnowledgeApi(page, { authenticated: false });

  await page.goto(`/en/knowledge/${article.slug}`);

  await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    "/en/login",
  );
  await expect(page.getByRole("link", { name: "Go to dashboard" })).toHaveCount(0);
  expect(api.unexpected).toEqual([]);
});

test("anonim makale reklamı doğrulanmış slug ile limited ayarları display öncesi uygular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 240 });
  await installDisplayGpt(page, false);
  const api = await mockKnowledgeApi(page, { authenticated: false });
  let requestedSlug: string | null = null;
  await page.route(
    "http://localhost:3001/v1/ads/public/placements/knowledge.article.end**",
    async (route) => {
      requestedSlug = new URL(route.request().url()).searchParams.get("contentSlug");
      await json(route, enabledContextualPlacement);
    },
  );

  await page.goto(`/bilgi/${article.slug}`);

  await page.waitForTimeout(150);
  expect(requestedSlug).toBeNull();
  await page
    .getByRole("complementary", { name: "Reklam" })
    .scrollIntoViewIfNeeded();
  await expect.poll(() => requestedSlug).toBe(article.slug);
  await expect(page.getByRole("complementary", { name: "Reklam" })).toBeVisible();
  const log = await page.evaluate(() =>
    (window as unknown as { __mentorGptLog: string[] }).__mentorGptLog,
  );
  expect(log.indexOf("privacy:limited")).toBeLessThan(log.indexOf("display"));
  expect(log).toContain("sizes:320x100,728x90");
  expect(api.unexpected).toEqual([]);
});

test("contextual no-fill alanı çöker; Premium kullanıcı GPT indirmez", async ({
  page,
  context,
}) => {
  await installDisplayGpt(page, true);
  await mockKnowledgeApi(page, { authenticated: false });
  await page.route(
    "http://localhost:3001/v1/ads/public/placements/knowledge.article.end**",
    (route) => json(route, enabledContextualPlacement),
  );
  await page.goto(`/bilgi/${article.slug}`);
  await expect(page.getByRole("complementary", { name: "Reklam" })).toBeHidden();

  const premiumPage = await context.newPage();
  let gptRequests = 0;
  premiumPage.on("request", (request) => {
    if (request.url().includes("/tag/js/gpt.js")) gptRequests += 1;
  });
  await mockKnowledgeApi(premiumPage);
  await premiumPage.goto(`/bilgi/${article.slug}`);
  await premiumPage.waitForTimeout(200);
  expect(gptRequests).toBe(0);
});

const subscription: SubscriptionView = {
  subscription: null,
  entitlement: {
    tier: "PREMIUM",
    isPremium: true,
    validUntil: "2026-08-21T00:00:00.000Z",
    reason: "ACTIVE",
  },
  features: {} as SubscriptionView["features"],
  discount: null,
};

const enabledContextualPlacement = {
  id: "knowledge.article.end",
  format: "DISPLAY",
  enabled: true,
  reason: "ELIGIBLE",
  provider: "GOOGLE_AD_MANAGER",
  adUnitPath: "/6355419/Travel/Europe/France/Paris",
  audienceTreatment: "CHILD",
  limitedAds: true,
  sizes: [[320, 100], [728, 90]],
};

const today: TodayPanelResponse = {
  greetingName: "Bilgi Test",
  motivationalLine: "Bugün tek bir adım yeter.",
  countdown: null,
  streak: { currentStreak: 0, longestStreak: 0, freezeTokens: 2 },
  tasks: [],
  nextAction: {
    kind: "ADD_TASK",
    title: "Bugünün tek küçük adımı",
    message: "Bugün için küçük bir görev ekleyebilirsin.",
    taskId: null,
  },
  sessionPresets: [
    { id: "25_5", label: "25 / 5 dk", focusMinutes: 25, breakMinutes: 5 },
  ],
  mood: null,
  focusGoal: { goalMinutes: null, focusMinutesToday: 0 },
  focusingNow: null,
  weeklyRecapPeriod: null,
};

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
  options: {
    authenticated?: boolean;
    calendar?: ExamCalendarDto;
    articleTotal?: number;
  } = {},
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
      /\/v1\/content\/exams\/by-type\/[A-Z]+\/calendar$/.test(path)
    ) {
      return json(route, options.calendar ?? calendar);
    }
    if (
      method === "GET" &&
      path.startsWith("/v1/content/info-articles/featured")
    ) {
      return json(route, article);
    }
    if (
      method === "GET" &&
      path.startsWith("/v1/content/info-articles?family=")
    ) {
      return json(route, {
        items: [article],
        total: options.articleTotal ?? 1,
        page: Number(url.searchParams.get("page") ?? 1),
        pageSize: 12,
      });
    }
    if (
      method === "POST" &&
      path === `/v1/content/info-articles/${article.slug}/views`
    ) {
      return json(route, null, 204);
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
    // The composer now reads calibration/memory state on mount to decide what to show before the
    // first message — reached the same way `/v1/coach/access` is, via the "makaleyi taşı" hand-off.
    if (method === "GET" && path === "/v1/coach/profile") {
      return json(route, {
        calibrationStatus: "COMPLETED",
        memoryConsent: "GRANTED",
        supportPreference: "BALANCED",
        directnessPreference: "BALANCED",
        updatedAt: "2026-08-01T00:00:00.000Z",
      });
    }
    // The app shell nav reads the coin pill + premium state on every authenticated route,
    // including /bilgi — not "unexpected", just not this suite's subject.
    if (method === "GET" && path.startsWith("/v1/economy/")) {
      return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }
    if (
      method === "GET" &&
      [
        "/v1/community/achievements/unseen",
        "/v1/community/journey-levels/unseen",
      ].includes(path)
    ) {
      return json(route, { celebrations: [] });
    }
    if (method === "GET" && path === "/v1/subscription") {
      return json(route, subscription);
    }
    if (
      method === "GET" &&
      path.startsWith("/v1/ads/placements/knowledge.article.end")
    ) {
      return json(route, {
        id: "knowledge.article.end",
        format: "DISPLAY",
        enabled: false,
        reason: "PREMIUM_AD_FREE",
        provider: "GOOGLE_AD_MANAGER",
        adUnitPath: null,
        audienceTreatment: "NONE",
        limitedAds: true,
        sizes: [[320, 100], [728, 90]],
      });
    }
    if (
      method === "GET" &&
      path.startsWith("/v1/ads/public/placements/knowledge.article.end")
    ) {
      return json(route, {
        id: "knowledge.article.end",
        format: "DISPLAY",
        enabled: false,
        reason: "GLOBAL_DISABLED",
        provider: "GOOGLE_AD_MANAGER",
        adUnitPath: null,
        audienceTreatment: "NONE",
        limitedAds: true,
        sizes: [[320, 100], [728, 90]],
      });
    }
    // Only reached by the "Koçla konuş" hand-off, which lands on the coach chat route.
    if (method === "GET" && path === "/v1/coaching/today") {
      return json(route, today);
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
  "access-control-allow-origin": process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3100",
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

async function installDisplayGpt(page: Page, empty: boolean): Promise<void> {
  await page.addInitScript((isEmpty) => {
    const listeners = new Map<string, Array<(event: { slot: object; isEmpty?: boolean }) => void>>();
    const log: string[] = [];
    const slot = {};
    const pubads = {
      addEventListener(name: string, listener: (event: { slot: object; isEmpty?: boolean }) => void) {
        listeners.set(name, [...(listeners.get(name) ?? []), listener]);
      },
      removeEventListener() {},
      collapseEmptyDivs() { log.push("collapse"); },
      setPrivacySettings(settings: { limitedAds?: boolean }) {
        log.push(settings.limitedAds ? "privacy:limited" : "privacy:other");
      },
    };
    const googletag = {
      cmd: { push(callback: () => void) { callback(); return 1; } },
      enums: { OutOfPageFormat: { REWARDED: "REWARDED" } },
      defineSlot(_path: string, sizes: number[][]) {
        log.push(`sizes:${sizes.map((size) => size.join("x")).join(",")}`);
        return { addService: () => slot };
      },
      defineOutOfPageSlot: () => null,
      pubads: () => pubads,
      enableServices() { log.push("enable"); },
      display() {
        log.push("display");
        setTimeout(() => {
          for (const listener of listeners.get("slotRenderEnded") ?? []) {
            listener({ slot, isEmpty });
          }
        }, 0);
      },
      destroySlots: () => true,
    };
    Object.assign(window, { googletag, __mentorGptLog: log });
  }, empty);
  await page.route("https://pagead2.googlesyndication.com/tag/js/gpt.js", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
}
