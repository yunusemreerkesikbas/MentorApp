import { expect, test } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

/**
 * The coach's home (APP-090).
 *
 * APP-089 landed a new coach on `/kocluk` once, from onboarding. Login still sent everyone to
 * `/dashboard`, so from the second visit a coach opened a screen built for somebody else. These
 * tests hold the three halves of the fix: they land in their own world, the student ritual is shut
 * to them, and the account screens they genuinely need stay open.
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

const ROSTER_ROW = {
  linkId: "link-1",
  studentId: "33333333-3333-4333-8333-333333333333",
  studentDisplayName: "Ayşe Yılmaz",
  studentUsername: "ayse",
  status: "ACTIVE",
  acceptedAt: "2026-09-01T10:00:00.000Z",
  endedAt: null,
  metrics: {
    lastActiveDate: "2026-09-01",
    currentStreak: 0,
    focusMinutes7d: 0,
    sessions7d: 0,
    activeDays7d: 0,
    planCompletionRate7d: null,
    latestMockNet: null,
    latestMockAt: null,
    moodLevel7dAvg: null,
  },
  riskFlags: ["INACTIVE"],
  attendedAt: null,
  needsAttention: true,
};

async function mockApi(page: import("@playwright/test").Page, user: AuthUser) {
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      "access-control-allow-origin": request.headers().origin ?? "http://localhost:3100",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type, authorization, accept-language",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    };
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.method() === "POST" && path === "/v1/auth/refresh") {
      return json({ accessToken: "test-token", expiresIn: 3600, user });
    }
    if (path === "/v1/mentorship/students") {
      return json({ items: [ROSTER_ROW], total: 1, page: 1, pageSize: 100 });
    }
    if (path === "/v1/mentorship/overview") {
      return json({
        inviteCode: { code: "MENTOR-KOC-ABCDEF123456", expiresAt: "2026-12-01T00:00:00.000Z" },
        activeStudents: 1,
        maxActiveStudents: 20,
        freeSeats: 3,
        paidSeats: 0,
        usedSeats: 0,
        sponsorshipEnabled: false,
        dataScope: ["FOCUS_MINUTES"],
      });
    }
    if (path === "/v1/mentorship/coach-registration/mine") {
      return json({
        registrationOpen: true,
        emailVerified: true,
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
    // No cohort brief has ever been written — the case the rule-based floor exists for.
    if (path === "/v1/mentorship/brief") return route.fulfill({ status: 204, headers });
    if (path.startsWith("/v1/content/exams/by-type/")) {
      return json({
        exam: { id: "e1", slug: "kpss-lisans-2026", name: "KPSS Lisans 2026" },
        events: [],
        examDateLabel: "30 Aralık 2026",
        daysRemaining: 113,
        nextEvent: null,
        daysUntilNextEvent: null,
      });
    }
    if (path === "/v1/forum/zones") return json({ items: [{ id: "z1", slug: "kpss" }], total: 1 });
    // The drawer is part of the coach chrome now, so its three calls run on every page here.
    if (path === "/v1/notifications") return json({ items: [], unreadCount: 0, total: 0 });
    if (path.startsWith("/v1/achievements") || path.startsWith("/v1/journey")) {
      return json({ celebrations: [] });
    }
    return route.fulfill({ status: 204, headers });
  });
}

test.describe("koçun kendi dünyası", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, COACH);
  });

  test("öğrenci paneline giden koç kendi paneline yönlendirilir", async ({ page }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/kocluk$/, { timeout: 10_000 });
    // And the screen this ticket exists to stop them seeing never renders, not even for a frame.
    await expect(page.getByText("Bugünkü ritüel")).toHaveCount(0);
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
    // Blocking these would be a bug, not a feature: Koç Pro is bought on /abonelik, and a coach
    // locked out of /ayarlar cannot change their password or delete their account.
    for (const path of ["/ayarlar", "/topluluk"]) {
      await page.goto(path);
      await expect(page, path).not.toHaveURL(/\/kocluk$/);
    }
  });

  test("ana ekran koçun günü: brifing, sayaç, topluluk", async ({ page }) => {
    await page.goto("/kocluk");

    // The brief card leads the page, and its unwritten state stays one line. APP-090 tried a
    // rule-based stand-in here and cut it: every line it could produce is already on the roster
    // card below, so each sentence appeared twice on one screen.
    await expect(page.getByText("1 öğrenciden 1 tanesi ilgi bekliyor.")).toHaveCount(1);
    await expect(page.getByText("Ona bir not bırak, nerede kaldığını sor.")).toHaveCount(1);

    // The right rail: the exam the coach coaches, and the forum that is their showcase.
    await expect(page.getByText("Sınava kalan")).toBeVisible();
    await expect(page.getByText("113")).toBeVisible();
    await expect(page.getByText("KPSS Lisans 2026", { exact: false })).toBeVisible();

    // And none of the student ritual came along.
    await expect(page.getByText("Bugünkü ritim")).toHaveCount(0);
    await expect(page.getByText("Ruh hali")).toHaveCount(0);
  });

  test("koç kabuğu panelle aynı masaüstü sidebarını kullanır", async (
    { page },
    testInfo,
  ) => {
    test.skip(testInfo.project.name !== "desktop-chromium");
    await page.goto("/kocluk");

    await expect(page.getByTestId("app-sidebar")).toBeVisible();
    await expect(page.getByRole("link", { name: "Öğrencilerim" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bildirimler", exact: false })).toBeVisible();
    await expect(
      page.locator("header").getByText("Mentor", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Panele dön" })).toHaveCount(0);
  });

  test("koç kabuğu mobilde panel üst ve alt navigasyonunu kullanır", async (
    { page },
    testInfo,
  ) => {
    test.skip(testInfo.project.name !== "mobile-chromium");
    await page.goto("/kocluk");

    await expect(page.locator("header")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Ana menü" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Öğrencilerim" })).toBeVisible();
  });

  test("ortak sidebar koç profil alt rotasında da korunur", async (
    { page },
    testInfo,
  ) => {
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
