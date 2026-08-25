import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser, StudyRoomDetailDto } from "@mentor/types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const ROOM_ID = "33333333-3333-4333-8333-333333333333";

const user: AuthUser = {
  id: USER_ID,
  email: "masa@test.local",
  displayName: "Masa Sahibi",
  username: "masa_sahibi",
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

const room: StudyRoomDetailDto = {
  id: ROOM_ID,
  name: "Sabah Kuşları",
  theme: "LIBRARY",
  capacity: 4,
  memberCount: 2,
  activeCount: 1,
  role: "OWNER",
  isActive: true,
  inviteCode: "MASA-A1B2C3",
  seats: [
    {
      userId: USER_ID,
      displayName: "Masa Sahibi",
      username: "masa_sahibi",
      avatarUrl: null,
      role: "OWNER",
      isSeated: true,
      seatedMinutes: 18,
      subject: "Matematik",
    },
    {
      userId: MEMBER_ID,
      displayName: "Yol Arkadaşı",
      username: "yol_arkadasi",
      avatarUrl: null,
      role: "MEMBER",
      isSeated: false,
      seatedMinutes: null,
      subject: null,
    },
  ],
};

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

async function mockApi(page: Page) {
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return json(route, null, 204);
    if (request.method() === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (request.method() === "GET" && path === "/v1/users/me") return json(route, user);
    if (request.method() === "GET" && path === `/v1/study-rooms/${ROOM_ID}`) {
      return json(route, room);
    }
    if (request.method() === "GET" && path === "/v1/notifications") {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    return json(route, null, 204);
  });
}

test("çalışma masası iki viewportta koltukları ve timer devrini gösterir", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockApi(page);
  await page.goto(`/seans/masa/${ROOM_ID}`);

  await expect(page.getByRole("heading", { name: "Sabah Kuşları" })).toBeVisible();
  await expect(page.getByText("Çalışan sayısı: 1")).toBeVisible();
  await expect(page.getByText("MASA-A1B2C3")).toBeVisible();
  await expect(page.getByTitle("Masa Sahibi")).toBeVisible();
  await expect(page.getByTitle("Yol Arkadaşı")).toBeVisible();

  const start = page.getByRole("link", { name: "Bu masada çalışmaya başla" });
  await expect(start).toHaveAttribute("href", `/seans?room=${ROOM_ID}`);
  expect((await start.boundingBox())?.height).toBeGreaterThanOrEqual(44);
});
