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

function makeEntry(
  overrides: Partial<NotebookEntryDto> = {},
): NotebookEntryDto {
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
    solutionStorageKey: null,
    solutionUrl: null,
    solutionNote: null,
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

/**
 * Choose a value from a `MenuSelect` field.
 *
 * The add form's subject and topic pickers used to be native `<select>`s driven by
 * `selectOption`. They are now `MenuSelect` — a button that opens a `PopoverMenu` listbox — so
 * picking is two clicks, and the option is matched by its visible label rather than its value.
 */
async function pickOption(page: Page, field: string, option: string) {
  await page.getByLabel(field).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** Mobile collapses the page-tool rail to a pen circle; expand it before tapping Ekle/Çiz/…. */
async function ensureNotebookToolsOpen(page: Page) {
  const show = page.getByRole("button", { name: "Araçları göster" });
  if (await show.isVisible()) await show.click();
}

function emptyPage(index: number): NotebookPageDto {
  return {
    pageIndex: index,
    // `ink` is always present on the wire: the service fills it in on read, so a page saved before
    // drawing existed still arrives with an empty array rather than a missing key.
    doc: { version: 1, paper: "ruled", items: [], ink: [] },
    entries: [],
  };
}

interface NotebookApiOptions {
  overview?: Partial<NotebookOverviewDto>;
  /** Entries the strip reports as due; also what the review panel walks through. */
  due?: NotebookEntryDto[];
  /** Seed specific page indices; anything unlisted comes back as a fresh empty page. */
  pages?: Record<number, NotebookPageDto>;
  /** What the index panel lists. Defaults to the due list plus whatever the pages hold. */
  indexEntries?: NotebookEntryDto[];
}

async function mockNotebookApi(page: Page, options: NotebookApiOptions = {}) {
  const savedPages: Array<{ index: number; doc: unknown }> = [];
  const createdEntries: Record<string, unknown>[] = [];
  const reviews: Array<{ id: string; solved: boolean }> = [];
  const patches: Array<{ id: string; body: Record<string, unknown> }> = [];
  const deletes: string[] = [];
  const indexQueries: Array<Record<string, string | null>> = [];

  const defaultNotebook: NotebookOverviewDto["notebook"] = {
    id: "99999999-9999-4999-8999-999999999999",
    kind: "MISTAKE",
    examId: null,
    subjectRef: null,
    subjectName: null,
    title: null,
    cover: { color: "navy", material: "cloth" },
    pageCount: 1,
    dueCount: 0,
    updatedAt: "2026-08-25T10:00:00.000Z",
  };
  const overview: NotebookOverviewDto = {
    pageCount: 1,
    entryCount: 0,
    dueCount: 0,
    healedCount: 0,
    ...options.overview,
    notebook: options.overview?.notebook ?? defaultNotebook,
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
    if (
      method === "GET" &&
      path === "/v1/content/exams/by-type/KPSS/calendar"
    ) {
      return json(route, calendar);
    }
    if (
      method === "GET" &&
      path === `/v1/content/exams/${exam.slug}/subjects`
    ) {
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
    // The index: every entry, whether or not it is on a page or due today.
    if (method === "GET" && path === "/v1/coaching/notebook/entries") {
      const url = new URL(request.url());
      const pool = options.indexEntries ?? [
        ...(options.due ?? []),
        ...allSeededEntries,
      ];
      const subject = url.searchParams.get("subjectRef");
      const errorType = url.searchParams.get("errorType");
      const status = url.searchParams.get("status");
      const items = pool
        .filter((entry) => !subject || entry.subjectRef === subject)
        .filter((entry) => !errorType || entry.errorType === errorType)
        .filter((entry) => !status || entry.status === status);
      indexQueries.push({
        subjectRef: subject,
        errorType,
        status,
      });
      return json(route, {
        items,
        total: items.length,
        page: Number(url.searchParams.get("page") ?? 1),
        pageSize: Number(url.searchParams.get("pageSize") ?? 20),
      });
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
    const entryMatch = path.match(
      /\/v1\/coaching\/notebook\/entries\/([^/]+)$/,
    );
    if (method === "DELETE" && entryMatch) {
      deletes.push(entryMatch[1]!);
      return json(route, null, 204);
    }
    if (method === "PATCH" && entryMatch) {
      const id = entryMatch[1]!;
      const body = request.postDataJSON() as Record<string, unknown>;
      patches.push({ id, body });
      const source = [...(options.due ?? []), ...allSeededEntries].find(
        (entry) => entry.id === id,
      );
      return json(route, makeEntry({ ...source, id, ...body }));
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

  return {
    savedPages,
    createdEntries,
    reviews,
    patches,
    deletes,
    indexQueries,
    pageErrors,
  };
}

test("kapak açılır, sağ ve sol sayfalar birlikte gösterilir, kapaktan geriye gidilemez", async ({
  page,
}, testInfo) => {
  /*
   * Below `sm` the notebook shows one leaf at a time instead of a spread, so the same book reads
   * as "Sayfa 1" rather than "Sayfa 1-2" and "Sonraki" walks a leaf at a time before turning.
   * Asserting the desktop labels on both projects is what made this fail only on mobile.
   */
  const singleLeaf = testInfo.project.name === "mobile-chromium";

  const api = await mockNotebookApi(page);
  await page.goto("/yanlis-defteri");

  // The book opens closed — that is the whole point of the cover.
  await expect(page.getByText("Yanlış Defterim")).toBeVisible();
  await expect(page.getByText("Kapak")).toBeVisible();

  await page.getByRole("button", { name: "Defteri aç" }).click();
  // A spread, not a single leaf: opening the book shows pages 1 AND 2 at once — except on a
  // phone, where there is no room for two.
  await expect(
    page.getByText(singleLeaf ? "Sayfa 1" : "Sayfa 1-2", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Sonraki" }).click();
  await expect(
    page.getByText(singleLeaf ? "Sayfa 2" : "Sayfa 3-4", { exact: true }),
  ).toBeVisible();

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
  await expect(
    page.getByRole("button", { name: "Sayfayı düzenle" }),
  ).toHaveCount(0);
  await ensureNotebookToolsOpen(page);
  await page.getByRole("button", { name: "Ekle" }).click();

  // The one required field: with no error type the form cannot be submitted.
  const submit = page.getByRole("button", { name: "Deftere ekle" });
  await expect(submit).toBeDisabled();

  await page.getByRole("button", { name: "Biliyordum, dikkat hatası" }).click();
  await expect(submit).toBeEnabled();

  await pickOption(page, "Ders", "Matematik");
  // The topic picker only appears once a subject narrows it, and it is free — no premium gate.
  await pickOption(page, "Konu", "Problemler");

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
  await expect
    .poll(() => api.savedPages.length, { timeout: 5_000 })
    .toBeGreaterThan(0);
  const saved = api.savedPages.find((entry) => entry.index === 0);
  expect(saved).toBeDefined();
  const doc = saved!.doc as { items: Array<{ kind: string }> };
  expect(doc.items.filter((item) => item.kind === "entry")).toHaveLength(1);
});

test("konu seçici derse göre daralır", async ({ page }) => {
  await mockNotebookApi(page);
  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();
  await ensureNotebookToolsOpen(page);
  await page.getByRole("button", { name: "Ekle" }).click();

  await pickOption(page, "Ders", "Tarih");

  // `MenuSelect` renders its options in a popover next to the trigger, not inside it, so the
  // options are only in the DOM while the menu is open and are queried from the page.
  await page.getByLabel("Konu").click();
  await expect(
    page.getByRole("option", { name: "Kurtuluş Savaşı" }),
  ).toHaveCount(1);
  await expect(page.getByRole("option", { name: "Problemler" })).toHaveCount(0);
});

test("tekrar şeridi açılır, çözülen kart iyileşir ve şerit boşalır", async ({
  page,
}) => {
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
  await mockNotebookApi(page, {
    due,
    overview: { dueCount: 1, entryCount: 1 },
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: /1 soru tekrar zamanı/ }).click();
  await page.getByRole("button", { name: "Yine çözemedim" }).click();

  await expect(
    page.getByText("Bu soru seni ikinci kez yakaladı"),
  ).toBeVisible();
  await expect(page.getByText(/telifli olabilir/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Toplulukta sor" }),
  ).toBeVisible();
});

test("tekrar kartı çevrilir: soru önde, hata tipi ve not arkada", async ({
  page,
}) => {
  const due = [makeEntry({ reviewCount: 2, note: "İşlem hatası yaptım" })];
  await mockNotebookApi(page, {
    due,
    overview: { dueCount: 1, entryCount: 1 },
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: /1 soru tekrar zamanı/ }).click();

  // Front: the question, nothing that gives it away.
  const question = page.getByText("Bu sefer çözebildin mi?");
  await expect(question).toBeVisible();
  await expect(page.getByRole("button", { name: "Çevir" })).toBeVisible();

  // Both faces are mounted so the turn has something to show, so "is the back visible" is not a
  // question Playwright can answer honestly here — the control's own state is. Tapping the card is
  // the headline gesture; the button beside it is the keyboard path to the same toggle.
  await question.click();

  const back = page.getByRole("button", { name: "Soruya dön" });
  await expect(back).toBeVisible();
  await expect(back).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("İşlem hatası yaptım")).toHaveCount(1);
  await expect(page.getByText("2 kez tekrar ettin")).toHaveCount(1);

  // Answering still works from the flipped side — flipping is never a step you have to undo.
  await page.getByRole("button", { name: "Çözebildim" }).click();
  await expect(page.getByText("Bugünlük bu kadar")).toBeVisible();
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
      ink: [],
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

test("sidebar sticker ekler, sayfaya yapıştırır ve otomatik kaydeder", async ({
  page,
}) => {
  const api = await mockNotebookApi(page);
  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();
  await ensureNotebookToolsOpen(page);
  await page.getByRole("button", { name: "Sticker" }).click();

  // The full vision-board sticker set, not a shortlist — each one keeps its own translated name.
  // `exact` because that set holds "Yıldız", "Yıldız (1)" and "Yıldız (2)", and role-name matching
  // is a substring match by default.
  await page.getByRole("button", { name: "Yıldız", exact: true }).click();

  await expect
    .poll(() => api.savedPages.length, { timeout: 5_000 })
    .toBeGreaterThan(0);
  const firstSave = api.savedPages.find((entry) => entry.index === 0);
  expect(firstSave).toBeDefined();
  const doc = firstSave!.doc as { items: Array<{ kind: string }> };
  expect(doc.items.filter((item) => item.kind === "sticker")).toHaveLength(1);

  // Undo is a real affordance, not decoration.
  await page.getByRole("button", { name: "Geri al" }).click();
  await expect
    .poll(
      () => {
        const latest = api.savedPages
          .filter((entry) => entry.index === 0)
          .at(-1) as {
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
  await ensureNotebookToolsOpen(page);
  await page.getByRole("button", { name: "Not" }).click();
  const editor = page.getByLabel("Not metni");
  await expect(editor).toBeFocused();
  await editor.fill("Bir daha köklü ifade unutma");
  await editor.blur();

  await expect
    .poll(() => api.savedPages.length, { timeout: 5_000 })
    .toBeGreaterThan(0);
  const saved = api.savedPages.find((entry) => entry.index === 0);
  const doc = saved!.doc as { items: Array<{ kind: string; text?: string }> };
  const notes = doc.items.filter((item) => item.kind === "text");
  expect(notes).toHaveLength(1);
  expect(notes[0]!.text).toBe("Bir daha köklü ifade unutma");

  // A second note, left empty, must never be persisted — the schema requires non-empty text.
  await ensureNotebookToolsOpen(page);
  await page.getByRole("button", { name: "Not" }).click();
  await page.getByLabel("Not metni").blur();
  await expect
    .poll(() => {
      const latest = api.savedPages.filter((entry) => entry.index === 0).at(-1)!
        .doc as {
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
      ink: [],
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

/**
 * Drawing, end to end.
 *
 * The stroke geometry, the simplification and the eraser hit-test all have unit tests
 * (`src/lib/notebook-ink.spec.ts`), and the undo/redo/erase actions have reducer tests. None of
 * them can answer the questions this covers: does a real drag on a real page produce ink, does the
 * ink reach the server, and does the eraser find what the pen left.
 */
async function drawOn(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
) {
  // A curve, not a straight line: simplification collapses collinear samples, so a straight drag
  // would still pass with a broken smoothing step.
  const startX = box.x + box.width * 0.3;
  const y = box.y + box.height * 0.45;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(startX + step * 12, y + (step % 2 === 0 ? 14 : -14));
  }
  await page.mouse.up();
}

test("çizim modunda sayfaya kalemle çizilir, geri/ileri alınır ve kaydedilir", async ({
  page,
}) => {
  const api = await mockNotebookApi(page);
  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();

  // `exact` matters here: role-name matching is a substring match by default, and "Çiz" is a
  // prefix of the tray's own "Çizimleri sil".
  await ensureNotebookToolsOpen(page);
  await page.getByRole("button", { name: "Çiz", exact: true }).click();
  const toolbar = page.getByRole("toolbar", { name: "Çizim araçları" });
  await expect(toolbar).toBeVisible();

  // Nothing drawn yet, so there is nothing to undo or clear.
  await expect(toolbar.getByRole("button", { name: "Geri al" })).toBeDisabled();
  await expect(
    toolbar.getByRole("button", { name: "Çizimleri sil" }),
  ).toBeDisabled();

  await toolbar.getByRole("button", { name: "Fosforlu kalem" }).click();
  await toolbar.getByRole("button", { name: "Renkler" }).click();
  await toolbar.getByRole("button", { name: "#ffd600" }).click();
  // The colour strip is a mode you leave deliberately, so picking a swatch does not close it —
  // the pens and the undo/redo controls are on the strip behind this one.
  await toolbar.getByRole("button", { name: "Geri", exact: true }).click();

  const surface = page.locator("svg[viewBox='0 0 1080 1527']").first();
  const box = (await surface.boundingBox())!;
  await drawOn(page, box);

  // The ink is real DOM: one filled path per stroke, in the page's own design space.
  await expect(surface.locator("path")).toHaveCount(1);
  await expect(toolbar.getByRole("button", { name: "Geri al" })).toBeEnabled();

  // It autosaves onto the left page, carrying the pen it was drawn with.
  await expect
    .poll(() => api.savedPages.length, { timeout: 5_000 })
    .toBeGreaterThan(0);
  const saved = api.savedPages.filter((entry) => entry.index === 0).at(-1);
  const doc = saved!.doc as {
    ink: Array<{ tool: string; color: string; points: number[] }>;
  };
  expect(doc.ink).toHaveLength(1);
  expect(doc.ink[0]!.tool).toBe("highlighter");
  expect(doc.ink[0]!.color).toBe("#ffd600");
  // Simplified on the way out, but still a curve — not collapsed to its two endpoints.
  expect(doc.ink[0]!.points.length % 3).toBe(0);
  expect(doc.ink[0]!.points.length).toBeGreaterThan(6);

  await toolbar.getByRole("button", { name: "Geri al" }).click();
  await expect(surface.locator("path")).toHaveCount(0);

  await toolbar.getByRole("button", { name: "İleri al" }).click();
  await expect(surface.locator("path")).toHaveCount(1);

  expect(api.pageErrors).toEqual([]);
});

test("silgi çizilen mürekkebi kaldırır, çizim modu kart sürüklemeyi kapatır", async ({
  page,
}) => {
  const api = await mockNotebookApi(page);
  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();
  // `exact` matters here: role-name matching is a substring match by default, and "Çiz" is a
  // prefix of the tray's own "Çizimleri sil".
  await ensureNotebookToolsOpen(page);
  await page.getByRole("button", { name: "Çiz", exact: true }).click();

  const toolbar = page.getByRole("toolbar", { name: "Çizim araçları" });
  const surface = page.locator("svg[viewBox='0 0 1080 1527']").first();
  const box = (await surface.boundingBox())!;

  await drawOn(page, box);
  await expect(surface.locator("path")).toHaveCount(1);

  // The eraser retraces the same path, so it must cross the stroke it is meant to remove.
  await toolbar.getByRole("button", { name: "Silgi" }).click();
  await drawOn(page, box);
  await expect(surface.locator("path")).toHaveCount(0);

  // Leaving draw mode hands the pages back to the arranging tools, and the tray goes away.
  // `exact` matters here: role-name matching is a substring match by default, and "Çiz" is a
  // prefix of the tray's own "Çizimleri sil".
  await ensureNotebookToolsOpen(page);
  await page.getByRole("button", { name: "Çiz", exact: true }).click();
  await expect(toolbar).toHaveCount(0);

  expect(api.pageErrors).toEqual([]);
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

test("deste her kartı sırayla sorar, hiçbirini atlamaz", async ({ page }) => {
  const due = [
    makeEntry({ id: "aaaaaaaa-1111-4111-8111-111111111111", topicName: "Bir" }),
    makeEntry({ id: "bbbbbbbb-1111-4111-8111-111111111111", topicName: "İki" }),
    makeEntry({ id: "cccccccc-1111-4111-8111-111111111111", topicName: "Üç" }),
  ];
  const api = await mockNotebookApi(page, {
    due,
    overview: { dueCount: 3, entryCount: 3 },
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: /3 soru tekrar zamanı/ }).click();

  for (const label of ["Bir", "İki", "Üç"]) {
    // Both faces are mounted, so the label is in the DOM twice — one card at a time is
    // what matters here, not which face it came from.
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Çözebildim" }).click();
  }

  await expect(page.getByText("Bugünlük bu kadar")).toBeVisible();
  expect(api.reviews.map((r) => r.id)).toEqual(due.map((e) => e.id));
});

test("liste ders başlıklarıyla gruplar, karta atlar ve cevaplananı kilitler", async ({
  page,
}) => {
  const due = [
    makeEntry({
      id: "aaaaaaaa-1111-4111-8111-111111111111",
      topicName: "Problemler",
    }),
    makeEntry({
      id: "bbbbbbbb-1111-4111-8111-111111111111",
      subjectName: "Tarih",
      topicName: "Kurtuluş Savaşı",
    }),
    makeEntry({
      id: "cccccccc-1111-4111-8111-111111111111",
      topicName: "Kümeler",
    }),
  ];
  await mockNotebookApi(page, {
    due,
    overview: { dueCount: 3, entryCount: 3 },
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: /3 soru tekrar zamanı/ }).click();
  await page.getByRole("button", { name: "Listeyi aç" }).click();

  // Grouped by subject, in the order the deck introduces them — not alphabetised behind the
  // student's back.
  await expect(page.getByText("Matematik", { exact: true })).toBeVisible();
  await expect(page.getByText("Tarih", { exact: true })).toBeVisible();
  await expect(page.getByText("3 kart kaldı")).toBeVisible();
  // Navigation only: the list never offers a verdict.
  await expect(page.getByRole("button", { name: "Çözebildim" })).toHaveCount(0);

  // Jumping lands on that card, not the one after it.
  await page.getByRole("button", { name: /^Kümeler/ }).click();
  await expect(page.getByText("3 / 3")).toBeVisible();
  await page.getByRole("button", { name: "Çözebildim" }).click();

  // An answered card is shown as done and cannot be reviewed twice — a second answer would reset
  // its interval ladder and quietly undo the student's own progress.
  await page.getByRole("button", { name: "Listeyi aç" }).click();
  await expect(page.getByText("2 kart kaldı")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Kümeler/ })).toBeDisabled();
});

test("takılan kart topluluğa devredilirken kayıt kimliğini taşır", async ({
  page,
}) => {
  const due = [makeEntry({ reviewCount: 2 })];
  await mockNotebookApi(page, {
    due,
    overview: { dueCount: 1, entryCount: 1 },
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: /1 soru tekrar zamanı/ }).click();
  await page.getByRole("button", { name: "Yine çözemedim" }).click();

  // Without the id the handoff is one-way: the student asks, the thread is never attached, and the
  // card's "answered in the community" state can never happen.
  await expect(
    page.getByRole("link", { name: "Toplulukta sor" }),
  ).toHaveAttribute("href", `/topluluk/akis?notebookEntry=${due[0]!.id}`);
});

test("not kart arkasında düzenlenir; düzenlerken karta tıklamak çevirmez", async ({
  page,
}) => {
  const due = [makeEntry({ reviewCount: 2, note: "Eski not" })];
  const api = await mockNotebookApi(page, {
    due,
    overview: { dueCount: 1, entryCount: 1 },
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: /1 soru tekrar zamanı/ }).click();
  await page.getByRole("button", { name: "Çevir" }).click();

  await page.getByRole("button", { name: /Eski not/ }).click();
  const field = page.getByLabel("Notu düzenle");
  await field.fill("İşlem sırasını karıştırdım");

  // The card is a swipeable, tappable surface; a click that lands on it while the caret is in the
  // note must not turn the note face-away mid-sentence.
  await page.getByText("Biliyordum, dikkat hatası").click();
  await expect(field).toBeVisible();

  await page.getByRole("button", { name: "Notu kaydet" }).click();
  await expect.poll(() => api.patches.length).toBe(1);
  expect(api.patches[0]).toEqual({
    id: due[0]!.id,
    body: { note: "İşlem sırasını karıştırdım" },
  });
  await expect(page.getByText("İşlem sırasını karıştırdım")).toBeVisible();
});

test("deste sonu ne yapıldığını özetler", async ({ page }) => {
  const due = [
    makeEntry({ id: "aaaaaaaa-1111-4111-8111-111111111111", topicName: "Bir" }),
    makeEntry({ id: "bbbbbbbb-1111-4111-8111-111111111111", topicName: "İki" }),
    makeEntry({ id: "cccccccc-1111-4111-8111-111111111111", topicName: "Üç" }),
  ];
  await mockNotebookApi(page, {
    due,
    overview: { dueCount: 3, entryCount: 3 },
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: /3 soru tekrar zamanı/ }).click();

  await page.getByRole("button", { name: "Çözebildim" }).click();
  await page.getByRole("button", { name: "Çözebildim" }).click();
  // reviewCount 1 > 0, so the third card's miss detours through the stuck screen first.
  await page.getByRole("button", { name: "Yine çözemedim" }).click();
  await page.getByRole("button", { name: "Şimdilik geç" }).click();

  await expect(page.getByText("3 karttan 2 tanesini çözdün.")).toBeVisible();
  // The missed card is described as still in the rotation, never counted as a wrong answer.
  await expect(page.getByText(/Kalan 1 kart tekrar döngüsünde/)).toBeVisible();
});

test("çözüm kartın arkasında görünür ve tekrar sırasında yazılabilir", async ({
  page,
}) => {
  const due = [
    makeEntry({
      reviewCount: 2,
      note: "Payda eşitlemeyi atladım, sonra da sadeleştirmeyi unuttum.",
      solutionStorageKey: "notebook/u/solution.png",
      solutionUrl: "/img/welcome-hero.png",
      solutionNote:
        "Önce ortak payda, sonra sadeleştirme; kök varsa içeri almadan önce işaret.",
    }),
  ];
  const api = await mockNotebookApi(page, {
    due,
    overview: { dueCount: 1, entryCount: 1 },
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: /1 soru tekrar zamanı/ }).click();

  // Both faces are mounted so the turn has something to show, so "is the solution hidden right
  // now" is not a question Playwright can answer here — `inert` on the face away from the viewer
  // is what keeps it off the front, and the control's own state is what can be asserted.
  const flip = page.getByRole("button", { name: "Çevir" });
  await expect(flip).toBeVisible();
  await flip.click();
  await expect(
    page.getByRole("button", { name: "Soruya dön" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Çözümü büyüt" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Çözümü düzenle" }).click();
  const field = page.getByLabel("Çözümü düzenle");
  await field.fill("Önce paydaları eşitle, sonra sadeleştir.");
  await page.getByRole("button", { name: "Notu kaydet" }).click();

  await expect.poll(() => api.patches.length).toBe(1);
  expect(api.patches[0]).toEqual({
    id: due[0]!.id,
    body: { solutionNote: "Önce paydaları eşitle, sonra sadeleştir." },
  });
  // Patched in place: the note field beside it is untouched and the card never left the deck.
  await expect(
    page.getByText("Önce paydaları eşitle, sonra sadeleştir."),
  ).toBeVisible();
});

test("ders filtresi desteyi daraltır ve biten ders günü bitirmez", async ({
  page,
}) => {
  const due = [
    makeEntry({
      id: "aaaaaaaa-1111-4111-8111-111111111111",
      topicName: "Problemler",
    }),
    makeEntry({
      id: "bbbbbbbb-1111-4111-8111-111111111111",
      topicName: "Kümeler",
    }),
    makeEntry({
      id: "cccccccc-1111-4111-8111-111111111111",
      subjectName: "Tarih",
      topicName: "Kurtuluş Savaşı",
    }),
  ];
  await mockNotebookApi(page, {
    due,
    overview: { dueCount: 3, entryCount: 3 },
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: /3 soru tekrar zamanı/ }).click();
  await page.getByRole("button", { name: "Listeyi aç" }).click();

  // Two Matematik cards out of three: the deck narrows, the counter follows it.
  await page.getByRole("button", { name: "Sadece bunu çalış" }).first().click();
  await expect(page.getByText("Matematik · 1 / 2")).toBeVisible();

  await page.getByRole("button", { name: "Çözebildim" }).click();
  await page.getByRole("button", { name: "Çözebildim" }).click();

  // Matematik is finished but Tarih is not, so the day is not over — saying "bugünlük bu kadar"
  // here would be the review flow telling the student a comfortable lie.
  await expect(page.getByText("Matematik bitti")).toBeVisible();
  await expect(page.getByText(/1 kart daha var/)).toBeVisible();
  await expect(page.getByText("Bugünlük bu kadar")).toHaveCount(0);

  await page.getByRole("button", { name: "Diğerlerine geç" }).click();
  // Back to the whole deck, landing on the card the filter had hidden.
  await expect(page.getByText("Kurtuluş Savaşı").first()).toBeVisible();
  await page.getByRole("button", { name: "Çözebildim" }).click();
  await expect(page.getByText("Bugünlük bu kadar")).toBeVisible();
});

/** A page holding one entry card — the arrangement both delete paths act on. */
function seededEntryPage(entry: NotebookEntryDto): NotebookPageDto {
  return {
    pageIndex: 0,
    doc: {
      version: 1,
      paper: "ruled",
      ink: [],
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
}

test("çöp kutusu hangi silme olduğunu sorar; sayfadan kaldırmak kaydı silmez", async ({
  page,
}) => {
  const entry = makeEntry({ reviewCount: 2 });
  const api = await mockNotebookApi(page, {
    pages: { 0: seededEntryPage(entry) },
    due: [entry],
    overview: { dueCount: 1, entryCount: 1 },
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();
  await page.getByText("Problemler").click();
  await page.getByRole("button", { name: "Seçileni sil" }).click();

  // The whole point: the button used to mean the weaker one silently, and the card came back the
  // next day while the student believed they had deleted it.
  await expect(page.getByText("Bu kartı ne yapalım?")).toBeVisible();
  await page.getByRole("button", { name: "Sadece sayfadan kaldır" }).click();

  await expect
    .poll(() => api.savedPages.length, { timeout: 5_000 })
    .toBeGreaterThan(0);
  expect(api.deletes).toEqual([]);
  // Still due: taking a card off the paper is arranging, not deleting.
  await expect(
    page.getByRole("button", { name: /1 soru tekrar zamanı/ }),
  ).toBeVisible();
});

test("defterden silmek kaydı, kartı ve tekrar şeridini birlikte götürür", async ({
  page,
}) => {
  const entry = makeEntry({ reviewCount: 2 });
  const api = await mockNotebookApi(page, {
    pages: { 0: seededEntryPage(entry) },
    due: [entry],
    overview: { dueCount: 1, entryCount: 1 },
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();
  await page.getByText("Problemler").click();
  await page.getByRole("button", { name: "Seçileni sil" }).click();
  await page.getByRole("button", { name: "Defterden sil" }).click();

  await expect.poll(() => api.deletes).toEqual([entry.id]);
  // The card leaves the page document too. Left behind it would be an invisible box that still
  // selects and drags — `StageItem` renders a deleted entry as nothing, which hides the debris.
  await expect
    .poll(
      () => {
        const last = [...api.savedPages].reverse().find((p) => p.index === 0);
        const doc = last?.doc as { items: Array<{ kind: string }> } | undefined;
        return doc?.items.filter((item) => item.kind === "entry").length ?? -1;
      },
      { timeout: 5_000 },
    )
    .toBe(0);
  await expect(
    page.getByRole("button", { name: /1 soru tekrar zamanı/ }),
  ).toHaveCount(0);
});

test("kart önizlemesinden hata tipi düzeltilir", async ({ page }) => {
  const entry = makeEntry({ reviewCount: 2 });
  const api = await mockNotebookApi(page, {
    pages: { 0: seededEntryPage(entry) },
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();
  await page.getByText("Problemler").dblclick();

  await page.getByRole("button", { name: "Kartı düzenle" }).click();
  await page.getByRole("button", { name: "Bilmiyordum" }).click();
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();

  await expect.poll(() => api.patches.length).toBe(1);
  expect(api.patches[0]?.body).toMatchObject({ errorType: "UNKNOWN_TOPIC" });
});

test("denemeden gelen öğrenci ekleme formunu deneme bağlı bulur", async ({
  page,
}) => {
  const api = await mockNotebookApi(page);
  const mockExamId = "12121212-1212-4121-8121-121212121212";

  // The analysis screen hands over right after a mock exam is saved; the student came here to file
  // the mistakes they just counted, so the form is open rather than the cover.
  await page.goto(`/yanlis-defteri?mockExam=${mockExamId}`);

  await page.getByRole("button", { name: "Biliyordum, dikkat hatası" }).click();
  await pickOption(page, "Ders", "Matematik");
  await page.getByRole("button", { name: "Deftere ekle" }).click();

  await expect.poll(() => api.createdEntries.length).toBe(1);
  // The column has existed since the table was created with nothing ever filling it.
  expect(api.createdEntries[0]).toMatchObject({ mockExamId, source: "OWN" });

  // The handoff is single-use. Left in the bar it fires again on the next refresh, reopening the
  // form and stamping this exam onto whatever the student files next — attributing later mistakes
  // to an old sitting.
  await expect.poll(() => new URL(page.url()).search).toBe("");
});

test("dizin kayıtları listeler, derse göre daraltır ve sayfaya yerleştirir", async ({
  page,
}) => {
  const onPage = makeEntry({
    id: "aaaaaaaa-1111-4111-8111-111111111111",
    topicName: "Problemler",
  });
  const offPage = makeEntry({
    id: "bbbbbbbb-1111-4111-8111-111111111111",
    subjectName: "Tarih",
    subjectRef: "tarih",
    topicName: "Kurtuluş Savaşı",
  });
  const api = await mockNotebookApi(page, {
    pages: { 0: seededEntryPage(onPage) },
    indexEntries: [onPage, offPage],
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();
  await ensureNotebookToolsOpen(page);
  await page.getByRole("button", { name: "Ara", exact: true }).click();

  // Both are listed — including the one that is on no page, which neither the book nor the deck
  // could show.
  await expect(page.getByText("Kurtuluş Savaşı")).toBeVisible();

  await pickOption(page, "Ders", "Tarih");
  await expect.poll(() => api.indexQueries.at(-1)?.subjectRef).toBe("tarih");

  // Placing it puts a card on the open page; the entry already arranged there cannot be placed
  // twice, because `handleCreated` would happily add a second identical card.
  await page.getByRole("button", { name: "Sayfaya yerleştir" }).click();
  await expect
    .poll(
      () => {
        const last = [...api.savedPages].reverse().find((p) => p.index === 0);
        const doc = last?.doc as { items: Array<{ kind: string }> } | undefined;
        return doc?.items.filter((item) => item.kind === "entry").length ?? -1;
      },
      { timeout: 5_000 },
    )
    .toBe(2);
  await expect(
    page.getByRole("button", { name: "Zaten sayfada" }),
  ).toBeDisabled();
});

test("sayfadan kaldırılan kayıt dizinden bulunup silinebilir", async ({
  page,
}) => {
  // The hole the "only take it off the page" choice opened: the entry was reachable from nowhere
  // until its review fell due, so it could be neither corrected nor deleted.
  const entry = makeEntry({ reviewCount: 2 });
  const api = await mockNotebookApi(page, {
    pages: { 0: seededEntryPage(entry) },
    indexEntries: [entry],
  });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();
  await page.getByText("Problemler").click();
  await page.getByRole("button", { name: "Seçileni sil" }).click();
  await page.getByRole("button", { name: "Sadece sayfadan kaldır" }).click();

  await ensureNotebookToolsOpen(page);
  await page.getByRole("button", { name: "Ara", exact: true }).click();
  await page.getByText("Problemler").click();

  await page.getByRole("button", { name: "Kartı düzenle" }).click();
  await page.getByRole("button", { name: "Defterden sil" }).click();
  await page.getByRole("button", { name: "Defterden sil" }).click();

  await expect.poll(() => api.deletes).toEqual([entry.id]);
});

test("uzak barındırıcıdaki foto dizinde render edilebiliyor", async ({
  page,
}) => {
  /*
   * Production photos come from the R2 public bucket. The app configures no
   * `images.remotePatterns`, so `next/image` refuses that host unless the call passes
   * `unoptimized` — which every notebook photo had always done, until the review card was
   * rewritten from a plain `<img>` and three more call sites copied the omission.
   *
   * This cannot reproduce the crash itself: it is thrown by the dev overlay and this suite runs
   * against `next start`. What it does is stop the fixtures from being local-path-only, which is
   * why the whole class of bug was invisible here in the first place.
   */
  const entry = makeEntry({
    storageKey: "notebook/u/q.jpg",
    url: "https://pub-test.r2.dev/notebook/u/q.jpg",
  });
  const api = await mockNotebookApi(page, { indexEntries: [entry] });

  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();
  await ensureNotebookToolsOpen(page);
  await page.getByRole("button", { name: "Ara", exact: true }).click();

  await expect(page.getByText("Problemler")).toBeVisible();
  expect(api.pageErrors).toEqual([]);
});

test("tekrar bağlantısı desteyi açar ve parametresini tüketir", async ({
  page,
}) => {
  const due = [makeEntry({ reviewCount: 2 })];
  await mockNotebookApi(page, {
    due,
    overview: { dueCount: 1, entryCount: 1 },
  });

  // What the push notification opens.
  await page.goto("/yanlis-defteri?review=due");

  await expect(page.getByText("Bu sefer çözebildin mi?")).toBeVisible();
  // Closing the deck and refreshing should leave the student where they closed it, not reopen the
  // review they just dismissed.
  await expect.poll(() => new URL(page.url()).search).toBe("");
});
