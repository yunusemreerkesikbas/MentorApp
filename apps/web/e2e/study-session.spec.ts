import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PARTNER_ID = "22222222-2222-4222-8222-222222222222";
const ROOM_ID = "33333333-3333-4333-8333-333333333333";

const user: AuthUser = {
  id: USER_ID,
  email: "seans@test.local",
  displayName: "Ada Yılmaz",
  username: "ada",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "KPSS",
  examVariant: null,
  examDate: "2026-07-26",
  dailyFocusGoalMinutes: 120,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const presets = [
  { id: "25_5", label: "25 / 5 dk", focusMinutes: 25, breakMinutes: 5 },
  { id: "50_10", label: "50 / 10 dk", focusMinutes: 50, breakMinutes: 10 },
];

const rooms = [
  {
    id: ROOM_ID,
    name: "Sabah Kuşları",
    theme: "LIBRARY",
    capacity: 4,
    memberCount: 2,
    activeCount: 1,
    role: "OWNER",
    isActive: true,
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    name: "Hafta Sonu Tarih ve Coğrafya Tekrarı",
    theme: "HOME",
    capacity: 3,
    memberCount: 2,
    activeCount: 0,
    role: "MEMBER",
    isActive: false,
  },
];

function sessionAt(id: string, minutesAgo: number, minutes: number, subject: string, status = "COMPLETED") {
  const startedAt = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  return {
    id,
    preset: "25_5",
    status,
    subject,
    planTaskId: null,
    roomId: null,
    planTaskTitle: null,
    startedAt,
    endedAt: startedAt,
    actualFocusSeconds: minutes * 60,
    plannedFocusMinutes: null,
    sessionMood: null,
    struggleNote: null,
    aiReflection: null,
  };
}

const todaySessions = [
  sessionAt("s-3", 20, 4, "Matematik", "ABANDONED"),
  sessionAt("s-2", 60, 20, "Türkçe"),
  sessionAt("s-1", 120, 25, "Matematik"),
];

const activeBuddy = {
  active: {
    pairId: "pair-1",
    partner: { userId: PARTNER_ID, displayName: "Elif Yılmaz", username: "elify", avatarUrl: null },
    focusMinutesToday: 70,
    currentStreak: 5,
    partnerStudyingNow: true,
    canNudge: true,
  },
  outgoing: null,
  incoming: [],
};

type Call = { method: string; path: string; body: unknown };

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

async function mockApi(page: Page, opts: { joinError?: string; sessions?: unknown[] } = {}) {
  const calls: Call[] = [];
  /** Set once the session started here is finalized: the day's list then includes it. */
  let finished = false;
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === "OPTIONS") return json(route, null, 204);
    if (method !== "GET") calls.push({ method, path, body: request.postDataJSON() });
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path === "/v1/coaching/today") {
      return json(route, {
        sessionPresets: presets,
        focusGoal: { goalMinutes: 120, focusMinutesToday: 45 },
        focusingNow: 38,
      });
    }
    if (method === "GET" && path === "/v1/study-rooms") return json(route, rooms);
    if (method === "POST" && path === "/v1/study-rooms") {
      return json(route, { ...rooms[0], id: "44444444-4444-4444-8444-444444444444", inviteCode: "MASA-N3W4R0", seats: [] }, 201);
    }
    if (method === "POST" && path === "/v1/study-rooms/join") {
      return opts.joinError
        ? json(route, { code: opts.joinError, message: "Kod geçersiz." }, 404)
        : json(route, { ...rooms[0], inviteCode: null, seats: [] });
    }
    if (method === "GET" && path === "/v1/buddy") return json(route, activeBuddy);
    if (method === "DELETE" && path === "/v1/buddy") return json(route, null, 204);
    if (method === "POST" && path === "/v1/study-sessions") {
      return json(route, { ...sessionAt("s-new", 0, 0, "Matematik", "ACTIVE"), countsAsFocusSession: true }, 201);
    }
    if (method === "PATCH" && path === "/v1/study-sessions/s-new") {
      finished = true;
      return json(route, { ...sessionAt("s-new", 0, 25, "Matematik"), countsAsFocusSession: true });
    }
    if (method === "GET" && path === "/v1/study-sessions") {
      const items =
        opts.sessions ?? (finished ? [sessionAt("s-new", 0, 25, "Matematik"), ...todaySessions] : todaySessions);
      return json(route, { items, total: items.length, page: 1, pageSize: 20 });
    }
    if (method === "GET" && path === "/v1/notifications") {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    return json(route, null, 204);
  });
  return calls;
}

/** True when the element's own centre is what the user would hit — nothing painted over it. */
async function isReachable(target: Locator) {
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight || r.top < 0) return false;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit === el || el.contains(hit);
  });
}

/** The stage's lights, read off live styles (reduced motion: every change lands at once). */
async function stageLights(page: Page) {
  return page.getByTestId("session-stage").evaluate((stage) => {
    const opacity = (selector: string) => Number(getComputedStyle(stage.querySelector(selector)!).opacity);
    return {
      phase: stage.getAttribute("data-phase"),
      zIndex: getComputedStyle(stage).zIndex,
      cover: opacity("[data-stage-cover]"),
      veil: opacity("[data-room-veil]"),
      warmth: opacity("[data-stage-warmth]"),
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("masa kurma penceresi sahnenin dışında açılır ve butonu hiçbir şeyin altında kalmaz", async ({
  page,
}) => {
  const calls = await mockApi(page);
  await page.goto("/seans");

  await page.getByRole("button", { name: "Masa kur" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Yeni masa" });
  await expect(dialog).toBeVisible();
  // Rendered inside `.room-stage` the sheet inherited the room's cream ink and, on a phone,
  // got trapped in its card under the tab bar. It must live outside the stage now.
  await expect(page.locator(".room-stage dialog")).toHaveCount(0);
  // The page behind is dimmed by the kit scrim (a template hole glued to the class once hid
  // `backdrop:bg-…` from Tailwind's scanner, and every native modal opened on a bright page).
  expect(await dialog.evaluate((el) => getComputedStyle(el, "::backdrop").backgroundColor)).toBe(
    "rgba(17, 17, 17, 0.4)",
  );

  await dialog.getByLabel("Masa adı").fill("Öğle Molası");
  const submit = dialog.getByRole("button", { name: "Masayı kur" });
  expect(await isReachable(submit)).toBe(true);
  await submit.click();

  await expect(dialog).toBeHidden();
  const created = calls.find((c) => c.method === "POST" && c.path === "/v1/study-rooms");
  expect(created?.body).toMatchObject({ name: "Öğle Molası", theme: "LIBRARY", capacity: 4 });
});

test("kod ile katılma hatası toast değil, alanın altında söylenir", async ({ page }) => {
  await mockApi(page, { joinError: "COACHING_ROOM_CODE_INVALID" });
  await page.goto("/seans");

  await page.getByRole("button", { name: "Kod ile katıl" }).click();
  const dialog = page.getByRole("dialog", { name: "Kod ile katıl" });
  await expect(dialog).toBeVisible();
  const field = dialog.getByLabel("Davet kodu");
  await field.fill("masa-x7q2p9");
  await dialog.getByRole("button", { name: "Katıl" }).click();

  await expect(dialog.getByRole("alert")).toHaveText(
    "Bu davet kodu artık geçerli değil. Masayı kuran kişiden yeni bir bağlantı iste.",
  );
  await expect(field).toHaveAttribute("aria-invalid", "true");
  expect(await isReachable(dialog.getByRole("button", { name: "Katıl" }))).toBe(true);
});

test("yol arkadaşlığını bitirmek kırmızı bir onay ister", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/seans");

  await page.getByRole("button", { name: "Yol arkadaşlığını bitir" }).click();
  const confirm = page.getByRole("dialog", { name: "Yol arkadaşlığını bitirelim mi?" });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("Elif Yılmaz artık bugünkü emeğini görmez, sen de onunkini.");
  await expect(confirm.getByRole("button", { name: "Vazgeç" })).toBeFocused();
  await expect(confirm.getByRole("button", { name: "Bitir" })).toHaveCSS(
    "background-color",
    "rgb(180, 35, 24)",
  );
  expect(calls.some((c) => c.method === "DELETE" && c.path === "/v1/buddy")).toBe(false);

  await confirm.getByRole("button", { name: "Bitir" }).click();
  await expect.poll(() => calls.some((c) => c.method === "DELETE" && c.path === "/v1/buddy")).toBe(true);
});

test("iki bölge: geniş ekranda ray sayacın sağında, 1024'te altında iki sütun", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "genişlik testi masaüstü projesinde");
  await mockApi(page);
  await page.goto("/seans");

  const start = page.getByRole("button", { name: "Başla" });
  const today = page.getByRole("heading", { name: "Bugün", level: 2 });
  const rooms = page.getByRole("heading", { name: "Masaların", level: 2 });
  await expect(today).toBeVisible();
  // The left history rail is gone: history lives in the drawer now.
  await expect(page.getByTestId("session-history-rail")).toHaveCount(0);

  const startBox = (await start.boundingBox())!;
  const todayBox = (await today.boundingBox())!;
  expect(todayBox.x).toBeGreaterThan(startBox.x + startBox.width);

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect
    .poll(async () => (await today.boundingBox())!.y)
    .toBeGreaterThan((await start.boundingBox())!.y + 40);
  const narrowToday = (await today.boundingBox())!;
  const narrowRooms = (await rooms.boundingBox())!;
  expect(Math.abs(narrowRooms.y - narrowToday.y)).toBeLessThan(4);
  expect(narrowRooms.x).toBeGreaterThan(narrowToday.x + 200);
});

test("telefonda Başla ilk ekranda, üst barın hiçbir hapı kesik değil", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "telefon testi");
  await mockApi(page);
  await page.goto("/seans");

  const start = page.getByRole("button", { name: "Başla" });
  await expect(start).toBeVisible();
  expect(await isReachable(start)).toBe(true);

  const viewport = page.viewportSize()!;
  const subject = page.getByText("Ders seç").first();
  const sound = page.getByRole("button", { name: "Odak müziği" });
  const subjectBox = (await subject.boundingBox())!;
  const soundBox = (await sound.boundingBox())!;
  expect(subjectBox.x).toBeGreaterThanOrEqual(0);
  expect(soundBox.x + soundBox.width).toBeLessThanOrEqual(viewport.width);
  expect(soundBox.height).toBeGreaterThanOrEqual(44);
});

test("Bugün kartı hedefi seanslardan çizer ve Tüm geçmiş çekmeceyi açar", async ({ page }) => {
  await mockApi(page);
  await page.goto("/seans");

  const today = page.getByRole("region", { name: "Bugün" });
  await expect(today.getByRole("heading", { name: "Bugün" })).toHaveCSS("text-transform", "none");
  await expect(today.getByText("45")).toBeVisible();
  await expect(today.getByRole("img")).toHaveAttribute(
    "aria-label",
    "Günlük hedefin 120 dakika. 2 seansla 45 dakika tamamladın.",
  );
  await expect(today).toContainText("1 seans yarım kaldı.");

  await today.getByTestId("session-history-open").click();
  const drawer = page.getByTestId("session-history-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Türkçe")).toBeVisible();
});

test("masa adları kesilmez, uzun süredir sessiz masa söylenir", async ({ page }) => {
  await mockApi(page);
  await page.goto("/seans");

  const card = page.getByRole("region", { name: "Masaların" });
  const longName = card.getByText("Hafta Sonu Tarih ve Coğrafya Tekrarı");
  await expect(longName).toBeVisible();
  expect(await longName.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await expect(card).toContainText("uzun süredir sessiz");
  await expect(card).toContainText("1 kişi çalışıyor");
});

test("sahnedeki Dürt butonu odanın mürekkebiyle okunur", async ({ page }) => {
  await mockApi(page);
  await page.goto("/seans");

  const nudge = page.getByRole("button", { name: "Dürt" });
  await expect(nudge).toBeVisible();
  // On the glass the old button filled with `--color-surface-container` (near white) and wrote
  // the room's cream ink on it. The outline ledge reads the remapped ink over translucent glass.
  await expect(nudge).toHaveCSS("color", "rgb(247, 240, 228)");
  const bg = await nudge.evaluate((el) => getComputedStyle(el).backgroundColor);
  const alpha = Number(bg.match(/rgba?\([^)]*?,\s*([\d.]+)\)$/)?.[1] ?? "1");
  expect(alpha).toBeLessThan(0.5);
});

test("seans listesi gelmese de bugünkü dakikalar çizgide görünür", async ({ page }) => {
  await mockApi(page, { sessions: [] });
  await page.goto("/seans");

  const today = page.getByRole("region", { name: "Bugün" });
  await expect(today.getByRole("img")).toHaveAttribute(
    "aria-label",
    "Günlük hedefin 120 dakika. Bugün 45 dakika tamamladın.",
  );
  await expect(today).toContainText("Hedefe 75 dk var.");
});

test("Başla'da ışıklar kısılır: menü karanlıkta kalır, halka sahnenin ortasına geçer", async ({ page }) => {
  await mockApi(page);
  await page.goto("/seans");
  await expect(page.getByRole("heading", { name: "Bugün", level: 2 })).toBeVisible();
  const idle = await stageLights(page);
  expect(idle).toMatchObject({ phase: "idle", zIndex: "auto", cover: 0, warmth: 0 });
  expect(idle.veil).toBeCloseTo(0.58, 2);

  await page.getByRole("button", { name: "Başla" }).click();
  await expect(page.getByRole("button", { name: "Seansı bitir" })).toBeVisible();
  const focus = await stageLights(page);
  // Raised over the app chrome, which goes dark; the room's veil thickens.
  expect(focus).toMatchObject({ phase: "focus", zIndex: "30", cover: 0.94, warmth: 0 });
  expect(focus.veil).toBeCloseTo(0.86, 2);
  // The setup screen is gone and one ring is left, centred on the room rather than the window.
  await expect(page.getByRole("heading", { name: "Bugün", level: 2 })).toHaveCount(0);
  await expect(page.locator("[data-session-ring]")).toHaveCount(1);
  const centres = await page.evaluate(() => {
    const centre = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.left + r.width / 2;
    };
    return {
      ring: centre(document.querySelector("[data-session-ring]")!),
      room: centre(document.querySelector("[data-room-veil]")!),
    };
  });
  expect(Math.abs(centres.ring - centres.room)).toBeLessThan(2);
});

test("mola ışığı açar ve ısıtır, halka molanın yeşiline döner", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    const now = Date.now();
    window.localStorage.setItem(
      "mentor.session.active",
      JSON.stringify({
        sessionId: "s-live",
        phase: "break",
        phaseEndsAt: now + 240_000,
        isPaused: false,
        pausedAt: null,
        focusMinutes: 25,
        breakMinutes: 5,
        preset: "25_5",
        subject: null,
        planTaskId: null,
        planTaskTitle: null,
        focusElapsed: 1500,
        savedAt: now,
      }),
    );
  });
  await page.goto("/seans");

  await expect(page.getByRole("button", { name: "Molayı geç" })).toBeVisible();
  const lights = await stageLights(page);
  expect(lights).toMatchObject({ phase: "break", zIndex: "30", cover: 0.94, warmth: 0.4 });
  expect(lights.veil).toBeCloseTo(0.44, 2);
  await expect(page.locator("[data-session-ring] circle[stroke-dasharray]")).toHaveCSS(
    "stroke",
    "rgb(107, 196, 154)",
  );
});

test("bitişte ışık açılır ve biten seans Bugün şeridine eklenir", async ({ page }) => {
  await mockApi(page);
  await page.goto("/seans");
  await page.getByRole("button", { name: "Başla" }).click();
  await page.getByRole("button", { name: "Seansı bitir" }).click();

  const again = page.getByRole("button", { name: "Yeni seans" });
  await expect(again).toBeVisible();
  const done = await stageLights(page);
  expect(done).toMatchObject({ phase: "done", zIndex: "30", cover: 0.94 });
  expect(done.veil).toBeCloseTo(0.74, 2);

  await again.click();
  const today = page.getByRole("region", { name: "Bugün" });
  // Only the session just finished grows in; the day's earlier ones stay put.
  await expect(today.locator("[data-fresh]")).toHaveCount(1);
  await expect.poll(async () => (await stageLights(page)).zIndex).toBe("auto");
  expect(await stageLights(page)).toMatchObject({ phase: "idle", cover: 0, warmth: 0 });
});
