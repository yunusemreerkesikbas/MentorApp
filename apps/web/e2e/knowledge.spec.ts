import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  ExamCalendarDto,
  InfoArticleDto,
  SubscriptionView,
  TodayPanelResponse,
} from "@mentor/types";
import { IDLE_STREAK } from "./streak.fixture";

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
  metaTitle: "KPSS Başvuru Süreci | Mentor Blog",
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

// The hub renders on the server now, so `page.route` cannot stand in for its data: these tests
// read the seeded KPSS posts from the local API (the article tests always did). `mockKnowledgeApi`
// still answers the browser's own calls (auth refresh, views, coach, ads).
test("blog hub herkese açık ve KPSS ile açılır", async ({ page }) => {
  const api = await mockKnowledgeApi(page, { authenticated: false });
  await page.goto("/blog");

  await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();
  await expect(page.getByRole("link", { name: "KPSS", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("heading", { name: article.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "KPSS Sınav Günü Kuralları", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Giriş yap" })).toBeVisible();
  await expect(page.getByTestId("app-sidebar")).toHaveCount(0);
  expect(api.unexpected).toEqual([]);
});

test("konu bağlantısı adresi ve listeyi değiştirir", async ({ page }) => {
  await mockKnowledgeApi(page, { authenticated: false });
  await page.goto("/blog");

  await page.getByRole("link", { name: "Sınav süreci", exact: true }).click();
  await expect(page).toHaveURL(/category=EXAM_PROCESS/);
  await expect(
    page.getByRole("heading", { name: "KPSS Sınav Günü Kuralları" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: article.title })).toHaveCount(0);
});

test("yazısı olmayan sınav ve son sayfanın ötesi sakin mesaj verir", async ({
  page,
}) => {
  await mockKnowledgeApi(page, { authenticated: false });
  await page.goto("/blog?family=YKS");
  await expect(page.getByText("Bu sınav için henüz doğrulanmış yazı yok.")).toBeVisible();

  await page.goto("/blog?page=9");
  await expect(page.getByText("Bu sayfada yazı yok.")).toBeVisible();
  await expect(page.getByRole("link", { name: "İlk sayfaya dön" })).toHaveAttribute(
    "href",
    "/blog",
  );
});

test("eski /bilgi adresleri /blog'a kalıcı yönlenir", async ({ page }) => {
  const response = await page.request.get("/bilgi/kpss-basvuru-sureci", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/blog/kpss-basvuru-sureci");

  await mockKnowledgeApi(page, { authenticated: false });
  await page.goto("/bilgi?category=GENERAL");
  await expect(page).toHaveURL(/\/blog\?category=GENERAL$/);
});

test("oturumlu ziyaretçi hub'da panel bağlantısı alır", async ({ page }) => {
  const api = await mockKnowledgeApi(page);
  await page.goto("/blog");

  await expect(page.getByRole("link", { name: "Panele dön" })).toHaveAttribute(
    "href",
    "/panel",
  );
  expect(api.unexpected).toEqual([]);
});

test("makaleyi Koç composerına taşır ama otomatik göndermez", async ({
  page,
}) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  const api = await mockKnowledgeApi(page);
  await page.goto(`/blog/${article.slug}`);
  const jsonLd = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(jsonLd.join(" ")).toContain("Article");
  expect(jsonLd.join(" ")).toContain("BreadcrumbList");
  expect(jsonLd.join(" ")).toContain('"name":"Blog"');
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
  await page.goto(`/en/blog/${article.slug}`);

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
    new RegExp(`/blog/${article.slug}$`),
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
  await hub.goto("/en/blog");
  await expect(hub.getByRole("link", { name: "KPSS", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(hub.getByRole("heading", { name: article.title }).first()).toBeVisible();
  // The isolated seed's 2026 calendar is now past; a stale event must not offer an ICS download.
  await expect(hub.getByRole("link", { name: "Add to calendar" })).toHaveCount(0);
  expect(hubApi.unexpected).toEqual([]);
});

test("oturumlu ziyaretçi de public chrome görür ve panel bağlantısı alır", async ({
  page,
}) => {
  const api = await mockKnowledgeApi(page);

  await page.goto(`/blog/${article.slug}`);

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

  await page.goto(`/en/blog/${article.slug}`);

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
    `${process.env.QA_STAGE2_API_URL?.trim() || "http://localhost:3001/v1"}/ads/public/placements/knowledge.article.end**`,
    async (route) => {
      requestedSlug = new URL(route.request().url()).searchParams.get("contentSlug");
      await json(route, enabledContextualPlacement);
    },
  );

  await page.goto(`/blog/${article.slug}`);

  await page.waitForTimeout(150);
  expect(requestedSlug).toBeNull();
  await page.getByRole("region", { name: "Bu konu kafanı mı kurcalıyor?" }).scrollIntoViewIfNeeded();
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
  const api = await mockKnowledgeApi(page, { authenticated: false });
  await page.route(
    `${process.env.QA_STAGE2_API_URL?.trim() || "http://localhost:3001/v1"}/ads/public/placements/knowledge.article.end**`,
    (route) => json(route, enabledContextualPlacement),
  );
  await page.goto(`/blog/${article.slug}`);
  const adSlot = page.locator('aside[aria-label="Reklam"]');
  await expect
    .poll(() =>
      api.requests.some(
        ({ method, path }) =>
          method === "POST" && path === "/v1/auth/refresh",
      ),
    )
    .toBe(true);
  await adSlot.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect(adSlot).toBeHidden();

  const premiumPage = await context.newPage();
  let gptRequests = 0;
  premiumPage.on("request", (request) => {
    if (request.url().includes("/tag/js/gpt.js")) gptRequests += 1;
  });
  await mockKnowledgeApi(premiumPage);
  await premiumPage.goto(`/blog/${article.slug}`);
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
  streak: IDLE_STREAK,
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

  await page.route(`${process.env.QA_STAGE2_API_URL?.trim() || "http://localhost:3001/v1"}/**`, async (route) => {
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
    // including /blog — not "unexpected", just not this suite's subject.
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
