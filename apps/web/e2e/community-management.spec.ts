import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

/** Topluluk Tur 2, stop F: room management shows people and what was reported, and asks before it removes. */

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

test("Oda yönetimi: bekleyenler isimle, çıkarma ve gizleme önce sorar, şikâyette özet ve Türkçe sebep", async ({ page }, testInfo) => {
  const api = await mockApi(page, true);
  await page.goto("/topluluk/matematik/yonetim");

  const crumb = page.getByRole("navigation", { name: "Sayfa yolu" });
  await expect(crumb.getByRole("link", { name: "Matematik & Geometri" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Oda yönetimi" })).toBeVisible();

  // Join requests are people, not ids.
  const members = page.getByRole("region", { name: "Üyeler" });
  await expect(members.getByText("Zeynep Kaya")).toBeVisible();
  await expect(members.getByText("@zeynep_k", { exact: false })).toBeVisible();
  await expect(members.getByText(/[0-9a-f]{8}…/)).toHaveCount(0);

  // Reports: Turkish reason and the start of what was reported.
  const reports = page.getByRole("region", { name: "Şikâyetler" });
  await expect(reports.getByText("Gönderi · Spam ya da reklam")).toBeVisible();
  await expect(reports.getByText("Deneme çözümlerinin hepsi bu linkte", { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("management.png"), fullPage: true, animations: "disabled" });

  await members.getByRole("button", { name: "Onayla" }).click();
  await expect(members.getByText("Zeynep Kaya")).toHaveCount(0);
  expect(api.approved).toEqual(["u-zeynep"]);

  // The approved request moves into the members list, count included, without a reload.
  await expect(members.getByRole("tab", { name: "Üyeler · 3" })).toBeVisible();
  await members.getByRole("tab", { name: /^Üyeler/ }).click();
  await expect(members.getByText("Zeynep Kaya")).toBeVisible();
  await expect(members.getByText("Burak Koç")).toBeVisible();
  await members.getByRole("listitem").filter({ hasText: "Burak Koç" }).getByRole("button", { name: "Çıkar" }).click();
  const confirmRemove = page.getByRole("alertdialog").or(page.getByRole("dialog")).filter({ hasText: "Odadan çıkarılsın mı?" });
  await expect(confirmRemove).toBeVisible();
  await confirmRemove.getByRole("button", { name: "Çıkar" }).click();
  await expect(members.getByText("Burak Koç")).toHaveCount(0);
  expect(api.removed).toEqual(["u-burak"]);

  await reports.getByRole("button", { name: "Gizle" }).click();
  const confirmHide = page.getByRole("alertdialog").or(page.getByRole("dialog")).filter({ hasText: "Bu içerik gizlensin mi?" });
  await expect(confirmHide).toBeVisible();
  await confirmHide.getByRole("button", { name: "Gizle" }).click();
  await expect(reports.getByText("Gönderi · Spam ya da reklam")).toHaveCount(0);
  expect(api.resolved).toEqual(["r1:HIDE"]);
});

test("Oda yönetimi: moderatör değilsen odaya geri gönderilirsin", async ({ page }) => {
  await mockApi(page, false);
  await page.goto("/topluluk/matematik/yonetim");
  await expect(page).toHaveURL(/\/topluluk\/matematik$/);
});

const zone = (canModerate: boolean) => ({
  id: "z2",
  type: "CHAT",
  title: "Matematik & Geometri",
  slug: "matematik",
  description: null,
  visibility: "PUBLIC",
  joinPolicy: "REQUEST",
  examType: null,
  isArchived: false,
  memberCount: 128,
  threadCount: 412,
  myStatus: "ACTIVE",
  myRole: canModerate ? "OWNER" : "MEMBER",
  canModerate,
  createdAt: "2026-08-01T10:00:00.000Z",
});

const member = (userId: string, displayName: string, username: string, role: string, status: string) => ({
  userId,
  displayName,
  username,
  avatarUrl: null,
  role,
  status,
  createdAt: "2026-10-08T07:00:00.000Z",
});

async function mockApi(page: Page, canModerate: boolean) {
  const api = { approved: [] as string[], removed: [] as string[], resolved: [] as string[] };
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path === "/v1/forum/zones/matematik") return json(route, zone(canModerate));
    if (method === "GET" && path === "/v1/forum/zones/z2/members") {
      return url.searchParams.get("status") === "PENDING"
        ? json(route, [member("u-zeynep", "Zeynep Kaya", "zeynep_k", "MEMBER", "PENDING")])
        : json(route, [
            member("33333333-3333-4333-8333-333333333333", "Ada Yılmaz", "ada", "OWNER", "ACTIVE"),
            member("u-burak", "Burak Koç", "burakkoc", "MEMBER", "ACTIVE"),
          ]);
    }
    const approve = path.match(/^\/v1\/forum\/zones\/z2\/members\/([^/]+)\/approve$/);
    if (method === "POST" && approve) {
      api.approved.push(approve[1]!);
      return json(route, null, 204);
    }
    const remove = path.match(/^\/v1\/forum\/zones\/z2\/members\/([^/]+)$/);
    if (method === "DELETE" && remove) {
      api.removed.push(remove[1]!);
      return json(route, null, 204);
    }
    if (method === "GET" && path === "/v1/forum/zones/z2/reports") {
      const open = url.searchParams.get("status") === "OPEN";
      return json(route, {
        items: open
          ? [{ id: "r1", targetType: "THREAD", targetId: "t1", zoneId: "z2", reporterId: "u9", reason: "SPAM", note: null, excerpt: "Deneme çözümlerinin hepsi bu linkte, ücretsiz indirin", status: "OPEN", createdAt: "2026-10-08T08:00:00.000Z" }]
          : [],
        total: open ? 1 : 0,
        page: 1,
        pageSize: 50,
      });
    }
    const resolve = path.match(/^\/v1\/forum\/reports\/([^/]+)\/resolve$/);
    if (method === "POST" && resolve) {
      api.resolved.push(`${resolve[1]}:${(request.postDataJSON() as { action: string }).action}`);
      return json(route, null, 204);
    }
    if (method === "GET" && path === "/v1/forum/zones") return json(route, { items: [zone(canModerate)], page: 1, pageSize: 100, total: 1 });
    if (method === "GET" && path === "/v1/forum/zones/matematik/feed") {
      return json(route, { zone: zone(canModerate), feed: { items: [], nextCursor: null }, contributors: [], pinnedThreads: [] });
    }
    if (method === "GET" && path === "/v1/coaching/today") return json(route, { focusingNow: null });
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
