import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

/** Topluluk Tur 1, stop C: Akış (fallback, waiting questions, compose deep links) and rooms. */

const user: AuthUser = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "mentor@test.local",
  displayName: "Ada Yılmaz",
  username: "ada",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "KPSS",
  examVariant: null,
  examDate: "2027-07-25",
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const author = { id: "p1", displayName: "Selin Aksoy", username: "selin_aksoy", avatarUrl: null };

const chatZone = zone("z1", "CHAT", "Genel Sohbet", "genel-sohbet", null);
const qaZone = zone("z4", "QA", "Soru & Cevap", "soru-cevap", "ACTIVE");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"));
});

test("Akış: sessiz öne çıkan en yenilere düşer, not söylenir, sorunun durumu yazılır", async ({ page }, testInfo) => {
  const feedQueries = await mockApi(page);
  await page.goto("/topluluk/akis");

  await expect(page.getByText("Son günlerde öne çıkan yok, en tazeler burada!")).toBeVisible();
  await expect(page.getByText("Herkese kolay gelsin, bu hafta verimli geçsin.")).toBeVisible();
  await expect(page.getByText("Çözüldü", { exact: true })).toBeVisible();
  // No colourful chips: the room is meta text, the old "Soru" badge is gone.
  await expect(page.getByText("Soru", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("feed.png"), fullPage: true });

  await page.getByRole("button", { name: "Cevap bekleyen" }).click();
  await expect(page.getByRole("button", { name: "Cevap bekleyen" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: waitingQuestion.body })).toBeVisible();
  expect(feedQueries.some((q) => q.get("unanswered") === "true" && q.get("contentType") === "questions")).toBe(true);
});

test("Akış: seçili sekmeye ya da çipe yeniden dokunmak listeyi iskelette bırakmaz", async ({ page }, testInfo) => {
  // The selected tab/chip used to reset the list to its skeleton without asking for a new page:
  // the query was unchanged, so nothing reloaded and the skeleton stayed for good.
  await mockApi(page);
  await page.goto("/topluluk/akis");
  const post = page.getByText("Herkese kolay gelsin, bu hafta verimli geçsin.");
  await expect(post).toBeVisible();

  await page.getByRole("button", { name: "Tümü" }).click();
  await expect(post).toBeVisible();
  if (testInfo.project.name.startsWith("desktop")) {
    await page.getByRole("tab", { name: "Öne çıkan" }).click();
    await expect(post).toBeVisible();
  }
});

test("Akış: ?content=waiting çipi açık gelir, ?compose=question soru penceresini açar", async ({ page }) => {
  const feedQueries = await mockApi(page);
  await page.goto("/topluluk/akis?content=waiting");
  await expect(page.getByRole("button", { name: "Cevap bekleyen" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: waitingQuestion.body })).toBeVisible();
  expect(feedQueries[0]?.get("unanswered")).toBe("true");

  await page.goto("/topluluk/akis?compose=question");
  await expect(page.getByRole("dialog", { name: "Soru sor" })).toBeVisible();
  await expect(page).not.toHaveURL(/compose=/);
});

test("Gündem kalktı: eski bağlantı Akış'ın Popüler sekmesine kalıcı yönlenir", async ({ page }) => {
  const feedQueries = await mockApi(page);
  await page.goto("/topluluk/gundem");

  await expect(page).toHaveURL(/\/topluluk\/akis\?sort=top$/);
  await expect.poll(() => feedQueries.some((q) => q.get("sort") === "top")).toBe(true);
  await expect(page.getByRole("link", { name: "Gündem" })).toHaveCount(0);
});

test("Oda: üye değilsen tek ledge 'Odaya katıl', yazma alanı yok; katılınca yazma alanı gelir", async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto("/topluluk/genel-sohbet");

  await expect(page.getByRole("heading", { level: 1, name: "Genel Sohbet" })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveText(["En yeni", "En popüler", "Hakkında"]);
  // The tab pattern's keyboard: arrows move the selection and the focus together.
  await page.getByRole("tab", { name: "En yeni" }).focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Hakkında" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Hakkında" })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "En yeni" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Odaya katıl" })).toHaveCount(1);
  await expect(page.getByPlaceholder("Aklında ne var?", { exact: true })).toHaveCount(0);
  await expect(page.locator('img[src*="/img/feed.png"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("room-visitor.png"), fullPage: true });

  await page.getByRole("button", { name: "Odaya katıl" }).click();
  await expect(page.getByRole("button", { name: "Odaya katıl" })).toHaveCount(0);
  await expect(page.getByPlaceholder("Aklında ne var?", { exact: true })).toBeVisible();
});

test("Soru-cevap odası: her soruda tek durum; bekliyor, cevap sayısı, çözüldü", async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto("/topluluk/soru-cevap");

  await expect(page.getByRole("heading", { level: 1, name: "Soru & Cevap" })).toBeVisible();
  await expect(page.getByText("Cevap bekliyor", { exact: true })).toBeVisible();
  await expect(page.getByText("3 cevap", { exact: true })).toBeVisible();
  await expect(page.getByText("Çözüldü", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Soru sor" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("room-qa.png"), fullPage: true });
});

const featuredPost = feedItem("t1", chatZone, "Herkese kolay gelsin, bu hafta verimli geçsin.", null, 3, null);
const solvedQuestion = feedItem("t2", qaZone, "Paragrafta ana düşünce nasıl bulunur?", "Paragrafta ana düşünce nasıl bulunur?", 12, "post-1");
const waitingQuestion = feedItem("t3", qaZone, "Bölünebilme kurallarında 11'e bölünebilme nasıl uygulanır?", "Bölünebilme kurallarında 11'e bölünebilme nasıl uygulanır?", 0, null);

async function mockApi(page: Page): Promise<URLSearchParams[]> {
  const feedQueries: URLSearchParams[] = [];
  let chatStatus: "ACTIVE" | null = null;
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path === "/v1/forum/zones") {
      const zones = [{ ...chatZone, myStatus: chatStatus }, qaZone];
      return json(route, { items: zones, page: 1, pageSize: 100, total: zones.length });
    }
    if (method === "GET" && path === "/v1/forum/tags") return json(route, []);
    if (method === "GET" && path === "/v1/forum/trends") return json(route, { items: [], scope: "relevant", examType: "KPSS", windowHours: 72 });
    if (method === "GET" && path === "/v1/forum/feed") {
      feedQueries.push(url.searchParams);
      const waiting = url.searchParams.get("unanswered") === "true";
      const items = waiting ? [waitingQuestion] : [featuredPost, solvedQuestion];
      const effectiveSort = url.searchParams.get("sort") === "trending" ? "recent" : url.searchParams.get("sort");
      return json(route, { items, nextCursor: null, effectiveSort, context: { activeThreads: [], suggestedThreads: [] } });
    }
    if (method === "GET" && path === "/v1/forum/zones/genel-sohbet/feed") {
      return json(route, zoneFeed({ ...chatZone, myStatus: chatStatus, myRole: chatStatus ? "MEMBER" : null }, [thread("c1", chatZone.id, "Sabah erken kalkıp çalışmak çok verimli.", null, 2, null)]));
    }
    if (method === "GET" && path === "/v1/forum/zones/soru-cevap/feed") {
      return json(route, zoneFeed(qaZone, [
        thread("q1", qaZone.id, "Sözel mantıkta hız nasıl kazanılır?", "Sözel mantıkta hız nasıl kazanılır?", 0, null),
        thread("q2", qaZone.id, "Tanzimat Fermanı'nın en önemli sonucu?", "Tanzimat Fermanı'nın en önemli sonucu?", 3, null),
        thread("q3", qaZone.id, "Benzerlikte alan oranı neden kare?", "Benzerlikte alan oranı neden kare?", 4, "post-9"),
      ]));
    }
    if (method === "POST" && path === `/v1/forum/zones/${chatZone.id}/join`) {
      chatStatus = "ACTIVE";
      return json(route, { status: "ACTIVE" });
    }
    if (method === "GET" && path === "/v1/coaching/today") return json(route, { focusingNow: null });
    if (method === "GET" && path === "/v1/buddy") return json(route, { active: null, outgoing: null, incoming: [] });
    if (method === "GET" && path.startsWith("/v1/notifications")) {
      if (path.endsWith("/stream")) return route.fulfill({ status: 200, contentType: "text/event-stream", headers: corsHeaders(route), body: "" });
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") return json(route, { token: "test-stream" });
    if (method === "GET" && path.startsWith("/v1/economy/")) return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    return json(route, null, 204);
  });
  return feedQueries;
}

function zone(id: string, type: "CHAT" | "QA", title: string, slug: string, myStatus: "ACTIVE" | null) {
  return {
    id,
    type,
    title,
    slug,
    description: type === "QA" ? "Takıldığın soruyu sor, çözen arkadaşlarından cevap al." : "Sınav yolculuğunda aklına takılan her şey.",
    visibility: "PUBLIC",
    joinPolicy: "OPEN",
    examType: null,
    isArchived: false,
    memberCount: 42,
    threadCount: 18,
    myStatus,
    myRole: myStatus ? "MEMBER" : null,
    canModerate: false,
    createdAt: "2026-08-01T10:00:00.000Z",
  };
}

function zoneFeed(z: ReturnType<typeof zone> | Record<string, unknown>, items: unknown[]) {
  return { zone: z, feed: { items, nextCursor: null }, contributors: [author], pinnedThreads: [] };
}

function feedItem(
  id: string,
  z: ReturnType<typeof zone>,
  body: string,
  title: string | null,
  commentCount: number,
  acceptedPostId: string | null,
) {
  return {
    id,
    zone: { id: z.id, title: z.title, slug: z.slug, type: z.type },
    author,
    title,
    body,
    poll: null,
    status: acceptedPostId ? "ANSWERED" : "OPEN",
    acceptedPostId,
    isPinned: false,
    tags: [],
    reactionCounts: {},
    myReactions: [],
    helpfulVoteCount: 0,
    myHelpfulVote: false,
    canHelpfulVote: true,
    commentCount,
    attachments: [],
    myBookmarked: false,
    capabilities: { canEdit: false, canDelete: false, canModerate: false, editDeadline: null },
    createdAt: "2026-10-05T10:00:00.000Z",
    lastActivityAt: "2026-10-05T10:00:00.000Z",
    editedAt: null,
    score: 0,
  };
}

function thread(
  id: string,
  zoneId: string,
  body: string,
  title: string | null,
  commentCount: number,
  acceptedPostId: string | null,
) {
  return {
    id,
    zoneId,
    authorId: author.id,
    authorName: author.displayName,
    authorUsername: author.username,
    authorAvatarUrl: null,
    title,
    body,
    poll: null,
    status: acceptedPostId ? "ANSWERED" : "OPEN",
    acceptedPostId,
    isPinned: false,
    reactionCounts: {},
    myReactions: [],
    commentCount,
    attachments: [],
    myBookmarked: false,
    helpfulVoteCount: 0,
    myHelpfulVote: false,
    capabilities: { canEdit: false, canDelete: false, canModerate: false, editDeadline: null },
    createdAt: "2026-10-05T10:00:00.000Z",
    lastActivityAt: "2026-10-05T10:00:00.000Z",
    editedAt: null,
  };
}

const corsHeaders = (route: Route) => ({
  "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3100",
  "access-control-allow-credentials": "true",
});

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders(route),
    body: body == null ? "" : JSON.stringify(body),
  });
}
