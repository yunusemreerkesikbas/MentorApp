import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

/** Topluluk Tur 2, stop C: Kaydedilenler as its own page. */

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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"));
});

test("Kaydedilenler: kendi sayfası, kayıttan çıkarma geri alınabilir, kenar çubuğu seçili", async ({ page }, testInfo) => {
  const api = await mockApi(page, [savedThread, savedComment]);
  await page.goto("/topluluk/kayitli");

  await expect(page.getByRole("heading", { level: 1, name: "Kaydedilenler" })).toBeVisible();
  await expect(page.getByText(thread.body)).toBeVisible();
  await expect(page.getByText(comment.body)).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await expect(
      page.locator(".community-workspace__sidebar").getByRole("link", { name: "Kaydedilenler" }),
    ).toHaveAttribute("aria-current", "page");
  }
  await page.screenshot({ path: testInfo.outputPath("saved.png"), fullPage: true });

  // The server refuses the first unsave: the row comes back where it was, and the page says so.
  api.failNextUnsave = true;
  await page.getByRole("link").filter({ hasText: thread.body }).getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Bu adım şimdi uygulanamadı.", { exact: false })).toBeVisible();
  await expect(page.getByText(thread.body)).toBeVisible();

  await page.getByRole("link").filter({ hasText: thread.body }).getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText(thread.body)).toHaveCount(0);
  expect(api.unsaved).toContain(thread.id);
});

test("Kaydedilenler boşken Puhu konuşur ve Akış'a yollar", async ({ page }, testInfo) => {
  await mockApi(page, []);
  await page.goto("/topluluk/kayitli");

  await expect(page.getByText("Burası şimdilik boş.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Akış'a göz at" })).toHaveAttribute("href", "/topluluk/akis");
  await page.screenshot({ path: testInfo.outputPath("saved-empty.png"), fullPage: true });

  await page.context().addCookies([{ name: "mentor-theme", value: "dark", url: page.url() }]);
  await page.reload();
  await expect(page.getByText("Burası şimdilik boş.", { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("saved-empty-dark.png"), fullPage: true });
});

const author = { id: "p1", name: "Mert Arslan", username: "mert_arslan" };
const thread = {
  id: "t1",
  zoneId: "z1",
  authorId: author.id,
  authorName: author.name,
  authorUsername: author.username,
  authorAvatarUrl: null,
  title: null,
  body: "Haftalık tekrar planımı paylaşıyorum. Pazartesi ve perşembe deneme, araya konu tekrarı.",
  poll: null,
  status: "OPEN",
  acceptedPostId: null,
  isPinned: false,
  reactionCounts: { "❤️": 24 },
  myReactions: [],
  commentCount: 9,
  commenterNames: [],
  attachments: [],
  myBookmarked: true,
  helpfulVoteCount: 0,
  myHelpfulVote: false,
  canHelpfulVote: true,
  capabilities: { canEdit: false, canDelete: false, canModerate: false, editDeadline: null },
  createdAt: "2026-10-06T10:00:00.000Z",
  lastActivityAt: "2026-10-06T10:00:00.000Z",
  editedAt: null,
};
const comment = {
  id: "c1",
  threadId: "t9",
  parentPostId: null,
  authorId: "p2",
  authorName: "Selin Aksoy",
  authorUsername: "selin_aksoy",
  authorAvatarUrl: null,
  body: "Ben üç tur yapıyorum: emin olduklarım, işaretlediklerim, son 15 dakika kontrol.",
  reactionCounts: {},
  myReactions: [],
  replyCount: 0,
  attachments: [],
  myBookmarked: true,
  capabilities: { canEdit: false, canDelete: false, canModerate: false, editDeadline: null },
  createdAt: "2026-10-05T11:00:00.000Z",
};
const savedThread = { type: "thread", thread };
const savedComment = { type: "comment", comment };

async function mockApi(page: Page, items: unknown[]) {
  const api = { failNextUnsave: false, unsaved: [] as string[] };
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path === "/v1/forum/bookmarks") return json(route, { items, nextCursor: null });
    if (method === "DELETE" && /^\/v1\/forum\/(threads|posts)\/[^/]+\/bookmark$/.test(path)) {
      if (api.failNextUnsave) {
        api.failNextUnsave = false;
        return json(route, { code: "INTERNAL", message: "Kapalı" }, 500);
      }
      api.unsaved.push(path.split("/")[4]!);
      return json(route, null, 204);
    }
    if (method === "GET" && path === "/v1/forum/zones") return json(route, { items: [], page: 1, pageSize: 100, total: 0 });
    if (method === "GET" && path === "/v1/forum/feed") {
      return json(route, { items: [], nextCursor: null, effectiveSort: "recent", context: { activeThreads: [], suggestedThreads: [] } });
    }
    if (method === "GET" && path === "/v1/coaching/today") return json(route, { focusingNow: 38 });
    if (method === "GET" && path.startsWith("/v1/notifications")) {
      if (path.endsWith("/stream")) return route.fulfill({ status: 200, contentType: "text/event-stream", headers: corsHeaders(route), body: "" });
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") return json(route, { token: "test-stream" });
    if (method === "GET" && path.startsWith("/v1/economy/")) return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    return json(route, null, 204);
  });
  return api;
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
