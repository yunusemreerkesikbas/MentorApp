import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

const user: AuthUser = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "mentor@test.local",
  displayName: "Yunus Emre Erkesikbaş",
  username: "yunus_emre",
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

const people = [
  { id: "p1", displayName: "Merve Doğan", username: "merve_dogan", avatarUrl: null },
  { id: "p2", displayName: "Elif Demir", username: "elif_demir", avatarUrl: null },
  { id: "p3", displayName: "Kerem Polat", username: "kerem_polat", avatarUrl: null },
];

const zones = [
  zone("z1", "CHAT", "Genel Sohbet", "genel-sohbet", 38, "ACTIVE"),
  zone("z2", "CHAT", "Matematik & Geometri", "matematik-geometri", 24, "ACTIVE"),
  zone("z3", "ANNOUNCEMENT", "Duyurular", "duyurular", 7, "ACTIVE"),
  zone("z4", "QA", "Soru-Cevap", "soru-cevap", 14, "ACTIVE"),
];

const featured = thread(
  "t1",
  zones[1],
  people[0],
  "Akşamları sadece tekrar yapıyorum, yeni konuya sabah başlıyorum; bana iyi geliyor.",
  "Bu ritmi birkaç haftadır sürdürüyorum. Benzer bir düzen kuran var mı?",
  11,
  8,
);

test("topluluk hub redesign sözleşmesini masaüstü ve mobilde korur", async ({
  page,
}, testInfo) => {
  await mockCommunityApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk");
  await expect(page.getByRole("heading", { name: "Topluluk", exact: true })).toBeVisible();
  const featuredImage = page.getByRole("img", {
    name: "Birlikte konuşmayı ve paylaşmayı anlatan topluluk görseli",
  });
  await expect(featuredImage).toBeVisible();
  await expect
    .poll(() =>
      featuredImage.evaluate(
        (element) =>
          element instanceof HTMLImageElement &&
          element.complete &&
          element.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await expect(page.getByText(featured.title, { exact: true })).toBeVisible();
  await expect(page.getByText("Emek Panon", { exact: true })).toBeVisible();
  await expect(page.getByText("Etiketler konuşmalar büyüdükçe burada belirecek.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Katıl" })).toHaveCount(2);
  await expect(page.getByText(/\bXP\b/)).toHaveCount(0);

  if (testInfo.project.name.startsWith("desktop")) {
    await expect(page.locator(".community-header__wordmark")).toHaveText("Mentor");
    await expect(
      page
        .locator(".community-workspace__sidebar")
        .getByRole("link", { name: "Matematik & Geometri", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/\d+ mesaj/)).toHaveCount(0);
  }

  await page.screenshot({
    path: testInfo.outputPath("community-hub.png"),
    fullPage: true,
  });
});

async function mockCommunityApi(page: Page) {
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname + url.search;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path.startsWith("/v1/forum/zones?")) {
      return json(route, { items: zones, page: 1, pageSize: 100, total: zones.length });
    }
    if (method === "GET" && path === "/v1/forum/hub") {
      return json(route, {
        featured,
        continueDiscussions: [
          thread("t2", zones[0], people[2], "Çıkmış sorularla çalışmak düşündüğümden daha faydalı.", "", 12, 4),
          thread("t3", zones[1], people[1], "Bu hafta çok verimli geçsin.", "", 3, 2),
          thread("t4", zones[3], people[0], "Konu tekrarı yapmadan soru çözmek işe yarıyor mu?", "", 5, 1),
        ],
        trendingTags: [],
        supporters: people,
        recommendedZones: [zones[0], zones[3]],
      });
    }
    if (method === "GET" && path.startsWith("/v1/notifications?")) {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
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
    if (method === "GET" && path.startsWith("/v1/economy/")) {
      return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }

    return json(route, null, 204);
  });
}

function zone(
  id: string,
  type: "CHAT" | "ANNOUNCEMENT" | "QA",
  title: string,
  slug: string,
  threadCount: number,
  myStatus: "ACTIVE" | null,
) {
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
    memberCount: 42,
    threadCount,
    myStatus,
    myRole: myStatus ? "MEMBER" : null,
    canModerate: false,
    createdAt: "2026-08-01T10:00:00.000Z",
  };
}

function thread(
  id: string,
  targetZone: (typeof zones)[number],
  author: (typeof people)[number],
  title: string,
  body: string,
  commentCount: number,
  helpfulVoteCount: number,
) {
  return {
    id,
    zone: {
      id: targetZone.id,
      title: targetZone.title,
      slug: targetZone.slug,
      type: targetZone.type,
    },
    author,
    title,
    body: body || title,
    status: "OPEN",
    acceptedPostId: null,
    isPinned: false,
    tags: [],
    reactionCounts: {},
    myReactions: [],
    helpfulVoteCount,
    myHelpfulVote: false,
    commentCount,
    attachments: [],
    myBookmarked: false,
    capabilities: {
      canEdit: false,
      canDelete: false,
      canModerate: false,
      editDeadline: null,
    },
    createdAt: "2026-08-01T10:00:00.000Z",
    lastActivityAt: "2026-08-05T10:00:00.000Z",
    editedAt: null,
    score: 12,
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
