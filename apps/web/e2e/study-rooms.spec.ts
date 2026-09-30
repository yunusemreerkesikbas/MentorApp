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

type Call = { method: string; path: string };

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

async function mockApi(page: Page, detail: StudyRoomDetailDto = room, opts: { delayMs?: number } = {}) {
  const calls: Call[] = [];
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === "OPTIONS") return json(route, null, 204);
    if (method !== "GET") calls.push({ method, path });
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path === `/v1/study-rooms/${ROOM_ID}`) {
      if (opts.delayMs) await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
      return json(route, detail);
    }
    if (method === "GET" && path.startsWith("/v1/study-rooms/")) {
      return json(route, { code: "COACHING_ROOM_NOT_FOUND", message: "Masa bulunamadı." }, 404);
    }
    if (method === "POST" && path === `/v1/study-rooms/${ROOM_ID}/code`) {
      return json(route, { ...detail, inviteCode: "MASA-Z9Y8X7" });
    }
    if (method === "GET" && path === "/v1/notifications") {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    return json(route, null, 204);
  });
  return calls;
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("çalışma masası iki viewportta koltukları ve timer devrini gösterir", async ({ page }) => {
  await mockApi(page);
  await page.goto(`/seans/masa/${ROOM_ID}`);

  await expect(page.getByRole("heading", { name: "Sabah Kuşları" })).toBeVisible();
  // The desk stopped counting out loud when it became a themed table with seats arranged around
  // it (2026-08-25, "Çalışma masası — Dilim 2"). The seats ARE the occupancy, so "Çalışan sayısı: 1"
  // was a caption for a picture that already said it. Identities moved from avatar `title`
  // attributes onto the seats themselves, and the invite code moved behind "Masa menüsü" instead
  // of lying on the table.
  const seats = page.getByRole("main").getByRole("listitem");
  await expect(seats).toHaveCount(4);
  await expect(seats.nth(0)).toContainText("Matematik");
  await expect(seats.nth(1)).toContainText("Şu an masada değil");
  await expect(page.getByRole("button", { name: "Davet et" })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Masa menüsü" })).toBeVisible();

  const start = page.getByRole("link", { name: "Bu masada çalışmaya başla" });
  await expect(start).toHaveAttribute("href", `/seans?room=${ROOM_ID}`);
  expect((await start.boundingBox())?.height).toBeGreaterThanOrEqual(44);
});

test("davet kodu penceresi sahnenin dışında açılır ve kod okunur", async ({ page }) => {
  await mockApi(page);
  await page.goto(`/seans/masa/${ROOM_ID}`);

  await page.getByRole("button", { name: "Masa menüsü" }).click();
  await page.getByRole("menuitem", { name: "Davet kodu" }).click();

  const dialog = page.getByRole("dialog", { name: "Davet kodu" });
  await expect(dialog).toBeVisible();
  // Inside `.room-stage` the dialog read `--color-main` as the room's cream ink on a white
  // sheet, and the code was all but invisible. Outside the stage it takes the app's own ink.
  await expect(page.locator(".room-stage dialog")).toHaveCount(0);
  await expect(dialog.getByText("MASA-A1B2C3")).toHaveCSS("color", "rgb(17, 17, 17)");
  await expect(dialog.getByRole("button", { name: "Davet bağlantısını kopyala" })).toBeVisible();
});

test("kodu yenilemek pencerenin içinde sorar, sonra yeni kodu gösterir", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto(`/seans/masa/${ROOM_ID}`);

  await page.getByRole("button", { name: "Masa menüsü" }).click();
  await page.getByRole("menuitem", { name: "Davet kodu" }).click();
  const invite = page.getByRole("dialog", { name: "Davet kodu" });
  await invite.getByRole("button", { name: "Kodu yenile" }).click();

  // Asked in place: a kit confirm opened over the native dialog would sit inert behind it.
  const ask = invite.getByRole("group", { name: "Kodu yenileyelim mi?" });
  await expect(ask).toBeVisible();
  await expect(ask.getByText("Kodu yenileyelim mi?")).toBeFocused();
  expect(calls.some((c) => c.path.endsWith("/code"))).toBe(false);
  await ask.getByRole("button", { name: "Yenile" }).click();

  await expect
    .poll(() => calls.some((c) => c.method === "POST" && c.path === `/v1/study-rooms/${ROOM_ID}/code`))
    .toBe(true);
  await expect(invite.getByText("MASA-Z9Y8X7")).toBeVisible();
  await expect(invite.getByRole("status")).toHaveText("Yeni kod hazır; eski kod artık çalışmıyor.");
});

test("masayı kapatmak kırmızı onay ister, onaylanınca seansa döner", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto(`/seans/masa/${ROOM_ID}`);

  await page.getByRole("button", { name: "Masa menüsü" }).click();
  await page.getByRole("menuitem", { name: "Masayı kapat" }).click();

  const confirm = page.getByRole("dialog", { name: "Masayı kapatalım mı?" });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Vazgeç" })).toBeFocused();
  await expect(confirm.getByRole("button", { name: "Kapat" })).toHaveCSS(
    "background-color",
    "rgb(180, 35, 24)",
  );
  await confirm.getByRole("button", { name: "Kapat" }).click();

  await expect.poll(() => calls.some((c) => c.method === "DELETE" && c.path === `/v1/study-rooms/${ROOM_ID}`)).toBe(true);
  await expect(page).toHaveURL(/\/seans$/);
});

test("üye masadan ayrılırken kırmızı onay görür", async ({ page }) => {
  const calls = await mockApi(page, { ...room, role: "MEMBER", inviteCode: null });
  await page.goto(`/seans/masa/${ROOM_ID}`);

  await page.getByRole("button", { name: "Masa menüsü" }).click();
  await expect(page.getByRole("menuitem", { name: "Davet kodu" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Masadan ayrıl" }).click();

  const confirm = page.getByRole("dialog", { name: "Masadan ayrılalım mı?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Vazgeç" }).click();
  await expect(confirm).toBeHidden();
  expect(calls.some((c) => c.method === "DELETE")).toBe(false);
});

test("masa yüklenirken sahnenin iskeleti durur, sonra koltuklar gelir", async ({ page }) => {
  await mockApi(page, room, { delayMs: 1200 });
  await page.goto(`/seans/masa/${ROOM_ID}`);

  await expect(page.getByRole("status", { name: "Masa hazırlanıyor" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sabah Kuşları" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Masa hazırlanıyor" })).toHaveCount(0);
});

test("bulunamayan masa sakin bir kartla seansa geri çağırır", async ({ page }) => {
  await mockApi(page);
  await page.goto("/seans/masa/99999999-9999-4999-8999-999999999999");

  const card = page.getByRole("region", { name: "Bu masa bulunamadı" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Masa kapatılmış ya da davet bağlantısı değişmiş olabilir.");
  await expect(card.getByRole("link", { name: "Seansa dön" })).toHaveAttribute("href", "/seans");
});

test("davetle gelince masa açılır ve adres temizlenir", async ({ page }) => {
  await mockApi(page);
  await page.goto(`/seans/masa/${ROOM_ID}?hosgeldin=1`);

  await expect(page.getByRole("heading", { name: "Sabah Kuşları" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/seans/masa/${ROOM_ID}$`));
});

test("oturan koltuğun etiketi dersi ve süreyi odanın mürekkebiyle yazar", async ({ page }) => {
  await mockApi(page);
  await page.goto(`/seans/masa/${ROOM_ID}`);

  const line = page.getByRole("main").getByRole("listitem").nth(0).getByText("Matematik · 18 dk");
  await expect(line).toBeVisible();
  // It used to be `--room-accent` green on the dark wood; the ink carries it now, a dot the life.
  await expect(line).toHaveCSS("color", "rgb(247, 240, 228)");
});

test("masaya biri oturunca avatarı bir kez parlar, zaten oturan parlamaz", async ({ page }) => {
  await page.clock.install();
  await mockApi(page);
  let reads = 0;
  // After the first read the member sits down: the next presence poll brings them in.
  await page.route(`http://localhost:3001/v1/study-rooms/${ROOM_ID}`, (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    reads += 1;
    const seated = reads > 1;
    return json(route, {
      ...room,
      seats: room.seats.map((s) =>
        s.userId === MEMBER_ID
          ? { ...s, isSeated: seated, seatedMinutes: seated ? 1 : null, subject: seated ? "Tarih" : null }
          : s,
      ),
    });
  });
  await page.goto(`/seans/masa/${ROOM_ID}`);

  const owner = page.locator("li").filter({ hasText: "Masa S." });
  const member = page.locator("li").filter({ hasText: "Yol A." });
  await expect(owner.locator(".room-seat-live")).toHaveCount(1);
  await expect(member.locator(".room-seat-live")).toHaveCount(0);

  await page.clock.fastForward(31_000);
  await expect(member.locator(".room-seat-live.room-seat-arrive")).toHaveCount(1);
  await expect(owner.locator(".room-seat-arrive")).toHaveCount(0);
});
