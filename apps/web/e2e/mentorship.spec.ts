import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

/**
 * W8 mentorship, in the browser.
 *
 * The student half exists because the feature shipped with no way in: `/kocum` and
 * `/kocluk-daveti` had no entry point anywhere in the app, so a student handed an invite code
 * could not reach the screen that redeems it. That path is the launch gate, and this holds it open.
 */

const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const INVITE_CODE = "MENTOR-KOC-ABCDEF012345";

function makeUser(roles: AuthUser["roles"]): AuthUser {
  return {
    id: STUDENT_ID,
    email: "ogrenci@test.local",
    displayName: "Ayşe Yılmaz",
    username: "ayse",
    avatarUrl: null,
    bio: null,
    website: null,
    roles,
    organizationId: null,
    examType: "KPSS",
    examVariant: "LISANS",
    examDate: "2026-07-26",
    dailyFocusGoalMinutes: null,
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

const DATA_SCOPE = ["ACTIVITY", "MOCK_EXAMS", "PLAN_TASK_TITLES", "MOOD_LEVEL", "EXAM_TRACK"];

interface CoachNote {
  body: string;
  updatedAt: string;
}

const MY_COACH = {
  linkId: "11111111-1111-4111-8111-111111111111",
  coachDisplayName: "Koç Mert",
  coachUsername: "kocmert",
  status: "ACTIVE",
  acceptedAt: "2026-09-01T10:00:00.000Z",
  dataScope: DATA_SCOPE,
  coachNote: null as CoachNote | null,
};

test.describe("öğrenci tarafı", () => {
  test("profildeki Koçum satırı davet ekranına kadar götürür", async ({ page }) => {
    // The point of the slice: without this row the invite screen is unreachable from anywhere.
    const api = await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto("/profil");

    await page.getByRole("link", { name: "Koçum" }).click();
    await expect(page).toHaveURL(/\/kocum$/);
    await expect(page.getByText("Henüz bir koçun yok")).toBeVisible();

    await page.getByRole("link", { name: "Koçluk daveti" }).click();
    await expect(page).toHaveURL(/\/kocluk-daveti$/);
    expect(api.acceptCalls).toBe(0);
  });

  test("kod önce veri kapsamını gösterir, kabul ondan sonra gelir", async ({ page }) => {
    const api = await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto("/kocluk-daveti");

    await page.getByLabel("Davet kodu").fill(INVITE_CODE);
    await page.getByRole("button", { name: "Kodu getir" }).click();

    await expect(page.getByText("Koç Mert", { exact: false }).first()).toBeVisible();
    // KVKK informed consent: the scope list is part of the contract, not decorative copy.
    await expect(page.getByRole("heading", { name: "Koçunun görebildikleri" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Koçunun göremedikleri" })).toBeVisible();
    // Reading a code is not consenting to it.
    expect(api.acceptCalls).toBe(0);

    await page.getByRole("button", { name: "Onaylıyorum, bağlan" }).click();
    await expect.poll(() => api.acceptCalls).toBe(1);
  });

  test("?code= yalnız alanı doldurur, kendiliğinden bağlamaz", async ({ page }) => {
    // Clicking a link somebody sent is not consent, so the query param stops at the input.
    const api = await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto(`/kocluk-daveti?code=${INVITE_CODE}`);

    await expect(page.getByLabel("Davet kodu")).toHaveValue(INVITE_CODE);
    expect(api.previewCalls).toBe(0);
    expect(api.acceptCalls).toBe(0);
  });

  test("koçun duran notu öğrencinin şeffaflık ekranında görünür", async ({ page }) => {
    await mockApi(page, {
      roles: ["STUDENT"],
      myCoach: {
        ...MY_COACH,
        coachNote: {
          body: "Bu hafta paragrafa ağırlık ver.",
          updatedAt: "2026-09-04T09:00:00.000Z",
        },
      },
    });
    await page.goto("/kocum");

    await expect(page.getByText("Koç Mert")).toBeVisible();
    await expect(page.getByText("Bu hafta paragrafa ağırlık ver.")).toBeVisible();
  });

  test("bayrak kapalıyken hata değil, kapalı durumu gösterir", async ({ page }) => {
    // The profile row shows regardless of the kill switch, so a toast would read as a bug on a
    // screen the student just opened. The switch is a state, not a failure.
    await mockApi(page, { roles: ["STUDENT"], myCoach: null, disabled: true });
    await page.goto("/kocum");

    await expect(page.getByText("Koçluk şu an kapalı")).toBeVisible();
    await expect(page.getByRole("link", { name: "Koçluk daveti" })).toHaveCount(0);
  });
});

test.describe("koç tarafı", () => {
  test("roster hazır davet linkini kopyalatır", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto("/kocluk");

    await expect(page.getByText(INVITE_CODE)).toBeVisible();

    await page.getByRole("button", { name: "Linki kopyala" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    // The coach shares a link, not a bare code; the param only prefills the field.
    expect(copied).toContain(`/kocluk-daveti?code=${INVITE_CODE}`);
  });

  test("kokpit kohortu özetler ve öğrenci başına tek öneri verir", async ({ page }) => {
    await mockApi(page, {
      roles: ["STUDENT", "COACH"],
      myCoach: null,
      roster: [
        rosterRow("Ada", ["PLAN_SLIPPING", "LOW_MOOD"], 0.2),
        rosterRow("Bora", ["INACTIVE"], null),
        rosterRow("Cem", [], 0.8),
      ],
    });
    await page.goto("/kocluk");

    await expect(page.getByText("3 öğrenciden 2 tanesi ilgi bekliyor.")).toBeVisible();
    // The average leaves Bora out: he planned nothing, and counting that as 0% would report a
    // cohort that never opened the plan screen as one that plans and fails.
    await expect(page.getByText("Plan uyumu %50 (2 öğrenci)")).toBeVisible();

    // Severity order, not the order the API happened to evaluate the flags in: the roster row
    // for Ada lists PLAN_SLIPPING first, and the breakdown still puts INACTIVE at the front.
    const chips = page.getByRole("list", { name: "Risk dağılımı" }).getByRole("listitem");
    await expect(chips).toHaveText(["Sessiz · 1", "Morali düşük · 1", "Plan aksıyor · 1"]);

    // One suggestion per student, for their worst flag — LOW_MOOD outranks PLAN_SLIPPING even
    // though the API lists it second.
    await expect(page.getByText("Ona bir not bırak, bu haftanın yükünü hafiflet.")).toBeVisible();
    await expect(page.getByText("Bu haftanın ödevini hafiflet.")).toHaveCount(0);
  });

  test("kontenjan koça görünür ve dolduğunda söylenir", async ({ page }) => {
    await mockApi(page, {
      roles: ["STUDENT", "COACH"],
      myCoach: null,
      roster: [rosterRow("Ada", [], 0.5), rosterRow("Bora", [], 0.5)],
      maxActiveStudents: 2,
    });
    await page.goto("/kocluk");

    // The quota is enforced on the STUDENT's redemption, so the coach's own screen is the only
    // place they can learn about it before handing the code to someone who will be refused.
    await expect(page.getByText("2/2 öğrenci")).toBeVisible();
    await expect(page.getByText("Kontenjanın dolu.", { exact: false })).toBeVisible();
    // A full roster still empties; rotating is not blocked.
    await expect(page.getByRole("button", { name: "Yeni kod üret" })).toBeEnabled();
  });

  test("koç kendi veri kapsamını okuyabilir", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto("/kocluk");

    // Open by default on an empty roster: the coach's first screen is the one moment they have
    // nothing else to read, and the student saw this same contract before consenting.
    await expect(page.getByText("Günlük mod puanı (1-5)")).toBeVisible();
    await expect(
      page.getByText("Öğrencinin AI koçla konuştukları", { exact: false }),
    ).toBeVisible();
  });

  test("rapor silinen ödevi gösterir, çünkü yaşayan plan gösteremez", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto(`/kocluk/${STUDENT_ID}`);

    await expect(page.getByRole("heading", { name: "Silinen ödevler" })).toBeVisible();
    await expect(page.getByText("Silinecek deneme")).toBeVisible();
  });

  test("geçen haftayı kopyala yalnız koçun kendi satırlarını taslağa alır", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto(`/kocluk/${STUDENT_ID}`);

    const repeat = page.getByRole("button", { name: "Geçen haftayı kopyala" });
    await expect(repeat).toBeEnabled();
    await expect(page.getByText("0/21 görev")).toBeVisible();

    await repeat.click();

    // Two rows sit in last week and exactly one draft comes out: the student's own row is left
    // alone, because lifting it would turn their choice into the coach's assignment. The counter
    // carries the whole claim — asserting on the titles would match the report's plan list too,
    // which renders the same rows further down the page. `repeat-week.spec.ts` covers the
    // filtering itself; what this proves is that the button is wired to it.
    await expect(page.getByText("1/21 görev")).toBeVisible();
  });

  test("şablon kaydı programı gün ofsetine çevirir, tarihe değil", async ({ page }) => {
    const api = await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto(`/kocluk/${STUDENT_ID}`);

    // Compose two tasks on two different days of the shown week.
    await page.getByLabel("Görev", { exact: true }).fill("İlk görev");
    await page.getByRole("button", { name: "Seçili güne ekle" }).click();
    // The day chips, by their group label — matching on the rendered date would tie the test to
    // the browser's own calendar, and matching on the "· N" count only works after a draft exists.
    await page.getByRole("group", { name: "Gün seç" }).getByRole("button").nth(2).click();
    await page.getByLabel("Görev", { exact: true }).fill("İkinci görev");
    await page.getByRole("button", { name: "Seçili güne ekle" }).click();
    await expect(page.getByText("2/21 görev")).toBeVisible();

    await page.getByLabel("Şablon adı").fill("Hafta 1");
    await page.getByRole("button", { name: "Şablon olarak kaydet" }).click();

    await expect.poll(() => api.savedTemplates.length).toBe(1);
    const saved = api.savedTemplates[0]!;
    expect(saved.name).toBe("Hafta 1");
    // The whole point: the program is stored as offsets from its own first day, so it can be
    // re-dated onto any week. A saved date would pin it to the week it was composed in.
    expect(saved.tasks).toEqual([
      expect.objectContaining({ dayIndex: 0, title: "İlk görev" }),
      expect.objectContaining({ dayIndex: 2, title: "İkinci görev" }),
    ]);
    expect(JSON.stringify(saved.tasks)).not.toContain("taskDate");
  });

  test("başka sınav için kaydedilmiş şablonun konuları sessizce taşınmaz", async ({ page }) => {
    await mockApi(page, {
      roles: ["STUDENT", "COACH"],
      myCoach: null,
      // The report's student sits KPSS; this template was built against YKS.
      templates: [
        {
          id: "tpl-1",
          name: "YKS haftası",
          examType: "YKS",
          updatedAt: "2026-09-01T00:00:00.000Z",
          tasks: [
            {
              dayIndex: 0,
              title: "Paragraf 20 soru",
              subject: "Türkçe",
              topic: "Paragraf",
              coachNote: null,
            },
          ],
        },
      ],
    });
    await page.goto(`/kocluk/${STUDENT_ID}`);

    await page.getByLabel("Şablondan yükle").selectOption({ label: "YKS haftası · 1 görev" });

    await expect(page.getByText("1/21 görev")).toBeVisible();
    // Said out loud, not silently thinned: `topic` is a soft ref into the content taxonomy and the
    // API never checks it against THIS student's exam.
    await expect(
      page.getByText("1 görevin konusu kaldırıldı", { exact: false }),
    ).toBeVisible();
  });

  test("not yazmak öğrenciye giden tek yönlü kaydı gönderir", async ({ page }) => {
    const api = await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto(`/kocluk/${STUDENT_ID}`);

    const field = page.getByRole("textbox", { name: "Öğrenciye notun" });
    await field.fill("Bu hafta paragrafa ağırlık ver.");
    await page.getByRole("button", { name: "Notu kaydet" }).click();

    await expect.poll(() => api.noteBodies).toEqual(["Bu hafta paragrafa ağırlık ver."]);
  });
});

/**
 * One ACTIVE roster row. Metrics carry the numbers the header's cohort band averages; `riskFlags`
 * drives both the flag counts and the per-student suggestion.
 */
function rosterRow(
  name: string,
  riskFlags: string[],
  planCompletionRate7d: number | null,
): Record<string, unknown> {
  return {
    linkId: `link-${name}`,
    studentId: `${name}-id`,
    studentDisplayName: name,
    studentUsername: null,
    status: "ACTIVE",
    acceptedAt: "2026-09-01T00:00:00.000Z",
    endedAt: null,
    riskFlags,
    metrics: {
      lastActiveDate: daysFromToday(-1),
      currentStreak: 2,
      focusMinutes7d: 120,
      sessions7d: 4,
      activeDays7d: 3,
      planCompletionRate7d,
      latestMockNet: 55,
      latestMockAt: daysFromToday(-2),
      moodLevel7dAvg: 4,
    },
  };
}

/** A date offset from today in the browser's own calendar, as `yyyy-mm-dd`. */
function daysFromToday(offset: number): string {
  const now = new Date();
  const shifted = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return new Date(shifted.getTime() - shifted.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

async function mockApi(
  page: Page,
  options: {
    roles: AuthUser["roles"];
    myCoach: typeof MY_COACH | null;
    disabled?: boolean;
    /** ACTIVE roster rows. The header's summary and seat count are both derived from these. */
    roster?: ReturnType<typeof rosterRow>[];
    maxActiveStudents?: number;
    /** The coach's saved programs, as `GET /v1/mentorship/templates` would return them. */
    templates?: Record<string, unknown>[];
  },
) {
  const user = makeUser(options.roles);
  let previewCalls = 0;
  let acceptCalls = 0;
  const noteBodies: (string | null)[] = [];
  const savedTemplates: { name: string; tasks: unknown[] }[] = [];

  const report = {
    studentId: STUDENT_ID,
    studentDisplayName: "Ayşe Yılmaz",
    studentUsername: "ayse",
    acceptedAt: "2026-09-01T10:00:00.000Z",
    studentExamType: "KPSS",
    coachNote: null,
    riskFlags: [],
    activity: {
      lastActiveDate: daysFromToday(-1),
      currentStreak: 3,
      longestStreak: 9,
      sessions7d: 4,
      focusMinutes7d: 180,
      activeDays7d: 3,
      sessions28d: 12,
      focusMinutes28d: 640,
      activeDays28d: 11,
    },
    planCompletionRate7d: 0.6,
    mockTrend: [],
    latestMockSubjects: [],
    planTasks: [
      {
        taskDate: daysFromToday(-3),
        title: "Paragraf 20 soru",
        subject: "Türkçe",
        topic: "Paragraf",
        status: "DONE",
        assignedByCoach: true,
        coachNote: "Süre tut",
      },
      {
        taskDate: daysFromToday(-2),
        title: "Kendi çalışmam",
        subject: null,
        topic: null,
        status: "PENDING",
        assignedByCoach: false,
        coachNote: null,
      },
    ],
    droppedAssignments: [
      {
        taskDate: daysFromToday(-4),
        title: "Silinecek deneme",
        droppedAt: "2026-09-03T18:00:00.000Z",
      },
    ],
    moodTrend: [],
  };

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

    if (options.disabled && path.startsWith("/v1/mentorship/")) {
      return json(route, { code: "MENTORSHIP_DISABLED", message: "Koçluk kapalı" }, 403);
    }

    if (method === "GET" && path === "/v1/mentorship/my-coach") {
      // Empty 200, not a null body, when there is no coach — same as the API.
      return json(route, options.myCoach, options.myCoach ? 200 : 204);
    }
    if (method === "POST" && path === "/v1/mentorship/invitations/preview") {
      previewCalls += 1;
      return json(route, {
        coachDisplayName: "Koç Mert",
        coachUsername: "kocmert",
        dataScope: DATA_SCOPE,
      });
    }
    if (method === "POST" && path === "/v1/mentorship/invitations/accept") {
      acceptCalls += 1;
      return json(route, MY_COACH);
    }
    if (method === "GET" && path === "/v1/mentorship/templates") {
      return json(route, options.templates ?? []);
    }
    if (method === "POST" && path === "/v1/mentorship/templates") {
      const body = request.postDataJSON() as { name: string; tasks: unknown[] };
      savedTemplates.push(body);
      return json(route, { id: "tpl-new", updatedAt: "2026-09-05T00:00:00.000Z", ...body });
    }
    if (method === "DELETE" && path.startsWith("/v1/mentorship/templates/")) {
      return json(route, null, 204);
    }
    if (method === "GET" && path === "/v1/mentorship/overview") {
      return json(route, {
        inviteCode: { code: INVITE_CODE, expiresAt: "2026-09-30T00:00:00.000Z" },
        activeStudents: options.roster?.length ?? 0,
        maxActiveStudents: options.maxActiveStudents ?? 20,
        dataScope: DATA_SCOPE,
      });
    }
    if (method === "GET" && path.startsWith("/v1/mentorship/students?")) {
      const items = path.includes("status=ACTIVE") ? (options.roster ?? []) : [];
      return json(route, { items, total: items.length, page: 1, pageSize: 100 });
    }
    if (method === "GET" && path === `/v1/mentorship/students/${STUDENT_ID}`) {
      return json(route, report);
    }
    if (method === "PUT" && path === `/v1/mentorship/students/${STUDENT_ID}/note`) {
      noteBodies.push((request.postDataJSON() as { body: string | null }).body);
      return json(route, null, 204);
    }
    if (method === "GET" && path.startsWith("/v1/content/exams/")) {
      return json(route, [
        {
          subjectSlug: "turkce",
          subjectName: "Türkçe",
          slug: "paragraf",
          name: "Paragraf",
          sortOrder: 1,
        },
      ]);
    }

    return json(route, null, 204);
  });

  return {
    get previewCalls() {
      return previewCalls;
    },
    get acceptCalls() {
      return acceptCalls;
    },
    get noteBodies() {
      return noteBodies;
    },
    get savedTemplates() {
      return savedTemplates;
    },
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
