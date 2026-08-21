import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  ForumTagView,
  ThreadView,
  ZoneView,
} from "@mentor/types";

/**
 * The half of the mistake-notebook ↔ community bridge that lives on the community side.
 *
 * The notebook hands a twice-missed question over to the feed's question composer, carrying the
 * entry id in the URL; once the thread exists the composer's caller links it back to the card. That
 * link is the only thing that ever sets `communityThreadId`, and therefore the only reason the
 * card's "answered in the community" badge and its "see the solution" link can ever appear. For
 * months the endpoint existed, was tested, and had no caller — so this file exists to make sure it
 * keeps having one.
 *
 * Its own file rather than a case in `notebook.spec.ts`: the notebook mock has no idea what a forum
 * zone is, and teaching it would leave every notebook test carrying a forum fixture it never uses.
 */

const QA_ZONE_ID = "55555555-5555-4555-8555-555555555555";
const ENTRY_ID = "33333333-3333-4333-8333-333333333333";
const THREAD_ID = "66666666-6666-4666-8666-666666666666";

const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "defter@test.local",
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

/** The composer only offers QA zones the viewer has actually joined (`eligibleComposerZones`). */
const qaZone: ZoneView = {
  id: QA_ZONE_ID,
  type: "QA",
  title: "Soru Cevap",
  slug: "soru-cevap",
  description: null,
  visibility: "PUBLIC",
  joinPolicy: "OPEN",
  examType: "KPSS",
  isArchived: false,
  memberCount: 12,
  threadCount: 4,
  myStatus: "ACTIVE",
  myRole: "MEMBER",
  canModerate: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const tag: ForumTagView = {
  id: "77777777-7777-4777-8777-777777777777",
  slug: "matematik",
  name: "Matematik",
  examType: "KPSS",
  isActive: true,
};

const createdThread = {
  id: THREAD_ID,
  zoneId: QA_ZONE_ID,
  authorId: user.id,
  authorName: user.displayName,
  title: "Bu soruda takıldım",
  body: "Kendi denemem şöyleydi ama sonuca ulaşamadım.",
} as unknown as ThreadView;

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

async function mockFeedApi(page: Page, options: { linkFails?: boolean } = {}) {
  const links: Array<{ id: string; threadId: string }> = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // The consent bar docks over the bottom of the page and covers the composer.
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
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
        headers: corsHeaders,
        body: "",
      });
    }

    // App-shell chrome, not the bridge: without it the celebration hook reads `.length` off an
    // empty 204 and takes the whole page down — the same failure mode `notebook.spec.ts` hit with
    // the notification bell.
    if (method === "GET" && path === "/v1/community/achievements/unseen") {
      return json(route, { celebrations: [] });
    }
    if (method === "GET" && path === "/v1/forum/zones") {
      return json(route, { items: [qaZone], total: 1, page: 1, pageSize: 100 });
    }
    if (method === "GET" && path === "/v1/forum/tags") return json(route, [tag]);
    if (method === "GET" && path === "/v1/forum/trends") {
      return json(route, {
        items: [],
        scope: "GLOBAL",
        examType: null,
        windowHours: 24,
      });
    }
    if (method === "GET" && path === "/v1/forum/feed") {
      return json(route, {
        items: [],
        nextCursor: null,
        context: { activeThreads: [], suggestedThreads: [] },
      });
    }
    if (method === "POST" && /\/v1\/forum\/zones\/[^/]+\/threads$/.test(path)) {
      return json(route, createdThread);
    }

    if (
      method === "POST" &&
      /\/v1\/coaching\/notebook\/entries\/[^/]+\/community-thread$/.test(path)
    ) {
      if (options.linkFails) return json(route, { message: "nope" }, 404);
      const id = path.split("/").at(-2)!;
      const body = request.postDataJSON() as { threadId: string };
      links.push({ id, threadId: body.threadId });
      return json(route, { id, communityThreadId: body.threadId });
    }

    return json(route, null, 204);
  });

  return { links, pageErrors };
}

/** Fills the question composer with the minimum the schema accepts and submits it. */
async function askQuestion(page: Page) {
  await page.getByRole("button", { name: "Hedef kitle seç" }).click();
  await page.getByRole("option", { name: /Soru Cevap/ }).click();
  await page.getByRole("textbox", { name: "Soru başlığı" }).fill("Bu soruda takıldım");
  // The body is a contenteditable rich-text surface, not an input — typing is the only way in.
  const body = page.getByRole("textbox", { name: "Soru açıklaması" });
  await body.click();
  await body.pressSequentially("Kendi denemem şöyleydi ama sonuca ulaşamadım.");
  await page.getByRole("button", { name: "Soruyu yayınla" }).click();
}

test("defterden gelen soru, paylaşıldığında karta geri bağlanır", async ({
  page,
}) => {
  const api = await mockFeedApi(page);

  await page.goto(`/topluluk/akis?notebookEntry=${ENTRY_ID}`);

  // They already pressed "ask in the community" on the card; the composer opens in question mode
  // rather than making them choose it again.
  await expect(page.getByRole("dialog", { name: "Soru paylaş" })).toBeVisible();

  await askQuestion(page);

  await expect.poll(() => api.links.length).toBe(1);
  expect(api.links[0]).toEqual({ id: ENTRY_ID, threadId: THREAD_ID });

  // The param is spent. Left in place, a refresh would reopen the composer and offer to link a
  // question the student already asked.
  await expect.poll(() => new URL(page.url()).search).toBe("");
  expect(api.pageErrors).toEqual([]);
});

test("bağlama başarısız olsa da soru paylaşılmış kalır", async ({ page }) => {
  const api = await mockFeedApi(page, { linkFails: true });

  await page.goto(`/topluluk/akis?notebookEntry=${ENTRY_ID}`);
  await askQuestion(page);

  // The thread is already public; a failed link is worth saying out loud, never worth pretending
  // the whole thing failed or offering to post it again.
  await expect(page.getByText(/karta bağlanamadı/)).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Soru paylaş" })).toHaveCount(0);
  expect(api.links).toEqual([]);
});

test("parametresiz akışta soru composer'ı kendiliğinden açılmaz", async ({
  page,
}) => {
  await mockFeedApi(page);

  await page.goto("/topluluk/akis");

  await expect(page.getByRole("dialog", { name: "Soru paylaş" })).toHaveCount(0);
});
