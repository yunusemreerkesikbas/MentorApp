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

test("Keşfet: tek ledge, cevap bekleyenler, kaldığın yerden, odalar ve yanında olanlar", async ({
  page,
}, testInfo) => {
  await mockCommunityApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk");
  const hero = page.getByRole("region", { name: "Bugün aklında ne var?" });
  await expect(hero).toBeVisible();
  // One filled ledge on the screen (DESIGN.md §1 rule 1); asking a question is the text link.
  await expect(hero.getByRole("link", { name: "Bir şey paylaş" })).toBeVisible();
  await expect(hero.getByRole("link", { name: "Soru sor" })).toBeVisible();
  await expect(hero.getByText("Şu an 38 kişi seninle çalışıyor")).toBeVisible();
  // Puhu speaks in the hero's bubble (DESIGN.md §1 rule 4): the artwork must actually load.
  await expect
    .poll(() =>
      hero.locator("img").first().evaluate((img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0),
    )
    .toBe(true);

  const waiting = page.getByRole("region", { name: "Cevap bekleyen sorular" });
  await expect(waiting.getByText(waitingQuestion.title, { exact: true })).toBeVisible();

  const continued = page.getByRole("region", { name: "Kaldığın yerden devam!" });
  await expect(continued.getByText("Öne çıkan", { exact: true })).toBeVisible();
  await expect(continued.getByText(featured.title, { exact: true })).toBeVisible();

  const rooms = page.getByRole("region", { name: "Sana uygun odalar" });
  await expect(rooms.getByRole("button", { name: /^Katıl: / })).toHaveCount(2);

  await expect(page.getByRole("region", { name: "Yol arkadaşın" })).toBeVisible();
  await expect(page.getByText("Merve Doğan, Elif Demir ve 1 kişi daha bu hafta el uzattı!")).toBeVisible();
  // Nothing trending → no "Popüler etiketler" card at all, and no stock artwork or XP anywhere.
  await expect(page.getByRole("region", { name: "Popüler etiketler" })).toHaveCount(0);
  await expect(page.locator('img[src*="/img/feed.png"]')).toHaveCount(0);
  await expect(page.getByText(/\bXP\b/)).toHaveCount(0);

  if (testInfo.project.name.startsWith("desktop")) {
    const sidebar = page.locator(".community-workspace__sidebar");
    await expect(page.getByRole("heading", { level: 1, name: "Bugün toplulukta" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Keşfet" })).toHaveAttribute("aria-current", "page");
    await expect(sidebar.getByText("Odaların", { exact: true })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Matematik & Geometri", exact: true })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Profilim/ })).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "Kanallar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Toplulukta ara" })).toBeVisible();
  }

  await page.screenshot({
    path: testInfo.outputPath("community-hub.png"),
    fullPage: true,
  });

  await page.context().addCookies([{ name: "mentor-theme", value: "dark", url: page.url() }]);
  await page.reload();
  await expect(hero).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("community-hub-dark.png"),
    fullPage: true,
  });
});

test("Keşfet sessiz toplulukta söyleyecek sözü olmayan bölümleri göstermez", async ({ page }) => {
  await mockCommunityApi(page, { quiet: true });
  await page.goto("/topluluk");

  await expect(page.getByText("Burası yeni uyanıyor!", { exact: false })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sana uygun odalar" })).toBeVisible();
  for (const name of ["Cevap bekleyen sorular", "Kaldığın yerden devam!", "Yol arkadaşın", "Bu haftanın yardımseverleri 🙌"]) {
    await expect(page.getByRole("region", { name })).toHaveCount(0);
  }
  await expect(page.getByText(/seninle çalışıyor/)).toHaveCount(0);
});

const waitingQuestion = thread(
  "t9",
  zones[3],
  people[2],
  "Bölünebilme kurallarında 11'e bölünebilme nasıl uygulanır?",
  "Basamakları toplarken artı eksi mantığı nasıl işliyor?",
  0,
  0,
);

const buddy = {
  active: {
    pairId: "pair-1",
    partner: { userId: "p2", displayName: "Elif Demir", username: "elif_demir", avatarUrl: null },
    focusMinutesToday: 45,
    currentStreak: 12,
    partnerStudyingNow: true,
    canNudge: true,
    nudgeCooldownEndsAt: null,
  },
  outgoing: null,
  incoming: [],
};

async function mockCommunityApi(page: Page, { quiet = false }: { quiet?: boolean } = {}) {
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
    if (method === "GET" && url.pathname === "/v1/forum/feed" && url.searchParams.get("unanswered") === "true") {
      const items = quiet ? [] : [waitingQuestion];
      return json(route, { items, nextCursor: null, effectiveSort: "recent", context: { activeThreads: [], suggestedThreads: [] } });
    }
    if (method === "GET" && path === "/v1/coaching/today") {
      return json(route, { focusingNow: quiet ? null : 38 });
    }
    if (method === "GET" && path === "/v1/buddy") {
      return json(route, quiet ? { active: null, outgoing: null, incoming: [] } : buddy);
    }
    if (method === "GET" && path === "/v1/forum/hub") {
      if (quiet) {
        return json(route, {
          featured: null,
          continueDiscussions: [],
          trendingTags: [],
          supporters: [],
          recommendedZones: [zones[0], zones[3]],
        });
      }
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
        headers: corsHeaders(route),
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
