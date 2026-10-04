import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ROOM_ID = "33333333-3333-4333-8333-333333333333";

const user: AuthUser = {
  id: USER_ID,
  email: "davet@test.local",
  displayName: "Davetli Öğrenci",
  username: "davetli",
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

const room = {
  id: ROOM_ID,
  name: "Sabah Kuşları",
  theme: "LIBRARY",
  capacity: 4,
  memberCount: 2,
  activeCount: 0,
  role: "MEMBER",
  isActive: true,
  inviteCode: null,
  seats: [
    {
      userId: USER_ID,
      displayName: "Davetli Öğrenci",
      username: "davetli",
      avatarUrl: null,
      role: "MEMBER",
      isSeated: false,
      seatedMinutes: null,
      subject: null,
    },
  ],
};

type Join = { status: number; code?: string };

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: {
      "access-control-allow-origin": "http://localhost:3100",
      "access-control-allow-credentials": "true",
    },
    contentType: "application/json",
    body: body == null ? "" : JSON.stringify(body),
  });
}

/** `joins` answers the join attempts in order; the last one repeats. */
async function mockApi(page: Page, joins: Join[] = [{ status: 200 }]) {
  let attempt = 0;
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
    if (method === "POST" && path === "/v1/study-rooms/join") {
      const answer = joins[Math.min(attempt, joins.length - 1)]!;
      attempt += 1;
      return answer.status === 200
        ? json(route, room)
        : json(route, { code: answer.code ?? "INTERNAL", message: "x" }, answer.status);
    }
    if (method === "GET" && path === `/v1/study-rooms/${ROOM_ID}`) return json(route, room);
    if (method === "GET" && path === "/v1/study-rooms") return json(route, []);
    if (method === "GET" && path === "/v1/coaching/today") {
      return json(route, { focusGoal: { goalMinutes: null, focusMinutesToday: 0 }, focusingNow: null });
    }
    if (method === "GET" && path === "/v1/buddy") {
      return json(route, { active: null, outgoing: null, incoming: [] });
    }
    if (method === "GET" && path === "/v1/buddy/suggestions") return json(route, []);
    if (method === "GET" && path === "/v1/study-sessions") {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20 });
    }
    if (method === "GET" && path === "/v1/notifications") {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    return json(route, null, 204);
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("davet bağlantısı masaya götürür ve karşılama adresi temizlenir", async ({ page }) => {
  await mockApi(page);
  await page.goto("/masaya-katil?kod=masa-a1b2c3");

  await expect(page.getByRole("heading", { name: "Sabah Kuşları" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/seans/masa/${ROOM_ID}$`));
});

test("geçersiz kod nedenini söyler ve kodu elle girmeye götürür", async ({ page }) => {
  await mockApi(page, [{ status: 404, code: "COACHING_ROOM_CODE_INVALID" }]);
  await page.goto("/masaya-katil?kod=MASA-X7Q2P9");

  const card = page.getByRole("region", { name: "Bu davet kodu artık geçerli değil" });
  await expect(card).toContainText("Masayı kuran kişiden yeni bir bağlantı iste.");
  await expect(card.getByRole("link", { name: "Seansa dön" })).toHaveAttribute("href", "/seans");

  await card.getByRole("link", { name: "Kodu elle gir" }).click();
  await expect(page.getByRole("dialog", { name: "Kod ile katıl" })).toBeVisible();
  // The one-shot flag is spent: a reload must not open the sheet again.
  await expect(page).toHaveURL(/\/seans$/);
});

test("kodsuz bağlantı ne olduğunu söyler", async ({ page }) => {
  await mockApi(page);
  await page.goto("/masaya-katil");

  const card = page.getByRole("region", { name: "Bu bağlantıda kod yok" });
  await expect(card).toContainText("Kodu biliyorsan elle girebilirsin.");
  await expect(card.getByRole("link", { name: "Kodu elle gir" })).toHaveAttribute("href", "/seans?katil=1");
});

test("zaten üye olan masalarına yönlendirilir", async ({ page }) => {
  await mockApi(page, [{ status: 409, code: "COACHING_ROOM_ALREADY_MEMBER" }]);
  await page.goto("/masaya-katil?kod=MASA-A1B2C3");

  const card = page.getByRole("region", { name: "Zaten bu masadasın" });
  await expect(card.getByRole("link", { name: "Masalarına git" })).toHaveAttribute("href", "/seans");
});

test("bağlantı koparsa yeniden denemek masaya götürür", async ({ page }) => {
  await mockApi(page, [{ status: 500 }, { status: 200 }]);
  await page.goto("/masaya-katil?kod=MASA-A1B2C3");

  const card = page.getByRole("region", { name: "Masaya katılamadık" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Yeniden dene" }).click();
  await expect(page.getByRole("heading", { name: "Sabah Kuşları" })).toBeVisible();
});
