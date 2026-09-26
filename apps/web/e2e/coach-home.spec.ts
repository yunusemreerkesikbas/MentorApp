import { expect, test, type Page } from "@playwright/test";
import type {
  AuthUser,
  MentorshipCohortBriefDto,
  MentorshipFollowupDto,
  MentorshipRiskFlagId,
  MentorshipRosterRowDto,
} from "@mentor/types";

/**
 * The coach's home (APP-090, redesigned 2026-09-24 as "Koçun turu").
 *
 * The first block holds the fix that made this page a coach's home: they land in their own world,
 * the student ritual is shut to them, and the account screens they need stay open. The second holds
 * the round: who waits, who is next, what a mark does, and what the assistant may say. The third
 * holds the invite card's decisions (a masked bearer secret, a rotation that asks first).
 */

const COACH: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "koc@test.local",
  displayName: "Mert",
  username: "kocmert",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT", "COACH"],
  organizationId: null,
  examType: "KPSS",
  examVariant: "LISANS",
  examDate: null,
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const DAY = 86_400_000;
const isoDaysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const dateDaysAgo = (days: number) => isoDaysAgo(days).slice(0, 10);

function rosterRow(
  id: string,
  name: string,
  over: {
    flags?: MentorshipRiskFlagId[];
    needsAttention?: boolean;
    attendedAt?: string | null;
    lastActiveDaysAgo?: number | null;
    streak?: number;
    ended?: boolean;
  } = {},
): MentorshipRosterRowDto {
  const flags = over.flags ?? [];
  const last = over.lastActiveDaysAgo === undefined ? 0 : over.lastActiveDaysAgo;
  return {
    linkId: `link-${id}`,
    studentId: id,
    studentDisplayName: name,
    studentUsername: null,
    avatarUrl: null,
    status: over.ended ? "ENDED" : "ACTIVE",
    acceptedAt: "2026-09-01T10:00:00.000Z",
    endedAt: over.ended ? "2026-09-10T10:00:00.000Z" : null,
    metrics: over.ended
      ? null
      : {
          lastActiveDate: last === null ? null : dateDaysAgo(last),
          currentStreak: over.streak ?? 0,
          focusMinutes7d: 120,
          dailyFocusMinutes14d: [0, 30, 0, 45, 90, 0, 20, 60, 0, 0, 35, 0, 50, last === 0 ? 40 : 0],
          sessions7d: 3,
          activeDays7d: 3,
          planCompletionRate7d: 0.5,
          latestMockNet: 60,
          latestMockAt: "2026-09-20T10:00:00.000Z",
          moodLevel7dAvg: 3,
        },
    riskFlags: flags,
    attendedAt: over.attendedAt ?? null,
    needsAttention: over.needsAttention ?? flags.length > 0,
  };
}

const ZEYNEP = rosterRow("s-zeynep", "Zeynep Kaya", { flags: ["INACTIVE"], lastActiveDaysAgo: 17 });
const ALI = rosterRow("s-ali", "Ali Demir", { flags: ["NET_DROP"] });
const ECE = rosterRow("s-ece", "Ece Yılmaz", { flags: ["LOW_MOOD"] });
const MERT = rosterRow("s-mert", "Mert Can", {
  flags: ["PLAN_SLIPPING"],
  needsAttention: false,
  attendedAt: new Date().toISOString(),
});
const BURAK = rosterRow("s-burak", "Burak Kılıç", { streak: 14 });
const COHORT = [ZEYNEP, ALI, ECE, MERT, BURAK];

const BRIEF: MentorshipCohortBriefDto = {
  overall: "Zeynep denemelerde yükselişteyken çalışmayı bıraktı; Ali'nin son denemesi düştü.",
  items: [
    {
      studentId: ZEYNEP.studentId,
      studentDisplayName: ZEYNEP.studentDisplayName,
      riskFlags: ["INACTIVE"],
      why: "Denemelerde yükselişteyken çalışma kaydı kesildi.",
      action: "Kısa bir not bırak.",
      isNew: true,
    },
  ],
  model: "cache",
  generatedAt: new Date().toISOString(),
};

type MockOptions = {
  rows?: MentorshipRosterRowDto[];
  ended?: MentorshipRosterRowDto[];
  pro?: boolean;
  brief?: MentorshipCohortBriefDto | "fail";
  overview?: Record<string, unknown>;
  followups?: MentorshipFollowupDto[];
  emailVerified?: boolean;
  inviteCode?: { code: string; expiresAt: string } | null;
  calls?: { attention: unknown[]; brief: number; verificationEmail: number; rotateInvite: number };
};

async function mockApi(page: Page, user: AuthUser, options: MockOptions = {}) {
  const calls = options.calls;
  const inviteCode =
    "inviteCode" in options
      ? options.inviteCode
      : { code: "MENTOR-KOC-ABCDEF123456", expiresAt: "2026-12-01T00:00:00.000Z" };
  const rows = options.rows ?? COHORT;

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const headers = {
      "access-control-allow-origin": request.headers().origin ?? "http://localhost:3100",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type, authorization, accept-language",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    };
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });

    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json({ accessToken: "test-token", expiresIn: 3600, user });
    }
    if (path === "/v1/users/me") return json(user);
    // The settings screen dereferences this body; a bare 204 would throw before it paints.
    if (path === "/v1/users/me/auth-accounts/google") return json({ enabled: false, linked: false, email: null });
    if (path === "/v1/subscription") {
      return json({
        subscription: null,
        entitlement: options.pro
          ? { tier: "PREMIUM", isPremium: true, validUntil: "2026-12-01T00:00:00.000Z", reason: "ACTIVE" }
          : { tier: "FREE", isPremium: false, validUntil: null, reason: "NONE" },
        features: {},
        discount: null,
      });
    }
    if (path === "/v1/mentorship/students") {
      const items = url.searchParams.get("status") === "ENDED" ? (options.ended ?? []) : rows;
      return json({ items, total: items.length, page: 1, pageSize: 100 });
    }
    if (method === "PUT" && path.endsWith("/attention")) {
      calls?.attention.push({ path, body: request.postDataJSON() });
      return route.fulfill({ status: 204, headers });
    }
    if (method === "POST" && path === "/v1/mentorship/brief") {
      if (calls) calls.brief += 1;
      if (options.brief === "fail") return json({ code: "INTERNAL_ERROR", message: "x" }, 500);
      return json(options.brief ?? BRIEF);
    }
    if (method === "POST" && path === "/v1/users/me/verification-email") {
      if (calls) calls.verificationEmail += 1;
      return json({ ok: true });
    }
    if (method === "POST" && path === "/v1/mentorship/invite-code") {
      if (calls) calls.rotateInvite += 1;
      return json({ code: "MENTOR-KOC-ROTATEDCODE12", expiresAt: "2026-12-15T00:00:00.000Z" });
    }
    if (path === "/v1/mentorship/overview") {
      return json({
        inviteCode,
        activeStudents: rows.length,
        maxActiveStudents: 20,
        freeSeats: 3,
        paidSeats: 10,
        usedSeats: rows.length,
        sponsorshipEnabled: true,
        seatAllowance: 13,
        seatPlansOnSale: false,
        dataScope: ["ACTIVITY", "MOCK_EXAMS"],
        ...options.overview,
      });
    }
    if (path === "/v1/mentorship/coach-registration/mine") {
      return json({
        registrationOpen: true,
        emailVerified: options.emailVerified ?? user.emailVerified,
        registration: {
          id: "reg-1",
          status: "ACTIVE",
          headline: "KPSS Türkçe koçu",
          bio: "On yıldır çalışıyorum.",
          institution: null,
          branch: null,
          years: null,
          note: null,
          submittedAt: "2026-09-01T00:00:00.000Z",
          reviewedAt: null,
          reviewNote: null,
          verifiedClaims: [],
        },
      });
    }
    if (path === "/v1/mentorship/followups/availability") return json({ enabled: Boolean(options.followups) });
    if (path === "/v1/mentorship/followups") {
      const items = options.followups ?? [];
      return json({ items, total: items.length, page: 1, pageSize: 5 });
    }
    if (path.startsWith("/v1/content/exams/by-type/") && path.endsWith("/calendar")) {
      return json({
        exam: { id: "e1", slug: "kpss-lisans-2026", name: "KPSS Lisans 2026" },
        events: [],
        examDateLabel: "30 Aralık 2026",
        daysRemaining: 113,
        nextEvent: null,
        daysUntilNextEvent: null,
      });
    }
    if (path.startsWith("/v1/content/exams/by-type/")) {
      return json({
        id: "e1",
        slug: "kpss-lisans-2026",
        name: "KPSS Lisans 2026",
        family: "KPSS",
        variant: "LISANS",
        isCurrent: true,
      });
    }
    if (path === "/v1/forum/zones") return json({ items: [{ id: "z1", slug: "kpss" }], total: 1 });
    if (path === "/v1/notifications") return json({ items: [], unreadCount: 0, total: 0 });
    if (path.startsWith("/v1/achievements") || path.startsWith("/v1/journey")) {
      return json({ celebrations: [] });
    }
    return route.fulfill({ status: 204, headers });
  });
}

const newCalls = () => ({ attention: [] as unknown[], brief: 0, verificationEmail: 0, rotateInvite: 0 });

test.describe("koçun kendi dünyası", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, COACH);
  });

  test("öğrenci paneline giden koç kendi paneline yönlendirilir", async ({ page }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/kocluk$/, { timeout: 10_000 });
    // And the screen this ticket exists to stop them seeing never renders, not even for a frame.
    await expect(page.getByTestId("today-path-card")).toHaveCount(0);
    await expect(page.getByText("Hedefini belirle")).toHaveCount(0);
  });

  test("öğrenci ritüelinin geri kalanı da kapalı", async ({ page }) => {
    // APP-091 made `/plan` role-aware; it is now a coach work surface, not a blocked ritual.
    for (const path of ["/analiz", "/kocum"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/kocluk$/, { timeout: 10_000 });
    }
  });

  test("hesap ekranları açık kalır", async ({ page }) => {
    // Blocking these would be a bug: Koç Pro is bought on /abonelik, and a coach locked out of
    // /ayarlar cannot change their password or delete their account.
    for (const path of ["/ayarlar", "/topluluk"]) {
      await page.goto(path);
      await expect(page, path).not.toHaveURL(/\/kocluk$/);
    }
  });

  test("sağ kolon koçun sınavını ve topluluğu gösterir, öğrenci ritüeli gelmez", async ({ page }) => {
    await page.goto("/kocluk");
    await expect(page.getByText("Sınava kalan")).toBeVisible();
    await expect(page.getByText("113")).toBeVisible();
    await expect(page.getByText("KPSS Lisans 2026", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Topluluğa git" })).toBeVisible();

    await expect(page.getByTestId("today-path-card")).toHaveCount(0);
    await expect(page.getByText("Bugün nasılsın?")).toHaveCount(0);
  });

  test("koç kabuğu panelle aynı masaüstü sidebarını kullanır", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium");
    await page.goto("/kocluk");

    await expect(page.getByTestId("app-sidebar")).toBeVisible();
    await expect(page.getByRole("link", { name: "Öğrencilerim" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bildirimler", exact: false })).toBeVisible();
    await expect(
      page.getByTestId("app-sidebar").getByRole("link", { name: "Mentor" }),
    ).toHaveAttribute("href", "/kocluk");
    await expect(page.locator("header").getByText("Mentor", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Panele dön" })).toHaveCount(0);
  });

  test("koç kabuğu mobilde panel üst ve alt navigasyonunu kullanır", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium");
    await page.goto("/kocluk");

    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Öğrencilerim" })).toBeVisible();
  });

  test("ortak sidebar koç profil alt rotasında da korunur", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium");
    await page.goto("/kocluk/profil");

    await expect(page.getByTestId("app-sidebar")).toBeVisible();
    await expect(page.getByRole("link", { name: "Öğrencilerim" })).toBeVisible();
  });

  test("öğrenci paneli öğrenci için bozulmadı", async ({ page }) => {
    // The other half of the guard: nothing above may cost a student their own dashboard.
    await mockApi(page, { ...COACH, roles: ["STUDENT"] });
    await page.goto("/panel");
    await expect(page).not.toHaveURL(/\/kocluk$/);
  });
});

test.describe("koçun turu", () => {
  test("bekleyenler düğüm düğüm, sıradaki büyük, tek dolu buton ona gider", async ({ page }) => {
    await mockApi(page, COACH);
    await page.goto("/kocluk");

    const round = page.getByTestId("coach-round");
    await expect(round.getByRole("heading", { name: "3 öğrenci seni bekliyor" })).toBeVisible();
    const nodes = round.getByTestId("round-node");
    await expect(nodes).toHaveCount(4);
    await expect(nodes.nth(0)).toHaveAccessibleName("Mert Can, bugün baktın");
    await expect(nodes.nth(1)).toHaveAccessibleName("Zeynep Kaya, sıradaki, 17 gün sessiz");
    await expect(nodes.nth(2)).toHaveAccessibleName("Ali Demir, bekliyor, Net düştü");

    const next = round.getByRole("link", { name: "Zeynep'e bak" });
    await expect(next).toHaveAttribute("href", `/kocluk/${ZEYNEP.studentId}`);
    // One filled ledge on the whole screen (DESIGN.md §1): the round's.
    await expect(page.locator('[class*="shadow-[0_4px_0_var(--play-cta-edge)]"]:visible')).toHaveCount(1);
    await expect(round.getByText("Bugün 4 öğrencin çalıştı")).toBeVisible();
  });

  test("düğümden İlgilendim: tur hemen ilerler, satır yerinde kalır", async ({ page }) => {
    const calls = newCalls();
    await mockApi(page, COACH, { calls });
    await page.goto("/kocluk");

    await page.getByTestId("round-node").nth(1).click();
    await page.getByRole("menuitem", { name: "İlgilendim" }).click();

    await expect(page.getByRole("heading", { name: "2 öğrenci seni bekliyor" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ali'ye bak" })).toBeVisible();
    expect(calls.attention).toEqual([
      { path: `/v1/mentorship/students/${ZEYNEP.studentId}/attention`, body: { attended: true } },
    ]);
    // The list does not reshuffle under the pointer: Zeynep stays with the waiting, marked. The
    // toggle keeps its name; `aria-pressed` carries the state.
    const waiting = page.getByRole("heading", { name: "Seni bekleyenler" }).locator("..");
    await expect(
      waiting.getByRole("button", { name: "Zeynep Kaya: ilgilendim", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("eski bir işaret satırda 'bugün' demez", async ({ page }) => {
    const earlier = rosterRow("s-earlier", "Can Er", {
      flags: ["PLAN_SLIPPING"],
      needsAttention: false,
      attendedAt: isoDaysAgo(3),
    });
    await mockApi(page, COACH, { rows: [earlier, BURAK] });
    await page.goto("/kocluk");
    const toggle = page.getByRole("button", { name: "Can Er: ilgilendim", exact: true });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("3 gün önce baktın")).toBeVisible();
  });

  test("davet bilgisi gelmezse kart iskelette kalmaz, yeniden dener", async ({ page }) => {
    await mockApi(page, COACH);
    let failing = true;
    await page.route("**/v1/mentorship/overview", async (route) => {
      if (!failing || route.request().method() === "OPTIONS") return route.fallback();
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3100",
          "access-control-allow-credentials": "true",
        },
        body: JSON.stringify({ code: "INTERNAL_ERROR", message: "x" }),
      });
    });
    await page.goto("/kocluk");
    const card = page.getByRole("region", { name: "Davet ve koltuklar" });
    await expect(card.getByText("Davet bilgin şu an gelmedi.")).toBeVisible();
    failing = false;
    await card.getByRole("button", { name: "Yeniden dene" }).click();
    await expect(card.getByText("Davet bilgin şu an gelmedi.")).toHaveCount(0);
    await expect(card.getByText("koltuk dolu", { exact: false })).toBeVisible();
  });

  test("tur yüklenirken ekran okuyucuya yüklendiğini söyler", async ({ page }) => {
    await mockApi(page, COACH);
    await page.route("**/v1/mentorship/students?**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6_000));
      await route.fallback();
    });
    await page.goto("/kocluk");
    await expect(page.getByRole("status", { name: "Yükleniyor" }).first()).toBeVisible({ timeout: 5_000 });
  });

  test("tur bu ekranda bitince bitiş anı o an oynar", async ({ page }) => {
    // One waiting student: marking them here completes the round on the spot.
    await mockApi(page, COACH, { rows: [ALI, BURAK] });
    await page.goto("/kocluk");
    const open = page.getByRole("img", { name: "Turun sonu" });
    await expect(open).toBeVisible();
    // framer-motion reads `initial` only on mount, so the moment plays only on a node drawn anew.
    await open.evaluate((node) => node.setAttribute("data-probe", "before"));
    await page.getByTestId("round-node").nth(0).click();
    await page.getByRole("menuitem", { name: "İlgilendim" }).click();

    const done = page.getByRole("img", { name: "Tur tamam" });
    await expect(done).toBeVisible();
    await expect(done).not.toHaveAttribute("data-probe", "before");
  });

  test("bayat işaret öğrenciyi yeniden bekleyenlere koyar ve İlgilendim sunar", async ({ page }) => {
    // Marked eight days ago; the server says the student waits again. The old screen showed a
    // faded row whose only action was "take the mark back".
    const stale = rosterRow("s-stale", "Selin Ak", {
      flags: ["INACTIVE"],
      needsAttention: true,
      attendedAt: isoDaysAgo(8),
    });
    await mockApi(page, COACH, { rows: [stale, BURAK] });
    await page.goto("/kocluk");

    await expect(page.getByRole("heading", { name: "1 öğrenci seni bekliyor" })).toBeVisible();
    const toggle = page.getByRole("button", { name: "Selin Ak: ilgilendim", exact: true });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    // …and among the waiting, where the round says she is.
    const waiting = page.getByRole("heading", { name: "Seni bekleyenler" }).locator("..");
    await expect(waiting.getByText("Selin Ak")).toBeVisible();
  });

  test("Koç Pro'da asistan kendiliğinden yazar, etiketiyle; satırda nedeni", async ({ page }) => {
    const calls = newCalls();
    await mockApi(page, COACH, { pro: true, calls });
    await page.goto("/kocluk");

    const round = page.getByTestId("coach-round");
    await expect(round.getByText(BRIEF.overall)).toBeVisible();
    await expect(round.getByText("Asistanından")).toBeVisible();
    await expect(page.getByText("Denemelerde yükselişteyken çalışma kaydı kesildi.")).toBeVisible();
    // At least once: a dev server's strict mode mounts effects twice; the server cache makes the
    // second answer free either way.
    expect(calls.brief).toBeGreaterThan(0);
  });

  test("AI yoksa kural cümlesi: etiket yok, istek yok", async ({ page }) => {
    const calls = newCalls();
    await mockApi(page, COACH, { calls });
    await page.goto("/kocluk");

    const round = page.getByTestId("coach-round");
    await expect(
      round.getByText(
        "İlki Zeynep. Bir süredir çalışma kaydı yok. Ona bir not bırak, nerede kaldığını sor.",
      ),
    ).toBeVisible();
    await expect(round.getByText("Asistanından")).toHaveCount(0);
    expect(calls.brief).toBe(0);
  });

  test("AI hata verirse kural cümlesi kalır, toast çıkmaz", async ({ page }) => {
    await mockApi(page, COACH, { pro: true, brief: "fail" });
    await page.goto("/kocluk");

    await expect(page.getByText("İlki Zeynep.", { exact: false })).toBeVisible();
    await expect(page.getByText("Asistanından")).toHaveCount(0);
    await expect(page.getByText("Bir sorun oluştu")).toHaveCount(0);
  });

  test("kimse beklemiyorsa tur sakin, buton koç planına", async ({ page }) => {
    await mockApi(page, COACH, { rows: [BURAK] });
    await page.goto("/kocluk");

    await expect(page.getByRole("heading", { name: "Bugün herkes yolunda" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Koç planını aç" })).toHaveAttribute("href", "/plan");
    await expect(page.getByTestId("round-node")).toHaveCount(0);
  });

  test("öğrenci yokken tur davet kartına döner, sağdaki kart çekilir", async ({ page }) => {
    await mockApi(page, COACH, { rows: [] });
    await page.goto("/kocluk");

    const round = page.getByTestId("coach-round");
    await expect(round.getByRole("heading", { name: "İlk öğrencini davet et" })).toBeVisible();
    await expect(round.getByRole("button", { name: "Davet linkini kopyala" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Davet ve koltuklar" })).toHaveCount(0);
  });

  test("Geçmiş sekmesi tıklanmaz ve kimseye yolunda demez", async ({ page }) => {
    const ended = rosterRow("s-old", "Deniz Er", { ended: true });
    await mockApi(page, COACH, { ended: [ended] });
    await page.goto("/kocluk");

    await page.getByRole("tab", { name: "Geçmiş" }).click();
    const row = page.getByTestId("student-row-ended");
    await expect(row).toContainText("Deniz Er");
    await expect(row.getByRole("link")).toHaveCount(0);
    await expect(page.getByTestId("students-card").getByText("Yolunda")).toHaveCount(0);
  });

  test("takipler: değişiklik isteyen öğrenci görünür", async ({ page }) => {
    const followup: MentorshipFollowupDto = {
      id: "f1",
      studentId: ECE.studentId,
      studentDisplayName: ECE.studentDisplayName,
      title: "Matematik programını sadeleştir",
      privateNote: null,
      sharedDecision: "Programı sadeleştirelim.",
      response: "CHANGE_REQUESTED",
      followUpDate: null,
      status: "OPEN",
      version: 1,
      replacesId: null,
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-20T10:00:00.000Z",
      respondedAt: "2026-09-21T10:00:00.000Z",
      closedAt: null,
    };
    await mockApi(page, COACH, { followups: [followup] });
    await page.goto("/kocluk");

    await expect(page.getByRole("heading", { name: "Takiplerin" })).toBeVisible();
    await expect(page.getByText("Matematik programını sadeleştir")).toBeVisible();
    await expect(page.getByText("Değişiklik istedi")).toBeVisible();
  });
});

test.describe("davet ve koltuklar", () => {
  test("davet kodu maskeli duruyor, göstermek bilinçli bir tık", async ({ page }) => {
    await mockApi(page, COACH);
    await page.goto("/kocluk");

    // Prefix visible (it is structure, not the secret), secret hidden one dot per character.
    await expect(page.getByText("MENTOR-KOC-••••••••••••")).toBeVisible();
    await expect(page.getByText("MENTOR-KOC-ABCDEF123456")).toHaveCount(0);

    await page.getByRole("button", { name: "Kodu göster" }).click();
    await expect(page.getByText("MENTOR-KOC-ABCDEF123456")).toBeVisible();

    await page.getByRole("button", { name: "Kodu gizle" }).click();
    await expect(page.getByText("MENTOR-KOC-ABCDEF123456")).toHaveCount(0);
  });

  test("koltuklar sunucunun sayısıyla dolar: kod gizlenir, plan satıştaysa tek çağrı", async ({ page }) => {
    await mockApi(page, COACH, {
      rows: [ZEYNEP, ALI, BURAK],
      overview: { paidSeats: 0, seatAllowance: 3, seatPlansOnSale: true, usedSeats: 2 },
    });
    await page.goto("/kocluk");

    await expect(page.getByText("koltuk dolu", { exact: false })).toContainText("3/3");
    await expect(
      page.getByText("Bağladığın 3 öğrenci ücretsiz koltukta ve Premium'a erişiyor. 4. öğrencin için abonelik gerekir."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Abonelik seçenekleri" })).toHaveAttribute(
      "href",
      "/abonelik",
    );
    await expect(page.getByText("MENTOR-KOC-", { exact: false })).toHaveCount(0);
  });

  test("koltuklar açılmadıysa kart sakin söyler", async ({ page }) => {
    await mockApi(page, COACH, { overview: { sponsorshipEnabled: false, seatAllowance: 0 } });
    await page.goto("/kocluk");
    await expect(page.getByText("Koltuklar henüz açılmadı.", { exact: false })).toBeVisible();
  });

  test("doğrulanmamış e-postada kod oluştur onaylar ve maili gönderir", async ({ page }) => {
    const calls = newCalls();
    await mockApi(
      page,
      { ...COACH, emailVerified: false },
      { emailVerified: false, inviteCode: null, calls },
    );
    await page.goto("/kocluk");

    await expect(page.getByText("e-postanı doğrulayınca", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Henüz bir kodun yok.")).toBeVisible();
    await page.getByRole("button", { name: "Kod oluştur" }).click();

    const prompt = page.getByRole("dialog");
    await expect(prompt.getByText("Önce e-postanı doğrula")).toBeVisible();
    await prompt.getByRole("button", { name: "Doğrulama gönder" }).click();

    await expect(page.getByText("Doğrulama e-postası gönderildi")).toBeVisible();
    expect(calls.verificationEmail).toBe(1);
    expect(calls.rotateInvite).toBe(0);
  });

  test("yeni kod üretmek önce onay ister, vazgeçmek kodu bırakır", async ({ page }) => {
    await mockApi(page, COACH);
    await page.goto("/kocluk");

    await page.getByRole("button", { name: "Yeni kod üret" }).click();
    await expect(page.getByText("Yeni kod üretilsin mi?")).toBeVisible();
    await expect(page.getByText("Yeni kod ürettiğinde eskisi çalışmayı bırakır.")).toBeVisible();

    await page.getByRole("button", { name: "Vazgeç" }).click();
    await expect(page.getByText("Yeni kod üretilsin mi?")).toHaveCount(0);
    // Nothing rotated: the card still holds the code it opened with.
    await expect(page.getByText("MENTOR-KOC-••••••••••••")).toBeVisible();
  });

  test("veri kapsamı Ayarlar'da açılıyor", async ({ page }) => {
    await mockApi(page, COACH);
    await page.goto("/kocluk");
    await expect(page.getByText("Öğrencinde neyi görürsün")).toHaveCount(0);

    await page.goto("/ayarlar");
    await page.getByRole("button", { name: /Öğrencinde neyi görürsün/ }).click();

    const contract = page.getByRole("dialog");
    await expect(contract).toBeVisible();
    await expect(contract.getByText("Öğrencin bağlanırken tam olarak bunu onayladı.")).toBeVisible();
    // The half a coach must not skim (AGENTS §4 #5).
    await expect(contract.getByText("Neyi göremezsin")).toBeVisible();
  });

  test("kapsam satırı öğrenciye görünmüyor", async ({ page }) => {
    // It reads a `@Roles(COACH)` endpoint, so for a student it would be a door onto a 403.
    await mockApi(page, { ...COACH, roles: ["STUDENT"] });
    await page.goto("/ayarlar");
    await expect(page.getByText("Öğrencinde neyi görürsün")).toHaveCount(0);
  });

  test("koç mobil tab barında Öğrencilerim ortada yükseltilmiş, Ayarlar ve Topluluk da var", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium");
    await mockApi(page, COACH);
    await page.goto("/kocluk");

    const tabs = page.getByRole("navigation", { name: "Ana menü" });
    // The student's silhouette: the role's home sits raised in the centre, where a student has Koç.
    const links = tabs.getByRole("link");
    await expect(links).toHaveCount(5);
    for (const [index, name] of ["Plan", "Blog", "Öğrencilerim", "Topluluk", "Ayarlar"].entries()) {
      await expect(links.nth(index), name).toHaveAccessibleName(name);
    }
    await expect(links.nth(2)).toHaveAttribute("data-elevated", "true");
    // And none of the student ritual came with them.
    await expect(tabs.getByRole("link", { name: "Anasayfa" })).toHaveCount(0);
    await expect(tabs.getByRole("link", { name: "Analiz" })).toHaveCount(0);
  });
});

/**
 * Motion (Durak F, DESIGN.md §9.1). What is pinned here is behaviour, not timing: one "Sıradaki"
 * tip that moves, a check drawn only for a mark made on this screen, a count that pops without
 * changing what a reader hears, and nothing animating when the coach asked for less motion.
 */
test.describe("hareket", () => {
  test("İlgilendim: tek Sıradaki etiketi sıradakine geçer, işaretlenen düğüm ✓ çizer", async ({ page }) => {
    await mockApi(page, COACH);
    await page.goto("/kocluk");

    const round = page.getByTestId("coach-round");
    const nodes = round.getByTestId("round-node");
    await expect(round.getByTestId("round-next-tip")).toHaveCount(1);
    await expect(nodes.nth(1).getByTestId("round-next-tip")).toBeVisible();

    await nodes.nth(1).click();
    await page.getByRole("menuitem", { name: "İlgilendim" }).click();

    // The count pops, and a reader still hears one sentence.
    const title = round.getByRole("heading", { name: "2 öğrenci seni bekliyor" });
    await expect(title).toBeVisible();
    await expect(title.locator(".t-digit-group")).toHaveCount(1);
    // Still one tip, now on Ali's node.
    await expect(round.getByTestId("round-next-tip")).toHaveCount(1);
    await expect(nodes.nth(2).getByTestId("round-next-tip")).toBeVisible();
    // Zeynep was marked here, so her check draws; Mert's came with the page and stays still.
    await expect(nodes.nth(1).locator(".t-success-check")).toHaveCount(1);
    await expect(nodes.nth(0).locator(".t-success-check")).toHaveCount(0);
  });

  test("azaltılmış harekette tur ve liste hemen görünür, hiçbir çizim oynamaz", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockApi(page, COACH);
    await page.goto("/kocluk");

    await expect(page.getByTestId("coach-round")).toBeVisible();
    await expect(page.getByTestId("student-row").first()).toBeVisible();
    const running = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation instanceof CSSAnimation && animation.animationName.startsWith("coach-"))
          .length,
    );
    expect(running).toBe(0);
  });

  test("davet linkini kopyalayınca düğme bir an Kopyalandı der", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await mockApi(page, COACH);
    await page.goto("/kocluk");

    const seats = page.getByRole("region", { name: "Davet ve koltuklar" });
    await seats.getByRole("button", { name: "Davet linkini kopyala" }).click();
    await expect(seats.getByRole("button", { name: "Kopyalandı" })).toBeVisible();
    // 1.5 s later it is the copy button again.
    await expect(seats.getByRole("button", { name: "Davet linkini kopyala" })).toBeVisible({ timeout: 5_000 });
  });
});