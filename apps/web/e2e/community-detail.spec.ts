import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

/** Topluluk Tur 1, stop D: question and post detail on the panel frame. */

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

const asker = { id: "p2", name: "Emre Çelik", username: "emre_celik" };
const solver = { id: "p1", name: "Selin Aksoy", username: "selin_aksoy" };
const answerer = { id: "p3", name: "Can Öztürk", username: "can_ozturk" };

const chatZone = zone("z1", "CHAT", "Genel Sohbet", "genel-sohbet");
const qaZone = zone("z4", "QA", "Soru & Cevap", "soru-cevap");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"));
});

test("Soru detayı: tek durum, N cevap, çözüm yeşil çerçevede önde, Ben de takıldım, Bu soruda", async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto("/topluluk/soru/q3");

  const crumb = page.getByRole("navigation", { name: "Sayfa yolu" });
  await expect(crumb.getByRole("link", { name: "Topluluk" })).toBeVisible();
  await expect(crumb.getByRole("link", { name: "Soru & Cevap" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: questionTitle })).toBeVisible();
  await expect(page.getByText("Çözüldü", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ben de takıldım" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "2 cevap" })).toBeVisible();
  const answerCards = page.locator("section[aria-labelledby='answers-title'] article");
  await expect(answerCards).toHaveCount(2);
  await expect(answerCards.first()).toContainText("Çözüm");
  await expect(answerCards.first()).toContainText(solver.name);
  await expect(answerCards.nth(1)).not.toContainText("Çözüm");

  const people = page.getByRole("region", { name: "Bu soruda" });
  // toContainText: each row also carries the avatar's initials.
  await expect(people.getByRole("listitem")).toContainText([
    `${asker.name}Soran`,
    `${solver.name}Çözümü yazdı`,
    `${answerer.name}Cevap yazdı`,
  ]);
  await expect(page.getByRole("heading", { name: "Sen de el uzat!" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cevapla" })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("question.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "2 cevap" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("question-mobile.png"), fullPage: true });

  await page.context().addCookies([{ name: "mentor-theme", value: "dark", url: page.url() }]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "2 cevap" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("question-dark.png"), fullPage: true });
});

test("Gönderi detayı: yol Topluluk › oda › Gönderi, yorumlar tek kartta, rail'de odası", async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto("/topluluk/mesaj/t1");

  const crumb = page.getByRole("navigation", { name: "Sayfa yolu" });
  await expect(crumb.getByRole("link", { name: "Genel Sohbet" })).toBeVisible();
  await expect(crumb.getByText("Gönderi", { exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(post.body)).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 yorum" })).toBeVisible();
  await expect(page.getByText(comment.body)).toBeVisible();
  await expect(page.getByRole("link", { name: "Odaya git" })).toHaveAttribute("href", "/topluluk/genel-sohbet");
  await page.screenshot({ path: testInfo.outputPath("post.png"), fullPage: true });
});

test("Soru detayı (375 px): çözüm kartında yazar adı kesilmez, önce @kullanıcı adı kısalır", async ({ page }) => {
  await mockApi(page);
  const coach = { id: "p7", name: "Koç Cem Aydın", username: "koccem_aydin_kpss" };
  await page.route(/\/v1\/forum\/threads\/q3(\?|$)/, (route) =>
    json(route, { question, answers: [answer("a1", coach, answers[0]!.body, true), answers[1]] }));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/topluluk/soru/q3");
  const name = page.locator("section[aria-labelledby='answers-title'] article").first().getByText(coach.name, { exact: true });
  await expect(name).toBeVisible();
  // The truncating box is the name link around the span.
  expect(await name.evaluate((el) => { const box = el.closest("a") ?? el; return box.scrollWidth <= box.clientWidth + 1; }), "name is not cut").toBe(true);
});

test("Detaylarda adsız bağlantı yok: avatar bağlantısı adın tekrarı olarak gizlenir", async ({ page }) => {
  // The avatar repeated the name link next to it but had no accessible name of its own, so a screen
  // reader announced an empty link before every post, comment and answer.
  await mockApi(page);
  // The accessibility tree is the truth: the avatar's initials are aria-hidden, so its text is no name.
  const unnamedLinks = async () =>
    ((await page.locator("main").ariaSnapshot()).match(/^\s*- link(?::\s*$|\s*$)/gm) ?? []).length;
  for (const path of ["/topluluk/mesaj/t1", "/topluluk/soru/q3"]) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeAttached();
    await expect(page.getByText(/Bu hafta her gün|Üç tur yapıyorum/).first()).toBeVisible();
    expect(await unnamedLinks(), `${path} has no unnamed links`).toBe(0);
  }
});

test("Gönderi detayı: doğrudan açılan kendi gönderisini silen odasına döner, uygulamadan çıkmaz", async ({ page }) => {
  // A notification or shared link opens the detail with no history behind it; router.back() then
  // left the app for about:blank.
  await mockApi(page);
  const own = {
    ...thread("t2", chatZone.id, { id: user.id, name: user.displayName, username: user.username! }, "Silinecek kısa not.", null),
    capabilities: { canEdit: true, canDelete: true, canModerate: false, editDeadline: null },
  };
  await page.route("http://localhost:3001/v1/forum/threads/t2/detail", (route) => json(route, { thread: own, comments: [] }));
  await page.goto("/topluluk/mesaj/t2");
  await expect(page.getByText(own.body)).toBeVisible();

  await page.getByRole("button", { name: "İşlemler" }).click();
  await page.getByRole("menuitem", { name: "Sil" }).click();
  await page.getByRole("alertdialog").or(page.getByRole("dialog")).getByRole("button", { name: "Sil" }).click();
  await expect(page).toHaveURL(/\/topluluk\/genel-sohbet$/);
});

const questionTitle = "Deneme sınavında zaman yönetimi için önerin ne?";
const question = {
  ...thread("q3", qaZone.id, asker, "Matematiğe takılıp Türkçeye vakit kalmıyor. Nasıl bir sıra izlemeliyim?", questionTitle),
  status: "ANSWERED",
  acceptedPostId: "a1",
  commentCount: 2,
  tags: [],
};
const answers = [
  answer("a1", solver, "Üç tur yapıyorum: emin olduklarım, işaretlediklerim, son 15 dakika kontrol.", true),
  answer("a2", answerer, "Matematikte iki dakikayı geçince işaretleyip geçiyorum.", false),
];
const post = { ...thread("t1", chatZone.id, solver, "Bu hafta her gün önce 20 dakika tekrar, sonra soru.", null), commentCount: 1 };
const comment = {
  id: "c1",
  threadId: "t1",
  parentPostId: null,
  authorId: answerer.id,
  authorName: answerer.name,
  authorUsername: answerer.username,
  authorAvatarUrl: null,
  body: "Aynen, konu tekrarı olmadan hep aynı yerde takılıyordum.",
  reactionCounts: {},
  myReactions: [],
  replyCount: 0,
  attachments: [],
  myBookmarked: false,
  capabilities: { canEdit: false, canDelete: false, canModerate: false, editDeadline: null },
  createdAt: "2026-10-05T11:00:00.000Z",
};
const waitingQuestion = {
  id: "t9",
  zone: { id: qaZone.id, title: qaZone.title, slug: qaZone.slug, type: "QA" },
  author: { id: answerer.id, displayName: answerer.name, username: answerer.username, avatarUrl: null },
  title: "Sözel mantık sorularında hız nasıl kazanılır?",
  body: "Sözel mantık sorularında hız nasıl kazanılır?",
  poll: null,
  status: "OPEN",
  acceptedPostId: null,
  isPinned: false,
  tags: [],
  reactionCounts: {},
  myReactions: [],
  commentCount: 0,
  attachments: [],
  myBookmarked: false,
  createdAt: "2026-10-05T10:00:00.000Z",
  lastActivityAt: "2026-10-05T10:00:00.000Z",
  score: 0,
};

async function mockApi(page: Page): Promise<void> {
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path === "/v1/forum/zones") {
      return json(route, { items: [chatZone, qaZone], page: 1, pageSize: 100, total: 2 });
    }
    if (method === "GET" && path === "/v1/forum/threads/q3") return json(route, { question, answers });
    if (method === "GET" && path === "/v1/forum/threads/t1/detail") return json(route, { thread: post, comments: [comment] });
    if (method === "GET" && path === "/v1/forum/feed") {
      return json(route, { items: [waitingQuestion], nextCursor: null, effectiveSort: "recent", context: { activeThreads: [], suggestedThreads: [] } });
    }
    if (method === "GET" && path === "/v1/forum/tags") return json(route, []);
    if (method === "GET" && path === "/v1/coaching/today") return json(route, { focusingNow: 38 });
    if (method === "GET" && path.startsWith("/v1/notifications")) {
      if (path.endsWith("/stream")) return route.fulfill({ status: 200, contentType: "text/event-stream", headers: corsHeaders(route), body: "" });
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") return json(route, { token: "test-stream" });
    if (method === "GET" && path.startsWith("/v1/economy/")) return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    return json(route, null, 204);
  });
}

function zone(id: string, type: "CHAT" | "QA", title: string, slug: string) {
  return {
    id,
    type,
    title,
    slug,
    description: null,
    visibility: "PUBLIC",
    joinPolicy: "OPEN",
    examType: null,
    isArchived: false,
    memberCount: 1240,
    threadCount: 3860,
    myStatus: "ACTIVE",
    myRole: "MEMBER",
    canModerate: false,
    createdAt: "2026-08-01T10:00:00.000Z",
  };
}

function thread(id: string, zoneId: string, by: typeof asker, body: string, title: string | null) {
  return {
    id,
    zoneId,
    authorId: by.id,
    authorName: by.name,
    authorUsername: by.username,
    authorAvatarUrl: null,
    title,
    body,
    poll: null,
    status: "OPEN",
    acceptedPostId: null,
    isPinned: false,
    reactionCounts: {},
    myReactions: [],
    commentCount: 0,
    commenterNames: [],
    attachments: [],
    myBookmarked: false,
    helpfulVoteCount: 0,
    myHelpfulVote: false,
    canHelpfulVote: true,
    capabilities: { canEdit: false, canDelete: false, canModerate: false, editDeadline: null },
    createdAt: "2026-10-05T10:00:00.000Z",
    lastActivityAt: "2026-10-05T10:00:00.000Z",
    editedAt: null,
  };
}

function answer(id: string, by: typeof asker, body: string, isAccepted: boolean) {
  return {
    id,
    threadId: "q3",
    authorId: by.id,
    authorName: by.name,
    authorUsername: by.username,
    authorAvatarUrl: null,
    body,
    isAccepted,
    attachments: [],
    myBookmarked: false,
    helpfulVoteCount: isAccepted ? 14 : 6,
    myHelpfulVote: false,
    canHelpfulVote: true,
    createdAt: "2026-10-05T11:00:00.000Z",
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
