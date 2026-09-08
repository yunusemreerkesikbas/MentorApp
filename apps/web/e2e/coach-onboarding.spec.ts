import { expect, test } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

/**
 * The coach's way in (APP-089).
 *
 * The thing under test is the branch, not the API: before this, the only road to the coach
 * application ran through the student wizard, so a coach had to pick a target exam and write a
 * personal goal sentence before they were allowed to say they were a coach. The assertions below
 * are the two halves of the fix — the wizard asks a coach coach questions, and it lets go on the
 * coach's own panel rather than a study dashboard.
 */

const COACH: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "koc@test.local",
  displayName: "Mert",
  username: null,
  avatarUrl: null,
  bio: null,
  website: null,
  // Signup with `intent: "COACH"` granted this. It authorizes nothing on its own — the invite code
  // needs a verified email and a registry row — but it is what shapes every screen below.
  roles: ["STUDENT", "COACH"],
  organizationId: null,
  examType: null,
  examVariant: null,
  examDate: null,
  dailyFocusGoalMinutes: null,
  emailVerified: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

/** Mutated as the wizard PATCHes, so `hasCompletedOnboarding` flips exactly when the app says it does. */
let user: AuthUser;
let registered: Record<string, unknown> | null;

test.beforeEach(async ({ page }) => {
  user = { ...COACH };
  registered = null;

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
    if (request.method() === "PATCH" && path === "/v1/users/me") {
      user = { ...user, ...(request.postDataJSON() as Partial<AuthUser>) };
      return json(user);
    }
    if (request.method() === "POST" && path === "/v1/mentorship/coach-registration") {
      const body = request.postDataJSON() as Record<string, unknown>;
      registered = { id: "reg-1", status: "ACTIVE", verifiedClaims: [], ...body };
      return json(registered, 201);
    }
    if (request.method() === "GET" && path === "/v1/mentorship/coach-registration/mine") {
      return json({ registrationOpen: true, registration: registered, emailVerified: false });
    }
    if (request.method() === "GET" && path === "/v1/mentorship/overview") {
      // The code is withheld, not absent: this coach has not verified their email yet.
      return json({
        inviteCode: null,
        activeStudents: 0,
        maxActiveStudents: 20,
        freeSeats: 3,
        paidSeats: 0,
        usedSeats: 0,
        sponsorshipEnabled: false,
        dataScope: [],
      });
    }
    if (request.method() === "GET" && path === "/v1/mentorship/students") {
      return json({ items: [], total: 0, page: 1, pageSize: 100 });
    }
    return route.fulfill({ status: 204, headers });
  });
});

test("koç dalı öğrenci sorularını sormuyor, koç sorularını soruyor", async ({ page }) => {
  await page.goto("/onboarding");

  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel("Kullanıcı adı").fill("kocmert");
  await page.getByRole("button", { name: "Devam" }).click();

  // Avatar is optional for a coach exactly as it is for a student.
  await page.getByRole("button", { name: "Şimdilik geç" }).click();

  // The exam question SURVIVES on this branch, reworded. It is genuinely the coach's (which exam do
  // they coach), and `hasCompletedOnboarding` gates all of `(app)` on `username && examType` — a
  // coach who skipped it could never reach their own profile screen.
  await expect(
    page.getByRole("heading", { name: "Hangi sınava koçluk yapıyorsun?" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "YKS" }).click();
  await page.getByRole("button", { name: "Devam" }).click();

  // And here is the swap: a student would be asked "Bu yolun sonunda ne var?" and would write a
  // personal goal into a vision board. A coach is asked how to introduce them to a student.
  await expect(page.getByText("Bu yolun sonunda ne var?")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Öğrenciye kendini nasıl anlatalım?" }),
  ).toBeVisible();
});

test("koç profilini yazınca hesabı açılıyor ve kendi paneline iniyor", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel("Kullanıcı adı").fill("kocmert");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("button", { name: "Şimdilik geç" }).click();
  await page.getByRole("radio", { name: "YKS" }).click();
  await page.getByRole("button", { name: "Devam" }).click();

  await page.getByLabel("Tek cümlede sen").fill("YKS matematik koçu");
  await page.getByLabel("Kendini anlat").fill("Sekiz yıldır YKS adaylarıyla çalışıyorum.");
  await page.getByRole("button", { name: "Koç hesabımı aç" }).click();

  // The call that actually makes them a coach — the API writes the registry row and grants COACH
  // off the back of it, which is why this step is not skippable the way the goal step is.
  await expect.poll(() => registered).not.toBeNull();
  expect((registered as { headline: string }).headline).toBe("YKS matematik koçu");

  // The blocker they can still clear themselves, said before they find a locked panel.
  await expect(page.getByText("e-postanı doğrulaman yeterli", { exact: false })).toBeVisible();

  // `/kocluk`, not `/panel`: somebody who just wrote a coach profile does not want a study plan.
  //
  // This assertion also guards the cloud-transition fix APP-089 had to make. The overlay's mount
  // animation is what dispatches "covered" and calls `navigate()`, and with `initial={false}` it
  // never fired — so onboarding ended on the completion screen, for students too. Nothing in a unit
  // test can see that; this line is the regression guard.
  await expect(page).toHaveURL(/\/kocluk$/, { timeout: 10_000 });
});

test("doğrulanmamış e-posta davet kodu yerine sebebini gösteriyor", async ({ page }) => {
  registered = { id: "reg-1", status: "ACTIVE", headline: "YKS koçu", bio: "…", verifiedClaims: [] };
  user = { ...COACH, username: "kocmert", examType: "YKS" };

  await page.goto("/kocluk");

  // No "create a code" button, because pressing it would 403. The reason is shown instead.
  await expect(page.getByRole("button", { name: "Kod oluştur" })).toHaveCount(0);
  await expect(page.getByText("e-postanı doğrulayınca", { exact: false })).toBeVisible();
});
