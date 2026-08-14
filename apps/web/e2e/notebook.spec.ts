import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  ExamCalendarDto,
  ExamSubjectDto,
  ExamTopicDto,
  NotebookEntryDto,
  NotebookOverviewDto,
  NotebookPageDto,
} from "@mentor/types";

/**
 * Mistake notebook, end to end.
 *
 * Everything else covering this feature is pure logic — the review ladder, the page reducer, the
 * slot placement, the error-type threshold. None of it can answer "does the cover actually open",
 * "does adding a card persist", "does a healed card go quiet". That is what this file is for.
 *
 * The book opens onto a two-page spread (left index, right index+1), each page independently
 * interactive with its own gesture session and autosave — the sidebar's arranging tools act on
 * whichever side the student last touched ("focused side", defaulting to left).
 */

const exam = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "kpss-lisans-2026",
  name: "KPSS Lisans 2026",
  family: "KPSS",
  variant: "LISANS",
  isCurrent: true,
} as const;

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

const subjects: ExamSubjectDto[] = [
  { slug: "matematik", name: "Matematik", questionCount: 30, sortOrder: 1 },
  { slug: "tarih", name: "Tarih", questionCount: 27, sortOrder: 2 },
];

const topics: ExamTopicDto[] = [
  {
    subjectSlug: "matematik",
    subjectName: "Matematik",
    slug: "problemler",
    name: "Problemler",
    sortOrder: 0,
  },
  {
    subjectSlug: "tarih",
    subjectName: "Tarih",
    slug: "kurtulus-savasi",
    name: "Kurtuluş Savaşı",
    sortOrder: 0,
  },
];

const calendar: ExamCalendarDto = {
  exam,
  events: [],
  daysToExam: 120,
} as unknown as ExamCalendarDto;

function makeEntry(overrides: Partial<NotebookEntryDto> = {}): NotebookEntryDto {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    mockExamId: null,
    storageKey: null,
    url: null,
    subjectRef: "matematik",
    subjectName: "Matematik",
    topicRef: "problemler",
    topicName: "Problemler",
    errorType: "CARELESS",
    note: null,
    status: "ACTIVE",
    reviewCount: 1,
    lastReviewedAt: null,
    nextReviewAt: "2026-08-14T06:00:00.000Z",
    source: "OWN",
    communityThreadId: null,
    communityAnsweredAt: null,
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: "2026-08-10T09:00:00.000Z",
    ...overrides,
  };
}

function emptyPage(index: number): NotebookPageDto {
  return { pageIndex: index, doc: { version: 1, paper: "ruled", items: [] }, entries: [] };
}

interface NotebookApiOptions {
  overview?: Partial<NotebookOverviewDto>;
  /** Entries the strip reports as due; also what the review panel walks through. */
  due?: NotebookEntryDto[];
  /** Seed specific page indices; anything unlisted comes back as a fresh empty page. */
  pages?: Record<number, NotebookPageDto>;
}

async function mockNotebookApi(page: Page, options: NotebookApiOptions = {}) {
  const savedPages: Array<{ index: number; doc: unknown }> = [];
  const createdEntries: Record<string, unknown>[] = [];
  const reviews: Array<{ id: string; solved: boolean }> = [];

  const overview: NotebookOverviewDto = {
    pageCount: 1,
    entryCount: 0,
    dueCount: 0,
    healedCount: 0,
    ...options.overview,
  };
  const seededPages = options.pages ?? {};
  const allSeededEntries = Object.values(seededPages).flatMap((p) => p.entries);

  /*
   * Collected, not just logged. The first run of this file died on a blank page with no clue why;
   * the reason was an uncaught `reading 'items'` from the notification bell, and the only thing
   * that surfaced it was listening here. Asserting on it keeps the next silent crash loud.
   */
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // The consent bar docks over the bottom of the page and covers the sidebar's buttons.
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
    // App-shell chrome. Without these the notification bell reads `.items` off an empty 204 and
    // takes the whole page down with it — which is exactly what this file caught first time out.
    if (method === "GET" && path === "/v1/notifications") {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
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
    if (method === "GET" && path === "/v1/content/exams/by-type/KPSS/calendar") {
      return json(route, calendar);
    }
    if (method === "GET" && path === `/v1/content/exams/${exam.slug}/subjects`) {
      return json(route, subjects);
    }
    if (method === "GET" && path === `/v1/content/exams/${exam.slug}/topics`) {
      return json(route, topics);
    }

    if (method === "GET" && path === "/v1/coaching/notebook") {
      return json(route, overview);
    }
    if (method === "GET" && path === "/v1/coaching/notebook/reviews/due") {
      return json(route, options.due ?? []);
    }
    const pageMatch = path.match(/\/v1\/coaching\/notebook\/pages\/(\d+)$/);
    if (method === "GET" && pageMatch) {
      const index = Number(pageMatch[1]);
      return json(route, seededPages[index] ?? emptyPage(index));
    }
    if (method === "PUT" && pageMatch) {
      const index = Number(pageMatch[1]);
      const body = request.postDataJSON() as { doc: unknown };
      savedPages.push({ index, doc: body.doc });
      return json(route, { pageIndex: index, doc: body.doc, entries: [] });
    }
    if (method === "POST" && path === "/v1/coaching/notebook/entries") {
      const body = request.postDataJSON() as Record<string, unknown>;
      createdEntries.push(body);
      return json(
        route,
        makeEntry({
          id: "44444444-4444-4444-8444-444444444444",
          errorType: body.errorType as NotebookEntryDto["errorType"],
          subjectRef: (body.subjectRef as string) ?? null,
          topicRef: (body.topicRef as string) ?? null,
          reviewCount: 0,
        }),
      );
    }
    if (method === "POST" && /\/entries\/[^/]+\/review$/.test(path)) {
      const id = path.split("/").at(-2)!;
      const body = request.postDataJSON() as { solved: boolean };
      reviews.push({ id, solved: body.solved });
      const source = [...(options.due ?? []), ...allSeededEntries].find(
        (entry) => entry.id === id,
      );
      return json(
        route,
        makeEntry({
          ...source,
          id,
          // One rung short of healed in the fixtures, so a success here heals the card.
          status: body.solved ? "HEALED" : "ACTIVE",
          nextReviewAt: body.solved ? null : "2026-08-16T06:00:00.000Z",
          reviewCount: body.solved ? 3 : 0,
        }),
      );
    }

    return json(route, null, 204);
  });

  return { savedPages, createdEntries, reviews, pageErrors };
}

test("kapak açılır, sağ ve sol sayfalar birlikte gösterilir, kapaktan geriye gidilemez", async ({
  page,
}) => {
  const api = await mockNotebookApi(page);
  await page.goto("/yanlis-defteri");

  // The book opens closed — that is the whole point of the cover.
  await expect(page.getByText("Yanlış Defterim")).toBeVisible();
  await expect(page.getByText("Kapak")).toBeVisible();

  await page.getByRole("button", { name: "Defteri aç" }).click();
  // A spread, not a single leaf: opening the book shows pages 1 AND 2 at once.
  await expect(page.getByText("Sayfa 1-2")).toBeVisible();

  await page.getByRole("button", { name: "Sonraki" }).click();
  await expect(page.getByText("Sayfa 3-4")).toBeVisible();

  // Back past the first spread closes the book rather than doing nothing.
  await page.getByRole("button", { name: "Önceki" }).click();
  await page.getByRole("button", { name: "Önceki" }).click();
  await expect(page.getByText("Kapak")).toBeVisible();

  // Nothing threw on the way through — a crashed page renders an error boundary, not a cover.
  expect(api.pageErrors).toEqual([]);
});

test("yan panel her zaman açık: yanlış eklenir, hata tipi zorunlu, ders/konu seçilir, sol sayfaya yerleşir", async ({
  page,
}) => {
  const api = await mockNotebookApi(page);
  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();

  // No "arrange the page" toggle to click first — the rail is already there, collapsed.
  await expect(page.getByRole("button", { name: "Sayfayı düzenle" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ekle" }).click();

  // The one required field: with no error type the form cannot be submitted.
  const submit = page.getByRole("button", { name: "Deftere ekle" });
  await expect(submit).toBeDisabled();

  await page.getByRole("button", { name: "Biliyordum, dikkat hatası" }).click();
  await expect(submit).toBeEnabled();

  await page.getByLabel("Ders").selectOption("matematik");
  // The topic picker only appears once a subject narrows it, and it is free — no premium gate.
  await page.getByLabel("Konu").selectOption("problemler");

  await submit.click();

  await expect.poll(() => api.createdEntries.length).toBe(1);
  expect(api.createdEntries[0]).toMatchObject({
    errorType: "CARELESS",
    subjectRef: "matematik",
    topicRef: "problemler",
    source: "OWN",
  });

  // Placement is autosaved on the focused side — left (index 0) by default — with nothing asking
  // the user to press save.
  await expect.poll(() => api.savedPages.length, { timeout: 5_000 }).toBeGreaterThan(0);
  const saved = api.savedPages.find((entry) => entry.index === 0);
  expect(saved).toBeDefined();
  const doc = saved!.doc as { items: Array<{ kind: string }> };
  expect(doc.items.filter((item) => item.kind === "entry")).toHaveLength(1);
});

test("konu seçici derse göre daralır", async ({ page }) => {
  await mockNotebookApi(page);
  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();
  await page.getByRole("button", { name: "Ekle" }).click();

  await page.getByLabel("Ders").selectOption("tarih");
  const topic = page.getByLabel("Konu");
  await expect(topic.getByRole("option", { name: "Kurtuluş Savaşı" })).toHaveCount(1);
  await expect(topic.getByRole("option", { name: "Problemler" })).toHaveCount(0);
});

test("tekrar şeridi açılır, çözülen kart iyileşir ve şerit boşalır", async ({ page }) => {
  // The strip and the review panel work off the due list directly and never need the book to be
  // open, so no page needs seeding here — only the due-strip test below does that.
  const due = [makeEntry({ reviewCount: 2 })];
  const api = await mockNotebookApi(page, {
    due,
    overview: { dueCount: 1, entryCount: 1 },
  });

  await page.goto("/yanlis-defteri");

  const strip = page.getByRole("button", { name: /1 soru tekrar zamanı/ });
  await expect(strip).toBeVisible();
  await strip.click();

  await expect(page.getByText("Bu sefer çözebildin mi?")).toBeVisible();
  await page.getByRole("button", { name: "Çözebildim" }).click();

  await expect.poll(() => api.reviews.length).toBe(1);
  expect(api.reviews[0]).toEqual({ id: due[0]!.id, solved: true });

  // The card heals, the queue empties, and the strip goes away — nothing left to nag about.
  await expect(page.getByText("Bugünlük bu kadar")).toBeVisible();
  await expect(strip).toHaveCount(0);
});

test("ikinci kez kaçırılan soruda topluluk teklif edilir, telif uyarısıyla", async ({
  page,
}) => {
  // reviewCount > 0 means the student had already got this one right once.
  const due = [makeEntry({ reviewCount: 2 })];
  await mockNotebookApi(page, { due, overview: { dueCount: 1, entryCount: 1 } });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: /1 soru tekrar zamanı/ }).click();
  await page.getByRole("button", { name: "Yine çözemedim" }).click();

  await expect(page.getByText("Bu soru seni ikinci kez yakaladı")).toBeVisible();
  await expect(page.getByText(/telifli olabilir/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Toplulukta sor" })).toBeVisible();
});

test("çift tıkla kart açılır ve sol sayfadaki bir kart sağ sayfayı etkilemez", async ({
  page,
}) => {
  const entry = makeEntry({ reviewCount: 2 });
  const seededLeft: NotebookPageDto = {
    pageIndex: 0,
    doc: {
      version: 1,
      paper: "ruled",
      items: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          kind: "entry",
          entryId: entry.id,
          x: 170,
          y: 90,
          width: 800,
          height: 300,
          rotation: 0,
          opacity: 1,
          z: 1,
        },
      ],
    },
    entries: [entry],
  };
  await mockNotebookApi(page, { pages: { 0: seededLeft } });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();

  // Not due, not in the strip flow — the only way to this card is arranging + opening it directly.
  await page.getByText("Problemler").dblclick();
  await expect(page.getByText("Bu sefer çözebildin mi?")).toBeVisible();
  // A single card has nothing to count through.
  await expect(page.getByText("1 / 1")).toHaveCount(0);
});

test("sidebar sticker ekler, sayfaya yapıştırır ve otomatik kaydeder", async ({ page }) => {
  const api = await mockNotebookApi(page);
  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();
  await page.getByRole("button", { name: "Sticker" }).click();

  // The full vision-board sticker set, not a shortlist — each one keeps its own translated name.
  await page.getByRole("button", { name: "Yıldız" }).click();

  await expect.poll(() => api.savedPages.length, { timeout: 5_000 }).toBeGreaterThan(0);
  const firstSave = api.savedPages.find((entry) => entry.index === 0);
  expect(firstSave).toBeDefined();
  const doc = firstSave!.doc as { items: Array<{ kind: string }> };
  expect(doc.items.filter((item) => item.kind === "sticker")).toHaveLength(1);

  // Undo is a real affordance, not decoration.
  await page.getByRole("button", { name: "Geri al" }).click();
  await expect
    .poll(
      () => {
        const latest = api.savedPages.filter((entry) => entry.index === 0).at(-1) as {
          doc: { items: unknown[] };
        };
        return latest.doc.items.length;
      },
      { timeout: 5_000 },
    )
    .toBe(0);
});

test("not: tıklayınca sayfa üzerinde düzenlenebilir alan açılır; boş bırakılırsa eklenmez", async ({
  page,
}) => {
  const api = await mockNotebookApi(page);
  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();

  // No sidebar form: the note lands directly on the page, already in edit mode.
  await page.getByRole("button", { name: "Not" }).click();
  const editor = page.getByLabel("Not metni");
  await expect(editor).toBeFocused();
  await editor.fill("Bir daha köklü ifade unutma");
  await editor.blur();

  await expect.poll(() => api.savedPages.length, { timeout: 5_000 }).toBeGreaterThan(0);
  const saved = api.savedPages.find((entry) => entry.index === 0);
  const doc = saved!.doc as { items: Array<{ kind: string; text?: string }> };
  const notes = doc.items.filter((item) => item.kind === "text");
  expect(notes).toHaveLength(1);
  expect(notes[0]!.text).toBe("Bir daha köklü ifade unutma");

  // A second note, left empty, must never be persisted — the schema requires non-empty text.
  await page.getByRole("button", { name: "Not" }).click();
  await page.getByLabel("Not metni").blur();
  await expect
    .poll(() => {
      const latest = api.savedPages.filter((entry) => entry.index === 0).at(-1)!.doc as {
        items: Array<{ kind: string }>;
      };
      return latest.items.filter((item) => item.kind === "text").length;
    })
    .toBe(1);
});

test("fotoğraflı kart sadece görseli gösterir; tıklayınca tam ekran önizleme açılır", async ({
  page,
}) => {
  const entry = makeEntry({ url: "https://cdn.test/soru.jpg" });
  const seededLeft: NotebookPageDto = {
    pageIndex: 0,
    doc: {
      version: 1,
      paper: "ruled",
      items: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          kind: "entry",
          entryId: entry.id,
          x: 170,
          y: 90,
          width: 800,
          height: 300,
          rotation: 0,
          opacity: 1,
          z: 1,
        },
      ],
    },
    entries: [entry],
  };
  await mockNotebookApi(page, { pages: { 0: seededLeft } });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();

  // The clickable surface is the photo itself, named for what it opens — not a chip or a topic
  // label sitting inline (those move into the hover card, which is a CSS-opacity concern better
  // confirmed by eye than by a text-presence assertion here).
  await page.getByRole("button", { name: /Fotoğrafı büyüt/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

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
