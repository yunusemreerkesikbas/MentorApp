import { statSync } from "node:fs";
import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";
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

function sessionAt(
  id: string,
  minutesAgo: number,
  minutes: number,
  subject: string,
  status = "COMPLETED",
) {
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
    partner: {
      userId: PARTNER_ID,
      displayName: "Elif Yılmaz",
      username: "elify",
      avatarUrl: null,
    },
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
      "access-control-allow-origin":
        route.request().headers().origin ?? "http://localhost:3100",
      "access-control-allow-credentials": "true",
    },
    contentType: "application/json",
    body: body == null ? "" : JSON.stringify(body),
  });
}

const JOIN_FULL = "Bu masa dolu.";
const JOIN_QUOTA =
  "En fazla 3 masaya üye olabilirsin. Katılmak için birinden ayrılman yeterli.";
const JOIN_MALFORMED = "Kod MASA- ile başlar, ardından 6 karakter gelir.";

const createdRoom = {
  id: "44444444-4444-4444-8444-444444444444",
  inviteCode: "MASA-N3W4R0",
};

const joinedRoom = {
  id: "66666666-6666-4666-8666-666666666666",
  name: "Akşam Masası",
  theme: "CAFE",
  capacity: 4,
  memberCount: 2,
  activeCount: 0,
  role: "MEMBER" as const,
  isActive: true,
};

async function flowShot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`flow-${name}.png`),
  });
}

async function mockApi(
  page: Page,
  opts: {
    joinError?: string;
    joinStatus?: number;
    sessions?: unknown[];
    /** `hidden` is the feature-flag 403: the section unmounts. `empty` is a real empty list. */
    rooms?: "default" | "empty" | "hidden";
    createError?: { code: string; message: string };
  } = {},
) {
  const calls: Call[] = [];
  const listed =
    opts.rooms === "empty" ? [] : rooms.map((room) => ({ ...room }));
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
    if (method !== "GET")
      calls.push({ method, path, body: request.postDataJSON() });
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
    if (method === "GET" && path === "/v1/study-rooms") {
      if (opts.rooms === "hidden") {
        return json(
          route,
          { code: "COACHING_ROOM_DISABLED", message: "Kapalı." },
          403,
        );
      }
      return json(route, listed);
    }
    if (method === "POST" && path === "/v1/study-rooms") {
      if (opts.createError) return json(route, opts.createError, 409);
      const body = request.postDataJSON() as {
        name: string;
        theme: string;
        capacity: number;
      };
      const created = {
        id: createdRoom.id,
        name: body.name,
        theme: body.theme,
        capacity: body.capacity,
        memberCount: 1,
        activeCount: 0,
        role: "OWNER" as const,
        isActive: true,
      };
      listed.push(created);
      return json(
        route,
        { ...created, inviteCode: createdRoom.inviteCode, seats: [] },
        201,
      );
    }
    if (method === "POST" && path === "/v1/study-rooms/join") {
      if (opts.joinError) {
        return json(
          route,
          { code: opts.joinError, message: "Kod geçersiz." },
          opts.joinStatus ?? 404,
        );
      }
      if (!listed.some((room) => room.id === joinedRoom.id))
        listed.push({ ...joinedRoom });
      return json(route, { ...joinedRoom, inviteCode: null, seats: [] });
    }
    if (method === "GET" && path === "/v1/buddy")
      return json(route, activeBuddy);
    if (method === "DELETE" && path === "/v1/buddy")
      return json(route, null, 204);
    if (method === "POST" && path === "/v1/study-sessions") {
      return json(
        route,
        {
          ...sessionAt("s-new", 0, 0, "Matematik", "ACTIVE"),
          countsAsFocusSession: true,
        },
        201,
      );
    }
    if (method === "PATCH" && path === "/v1/study-sessions/s-new") {
      finished = true;
      const body = request.postDataJSON() as {
        actualFocusSeconds: number;
        status: string;
      };
      return json(route, {
        ...sessionAt("s-new", 0, 25, "Matematik"),
        ...body,
        countsAsFocusSession: true,
      });
    }
    if (method === "GET" && path === "/v1/study-sessions") {
      const items =
        opts.sessions ??
        (finished
          ? [sessionAt("s-new", 0, 25, "Matematik"), ...todaySessions]
          : todaySessions);
      return json(route, { items, total: items.length, page: 1, pageSize: 20 });
    }
    if (method === "GET" && path === "/v1/notifications") {
      return json(route, {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        unreadCount: 0,
      });
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
    const hit = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    );
    return hit === el || el.contains(hit);
  });
}

/** The stage's lights, read off live styles (reduced motion: every change lands at once). */
async function stageLights(page: Page) {
  return page.getByTestId("session-stage").evaluate((stage) => {
    const opacity = (selector: string) =>
      Number(getComputedStyle(stage.querySelector(selector)!).opacity);
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

for (const minutes of [41, 80, 200]) {
  test(`görev süresi: ${minutes} dakika custom seans olarak başlar`, async ({
    page,
  }) => {
    const calls = await mockApi(page, { rooms: "hidden" });
    await page.goto(`/seans?minutes=${minutes}`);
    const dial = page.getByRole("slider");
    await expect(dial).toHaveAttribute("aria-valuenow", String(minutes));
    await expect(dial).toHaveAttribute("aria-valuemax", "200");
    await dial.press("ArrowUp");
    await expect(dial).toHaveAttribute(
      "aria-valuenow",
      String(Math.min(200, minutes + 1)),
    );
    if (minutes < 200) await dial.press("ArrowDown");
    await expect(dial).toHaveAttribute("aria-valuenow", String(minutes));
    await page.getByRole("button", { name: "Başla", exact: true }).click();
    await expect
      .poll(
        () =>
          calls.find(
            (call) =>
              call.path === "/v1/study-sessions" && call.method === "POST",
          )?.body,
      )
      .toMatchObject({ preset: "custom", focusMinutes: minutes });
  });
}

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
  expect(
    await dialog.evaluate(
      (el) => getComputedStyle(el, "::backdrop").backgroundColor,
    ),
  ).toBe("rgba(17, 17, 17, 0.4)");

  await dialog.getByLabel("Masa adı").fill("Öğle Molası");
  const submit = dialog.getByRole("button", { name: "Masayı kur" });
  expect(await isReachable(submit)).toBe(true);
  await submit.click();

  await expect(dialog).toBeHidden();
  const created = calls.find(
    (c) => c.method === "POST" && c.path === "/v1/study-rooms",
  );
  expect(created?.body).toMatchObject({
    name: "Öğle Molası",
    theme: "LIBRARY",
    capacity: 4,
  });
});

test("kod ile katılma hatası toast değil, alanın altında söylenir", async ({
  page,
}) => {
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
  expect(await isReachable(dialog.getByRole("button", { name: "Katıl" }))).toBe(
    true,
  );
});

test("boş ya da boşluk ad masa kurmaz", async ({ page }, testInfo) => {
  const calls = await mockApi(page);
  await page.goto("/seans");
  await expect(page.locator('button[aria-label="Masa kur"]')).toHaveCount(1);

  await page.getByRole("button", { name: "Masa kur" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Yeni masa" });
  const submit = dialog.getByRole("button", { name: "Masayı kur" });
  const name = dialog.getByLabel("Masa adı");
  await expect(submit).toBeDisabled();

  await name.fill("   ");
  await expect(submit).toBeDisabled();
  await name.press("Enter");
  await expect(dialog).toBeVisible();
  expect(
    calls.some((c) => c.method === "POST" && c.path === "/v1/study-rooms"),
  ).toBe(false);
  await flowShot(page, testInfo, "create-empty-name");
});

test("kurma formu temayı, koltuk sınırını ve kırpılmış adı gönderir", async ({
  page,
}, testInfo) => {
  const calls = await mockApi(page);
  await page.goto("/seans");

  await page.getByRole("button", { name: "Masa kur" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Yeni masa" });
  const less = dialog.getByRole("button", { name: "Bir koltuk azalt" });
  const more = dialog.getByRole("button", { name: "Bir koltuk ekle" });
  const seats = dialog.locator("output");
  await expect(seats).toHaveText("4");
  await less.click();
  await less.click();
  await expect(seats).toHaveText("2");
  await expect(less).toBeDisabled();
  for (let step = 0; step < 8; step += 1) await more.click();
  await expect(seats).toHaveText("10");
  await expect(more).toBeDisabled();

  await dialog.getByRole("button", { name: "Sonraki tema" }).click();
  await expect(dialog.getByText("Kafe")).toBeVisible();

  const name = dialog.getByLabel("Masa adı");
  await expect(name).toHaveAttribute("maxlength", "40");
  await name.fill("a".repeat(50));
  await expect(name).toHaveValue("a".repeat(40));
  await name.fill("  Akşam Kafe  ");
  await flowShot(page, testInfo, "create-theme-capacity");
  await dialog.getByRole("button", { name: "Masayı kur" }).click();

  await expect(dialog).toBeHidden();
  const created = calls.find(
    (c) => c.method === "POST" && c.path === "/v1/study-rooms",
  );
  expect(created?.body).toMatchObject({
    name: "Akşam Kafe",
    theme: "CAFE",
    capacity: 10,
  });
});

test("vazgeç ve escape masa kurma isteği atmaz", async ({ page }, testInfo) => {
  const calls = await mockApi(page);
  await page.goto("/seans");
  const open = () =>
    page.getByRole("button", { name: "Masa kur" }).first().click();

  await open();
  const dialog = page.getByRole("dialog", { name: "Yeni masa" });
  if (!testInfo.project.name.startsWith("mobile")) {
    await dialog.getByRole("button", { name: "Vazgeç" }).click();
    await expect(dialog).toBeHidden();
    await open();
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(
    calls.some((c) => c.method === "POST" && c.path === "/v1/study-rooms"),
  ).toBe(false);
});

test("masa kotası dolunca pencere açık kalır ve nedeni pencerede söyler", async ({
  page,
}, testInfo) => {
  await mockApi(page, {
    createError: {
      code: "COACHING_ROOM_QUOTA_EXCEEDED",
      message:
        "En fazla 3 masaya üye olabilirsin; katılmak için birinden ayrılman yeterli.",
    },
  });
  await page.goto("/seans");

  await page.getByRole("button", { name: "Masa kur" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Yeni masa" });
  await dialog.getByLabel("Masa adı").fill("Dördüncü Masa");
  await dialog.getByRole("button", { name: "Masayı kur" }).click();

  // Inside the sheet: a toast would sit under the native dialog's top layer, dimmed and inert.
  await expect(dialog.getByRole("alert")).toContainText("En fazla 3 masaya üye olabilirsin");
  await expect(dialog).toBeVisible();
  await flowShot(page, testInfo, "create-quota");
});

test("kurulan masa listeye düşer", async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto("/seans");

  await page.getByRole("button", { name: "Masa kur" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Yeni masa" });
  await dialog.getByLabel("Masa adı").fill("Öğle Molası");
  await dialog.getByRole("button", { name: "Masayı kur" }).click();

  const card = page.getByRole("region", { name: "Masaların" });
  await expect(dialog).toBeHidden();
  await expect(card.getByText("Öğle Molası")).toBeVisible();
  await flowShot(page, testInfo, "create-listed");
});

test("küçük harf kod büyük harfle katılır ve masa listeye düşer", async ({
  page,
}, testInfo) => {
  const calls = await mockApi(page);
  await page.goto("/seans");

  await page.getByRole("button", { name: "Kod ile katıl" }).click();
  const dialog = page.getByRole("dialog", { name: "Kod ile katıl" });
  await dialog.getByLabel("Davet kodu").fill("masa-a1b2c3");
  await dialog.getByRole("button", { name: "Katıl" }).click();

  await expect(dialog).toBeHidden();
  const joined = calls.find(
    (c) => c.method === "POST" && c.path === "/v1/study-rooms/join",
  );
  expect(joined?.body).toMatchObject({ code: "MASA-A1B2C3" });
  await expect(
    page.getByRole("region", { name: "Masaların" }).getByText("Akşam Masası"),
  ).toBeVisible();
  await flowShot(page, testInfo, "join-listed");
});

test("zaten üye olan kodu alanın altında söylenir", async ({
  page,
}, testInfo) => {
  await mockApi(page, {
    joinError: "COACHING_ROOM_ALREADY_MEMBER",
    joinStatus: 409,
  });
  await page.goto("/seans");

  await page.getByRole("button", { name: "Kod ile katıl" }).click();
  const dialog = page.getByRole("dialog", { name: "Kod ile katıl" });
  const field = dialog.getByLabel("Davet kodu");
  await field.fill("MASA-A1B2C3");
  await dialog.getByRole("button", { name: "Katıl" }).click();

  await expect(dialog.getByRole("alert")).toHaveText("Zaten bu masadasın.");
  await expect(field).toBeFocused();
  await expect(dialog).toBeVisible();
  await flowShot(page, testInfo, "join-already-member");
});

for (const [code, text] of [
  ["COACHING_ROOM_FULL", JOIN_FULL],
  ["COACHING_ROOM_QUOTA_EXCEEDED", JOIN_QUOTA],
] as const) {
  test(`${code} katılmayı kendi cümlesiyle söyler`, async ({
    page,
  }, testInfo) => {
    await mockApi(page, { joinError: code, joinStatus: 409 });
    await page.goto("/seans");

    await page.getByRole("button", { name: "Kod ile katıl" }).click();
    const dialog = page.getByRole("dialog", { name: "Kod ile katıl" });
    await dialog.getByLabel("Davet kodu").fill("MASA-A1B2C3");
    await dialog.getByRole("button", { name: "Katıl" }).click();

    await expect(dialog.getByRole("alert")).toHaveText(text);
    await expect(dialog.getByLabel("Davet kodu")).toBeFocused();
    await flowShot(page, testInfo, "join-specific");
  });
}

test("biçimsiz kod alanın altında kalır ve yazınca silinir", async ({
  page,
}, testInfo) => {
  const calls = await mockApi(page, {
    joinError: "VALIDATION_ERROR",
    joinStatus: 400,
  });
  await page.goto("/seans");

  await page.getByRole("button", { name: "Kod ile katıl" }).click();
  const dialog = page.getByRole("dialog", { name: "Kod ile katıl" });
  const field = dialog.getByLabel("Davet kodu");

  await field.fill("abc");
  await dialog.getByRole("button", { name: "Katıl" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(JOIN_MALFORMED);
  await expect(field).toBeFocused();
  expect(
    calls.filter((c) => c.path === "/v1/study-rooms/join").at(-1)?.body,
  ).toMatchObject({
    code: "ABC",
  });

  await field.fill("MASA-ZZZZZZ");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Katıl" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(JOIN_MALFORMED);
  await expect(field).toBeFocused();
  expect(
    calls.filter((c) => c.path === "/v1/study-rooms/join").at(-1)?.body,
  ).toMatchObject({
    code: "MASA-ZZZZZZ",
  });
  await flowShot(page, testInfo, "join-malformed");
});

test("katil parametresi pencereyi bir kez açar", async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto("/seans?katil=1");

  await expect(
    page.getByRole("dialog", { name: "Kod ile katıl" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/seans$/);
  await flowShot(page, testInfo, "join-query");
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Kod ile katıl" })).toHaveCount(
    0,
  );
});

test("masa özelliği kapalıyken bölüm görünmez", async ({ page }) => {
  await mockApi(page, { rooms: "hidden" });
  await page.goto("/seans");

  await expect(page.getByRole("button", { name: "Başla" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Masaların" })).toHaveCount(0);
});

test("boş masa listesinde kurma yazısı durur, artı ikon durmaz", async ({
  page,
}, testInfo) => {
  await mockApi(page, { rooms: "empty" });
  await page.goto("/seans");

  const card = page.getByRole("region", { name: "Masaların" });
  await expect(card).toContainText(
    "Masan henüz yok. Kod paylaş, ya da verilen kodla otur.",
  );
  await expect(card.getByRole("button", { name: "Masa kur" })).toBeVisible();
  await expect(page.locator('button[aria-label="Masa kur"]')).toHaveCount(0);
  await flowShot(page, testInfo, "rooms-empty");
});

test("yol arkadaşlığını bitirmek kırmızı bir onay ister", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/seans");

  await page.getByRole("button", { name: "Yol arkadaşlığını bitir" }).click();
  const confirm = page.getByRole("dialog", {
    name: "Yol arkadaşlığını bitirelim mi?",
  });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText(
    "Elif Yılmaz artık bugünkü emeğini görmez, sen de onunkini.",
  );
  await expect(confirm.getByRole("button", { name: "Vazgeç" })).toBeFocused();
  await expect(confirm.getByRole("button", { name: "Bitir" })).toHaveCSS(
    "background-color",
    "rgb(180, 35, 24)",
  );
  expect(
    calls.some((c) => c.method === "DELETE" && c.path === "/v1/buddy"),
  ).toBe(false);

  await confirm.getByRole("button", { name: "Bitir" }).click();
  await expect
    .poll(() =>
      calls.some((c) => c.method === "DELETE" && c.path === "/v1/buddy"),
    )
    .toBe(true);
});

test("iki bölge: geniş ekranda ray sayacın sağında, 1024'te altında iki sütun", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "genişlik testi masaüstü projesinde",
  );
  await mockApi(page);
  await page.goto("/seans");

  const start = page.getByRole("button", { name: "Başla" });
  const today = page.getByRole("heading", { name: "Bugün", level: 2 });
  const rooms = page.getByRole("heading", { name: "Masaların", level: 2 });
  await expect(today).toBeVisible();

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

test("geniş ekranda sayaç ve üst bar sayfanın ortasında, ray sağ kenarda", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "genişlik testi masaüstü projesinde",
  );
  await page.setViewportSize({ width: 1600, height: 900 });
  await mockApi(page);
  await page.goto("/seans");

  const start = page.getByRole("button", { name: "Başla" });
  const pills = page
    .getByRole("button", { name: "Ortam sesi" })
    .locator("xpath=ancestor::div[contains(@class,'overflow-x-auto')][1]");
  const today = page.getByRole("region", { name: "Bugün" });
  await expect(today).toBeVisible();

  // The page's own main box is the content area (after the sidebar, before any scrollbar gutter).
  const main = (await start.locator("xpath=ancestor::main[1]").boundingBox())!;
  const centre = main.x + main.width / 2;
  const mid = (box: { x: number; width: number }) => box.x + box.width / 2;
  expect(Math.abs(mid((await start.boundingBox())!) - centre)).toBeLessThan(2);
  expect(Math.abs(mid((await pills.boundingBox())!) - centre)).toBeLessThan(2);
  // The rail sits at the right edge, only the frame's 40px gutter between.
  const todayBox = (await today.boundingBox())!;
  expect(main.x + main.width - (todayBox.x + todayBox.width)).toBeLessThanOrEqual(41);
});

test("telefonda Başla ilk ekranda, üst barın hiçbir hapı kesik değil", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "telefon testi");
  await mockApi(page);
  await page.goto("/seans");

  const start = page.getByRole("button", { name: "Başla" });
  await expect(start).toBeVisible();
  expect(await isReachable(start)).toBe(true);

  const viewport = page.viewportSize()!;
  const subject = page.getByText("Ders seç").first();
  const sound = page.getByRole("button", { name: "Ortam sesi" });
  const subjectBox = (await subject.boundingBox())!;
  const soundBox = (await sound.boundingBox())!;
  expect(subjectBox.x).toBeGreaterThanOrEqual(0);
  expect(soundBox.x + soundBox.width).toBeLessThanOrEqual(viewport.width);
  expect(soundBox.height).toBeGreaterThanOrEqual(44);
});

test("Sahneye uygun ses odanın iki döngüsünü çalar ve sahne değişince onu izler", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "tema okları masaüstü üst barında",
  );
  // Record what starts playing instead of playing it: the loops are `new Audio()`, never in the DOM.
  await page.addInitScript(() => {
    const w = window as unknown as { played: string[] };
    w.played = [];
    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
      w.played.push(new URL(this.src).pathname);
      return Promise.resolve();
    };
  });
  await mockApi(page);
  await page.goto("/seans");
  const played = () =>
    page.evaluate(() => (window as unknown as { played: string[] }).played.splice(0));

  await page.getByRole("button", { name: "Ortam sesi" }).click();
  await page.getByRole("menuitem", { name: "Sahneye uygun" }).click();
  // Idle: a short preview of the room on screen, ambience and music together.
  await expect.poll(played).toEqual(
    expect.arrayContaining([
      "/audio/scene-library-ambience.mp3",
      "/audio/scene-library-music.mp3",
    ]),
  );

  await page.getByRole("button", { name: "Sonraki tema" }).click();
  await expect(page.getByText("Kafe", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Başla" }).click();
  await expect.poll(played).toEqual(
    expect.arrayContaining([
      "/audio/scene-cafe-ambience.mp3",
      "/audio/scene-cafe-music.mp3",
    ]),
  );
});

test("Bugün kartı hedefi seanslardan çizer ve Tüm geçmiş çekmeceyi açar", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/seans");

  const today = page.getByRole("region", { name: "Bugün" });
  await expect(today.getByRole("heading", { name: "Bugün" })).toHaveCSS(
    "text-transform",
    "none",
  );
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

test("masa adları kesilmez, uzun süredir sessiz masa söylenir", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/seans");

  const card = page.getByRole("region", { name: "Masaların" });
  const longName = card.getByText("Hafta Sonu Tarih ve Coğrafya Tekrarı");
  await expect(longName).toBeVisible();
  expect(
    await longName.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
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

test("seans listesi gelmese de bugünkü dakikalar çizgide görünür", async ({
  page,
}) => {
  await mockApi(page, { sessions: [] });
  await page.goto("/seans");

  const today = page.getByRole("region", { name: "Bugün" });
  await expect(today.getByRole("img")).toHaveAttribute(
    "aria-label",
    "Günlük hedefin 120 dakika. Bugün 45 dakika tamamladın.",
  );
  await expect(today).toContainText("Hedefe 75 dk var.");
});

test("Başla'da ışıklar kısılır: menü karanlıkta kalır, halka sahnenin ortasına geçer", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/seans");
  await expect(
    page.getByRole("heading", { name: "Bugün", level: 2 }),
  ).toBeVisible();
  const idle = await stageLights(page);
  expect(idle).toMatchObject({
    phase: "idle",
    zIndex: "auto",
    cover: 0,
    warmth: 0,
  });
  expect(idle.veil).toBeCloseTo(0.58, 2);

  await page.getByRole("button", { name: "Başla" }).click();
  await expect(
    page.getByRole("button", { name: "Seansı bitir" }),
  ).toBeVisible();
  const focus = await stageLights(page);
  // Raised over the app chrome, which goes dark; the room's veil thickens.
  expect(focus).toMatchObject({
    phase: "focus",
    zIndex: "30",
    cover: 0.94,
    warmth: 0,
  });
  expect(focus.veil).toBeCloseTo(0.86, 2);
  // Under the cover the chrome is a ghost: no click, no Tab stop.
  for (const chrome of await page.locator("[data-app-chrome]").all()) {
    await expect(chrome).toHaveJSProperty("inert", true);
  }
  // The setup screen is gone and one ring is left, centred on the room rather than the window.
  await expect(
    page.getByRole("heading", { name: "Bugün", level: 2 }),
  ).toHaveCount(0);
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

test("mola ışığı açar ve ısıtır, halka molanın yeşiline döner", async ({
  page,
}) => {
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
  expect(lights).toMatchObject({
    phase: "break",
    zIndex: "30",
    cover: 0.94,
    warmth: 0.4,
  });
  expect(lights.veil).toBeCloseTo(0.44, 2);
  await expect(
    page.locator("[data-session-ring] circle[stroke-dasharray]"),
  ).toHaveCSS("stroke", "rgb(107, 196, 154)");
});

test("bitişte ışık açılır ve biten seans Bugün şeridine eklenir", async ({
  page,
}) => {
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
  await expect(page.locator("[data-app-chrome]").first()).toHaveJSProperty("inert", false);
  expect(await stageLights(page)).toMatchObject({
    phase: "idle",
    cover: 0,
    warmth: 0,
  });
});

test("stopwatch counts up, excludes pauses, resumes and records actual work", async ({
  page,
}) => {
  const calls = await mockApi(page);
  await page.clock.install();
  await page.goto(
    "/seans?preset=stopwatch&taskTitle=Review&taskId=33333333-3333-4333-8333-333333333333",
  );
  await expect(
    page.getByRole("button", { name: "S\u00fcresiz", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("slider")).toHaveCount(0);
  await page.getByRole("button", { name: "Ba\u015fla", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Duraklat", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(125 * 60_000);
  await expect(page.locator("[data-session-ring]")).toContainText("125:00");
  expect(
    calls.filter(
      (c) => c.method === "PATCH" && c.path === "/v1/study-sessions/s-new",
    ),
  ).toHaveLength(0);
  await page.getByRole("button", { name: "Duraklat", exact: true }).click();
  await page.clock.fastForward(10 * 60_000);
  await expect(page.locator("[data-session-ring]")).toContainText("125:00");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Devam et", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-session-ring]")).toContainText("125:00");
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await page.clock.fastForward(60_000);
  await expect(page.locator("[data-session-ring]")).toContainText("126:00");
  await page
    .getByRole("button", { name: "Seans\u0131 bitir", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Yeni seans" })).toBeVisible();
  expect(
    calls.find((c) => c.path === "/v1/study-sessions" && c.method === "POST")
      ?.body,
  ).toMatchObject({ preset: "stopwatch" });
  expect(
    calls.find(
      (c) => c.path === "/v1/study-sessions/s-new" && c.method === "PATCH",
    )?.body,
  ).toMatchObject({ status: "COMPLETED", actualFocusSeconds: 7560 });
  await expect(
    page.getByRole("button", { name: "Molay\u0131 ge\u00e7" }),
  ).toHaveCount(0);
});

test("stopwatch setup can switch back to a timed preset", async ({ page }) => {
  await mockApi(page);
  await page.goto("/seans?preset=stopwatch");
  await page.getByRole("button", { name: "50 / 10 dk", exact: true }).click();
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "50");
  await expect(
    page.getByRole("button", { name: "S\u00fcresiz", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("saniyelik, sayılmayan seans şeride çizilmez", async ({ page }) => {
  await mockApi(page, {
    sessions: [
      { ...sessionAt("s-short", 5, 0, "Matematik"), countsAsFocusSession: false },
      { ...sessionAt("s-1", 120, 25, "Matematik"), countsAsFocusSession: true },
    ],
  });
  await page.goto("/seans");

  const today = page.getByRole("region", { name: "Bugün" });
  await expect(today.getByRole("img")).toHaveAttribute(
    "aria-label",
    "Günlük hedefin 120 dakika. 1 seansla 45 dakika tamamladın.",
  );
});

test("ışık açılırken sahne menünün üstünde kalır, sonra iner (hareket açık)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mockApi(page);
  await page.goto("/seans");
  await page.getByRole("button", { name: "Başla" }).click();
  await page.getByRole("button", { name: "Seansı bitir" }).click();
  // Sample every frame from the click on: the stage may only drop under the chrome once the
  // cover has faded, or the sidebar would pop back through the dark.
  await page.evaluate(() => {
    const frames: { z: string; cover: number }[] = [];
    (window as unknown as { __frames: typeof frames }).__frames = frames;
    const sample = () => {
      const stage = document.querySelector<HTMLElement>("[data-testid=session-stage]");
      const cover = stage?.querySelector<HTMLElement>("[data-stage-cover]");
      if (stage && cover) {
        frames.push({ z: getComputedStyle(stage).zIndex, cover: Number(getComputedStyle(cover).opacity) });
      }
      if (frames.length < 120) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.getByRole("button", { name: "Yeni seans" }).click();
  await expect.poll(async () => (await stageLights(page)).zIndex, { timeout: 3000 }).toBe("auto");
  const frames = await page.evaluate(
    () => (window as unknown as { __frames: { z: string; cover: number }[] }).__frames,
  );
  expect(frames.filter((f) => f.z === "auto" && f.cover > 0.02)).toEqual([]);
  await expect(page.locator("[data-session-ring]")).toHaveCount(1);
  await expect(page.locator("[data-session-ring]")).toBeVisible();
});

/** Finishes a stopwatch session of `minutes`: the done card, counted unless a route says not. */
async function finishStopwatch(page: Page, minutes: number) {
  await page.clock.install();
  await page.goto("/seans?preset=stopwatch");
  await page.getByRole("button", { name: "Başla", exact: true }).click();
  await expect(page.getByRole("button", { name: "Duraklat", exact: true })).toBeVisible();
  await page.clock.fastForward(minutes * 60_000);
  await page.getByRole("button", { name: "Seansı bitir", exact: true }).click();
  await expect(page.getByRole("button", { name: "Yeni seans" })).toBeVisible();
}

type SharedFile = { name: string; type: string; size: number };

test("sayılmayan kısa deneme paylaşılmaz", async ({ page }) => {
  await mockApi(page);
  // Registered after `mockApi`, so it answers the finish first: the server did not count it.
  await page.route("http://localhost:3001/v1/study-sessions/s-new", (route) =>
    route.request().method() === "PATCH"
      ? json(route, { ...sessionAt("s-new", 0, 2, "Matematik"), countsAsFocusSession: false })
      : route.fallback(),
  );
  await finishStopwatch(page, 2);

  await expect(page.getByText("Kısa bir deneme. Serine sayılmadı, sorun değil.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Seansı paylaş" })).toHaveCount(0);
});

test("seans kartı hazırlanır ve masaüstünde PNG olarak iner", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "indirme yolu masaüstünde");
  // A desktop without Web Share for files: the window offers the download first.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  });
  await mockApi(page);
  await finishStopwatch(page, 50);

  await page.getByRole("button", { name: "Seansı paylaş" }).click();
  const sheet = page.getByRole("dialog", { name: "Seansını paylaş" });
  await expect(sheet.getByRole("img", { name: /^Paylaşım kartı: 50 dk odak, bugünün \d+\. seansı · / })).toBeVisible();

  const downloading = page.waitForEvent("download");
  await sheet.getByRole("button", { name: "Görseli indir" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("mentor-seans.png");
  expect(statSync(await download.path()).size).toBeGreaterThan(50_000);
  // A download is its own feedback: nothing else speaks in the window.
  await expect(sheet.getByRole("alert")).toHaveCount(0);
});

test("telefonda seans kartı sistemin paylaşım penceresine PNG olarak gider", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "telefon testi");
  // Stand in for the phone's share sheet and keep what it was handed.
  await page.addInitScript(() => {
    const shared: { name: string; type: string; size: number }[] = [];
    (window as unknown as { __shared: typeof shared }).__shared = shared;
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        for (const file of data.files ?? []) {
          shared.push({ name: file.name, type: file.type, size: file.size });
        }
      },
    });
  });
  await mockApi(page);
  await finishStopwatch(page, 50);

  await page.getByRole("button", { name: "Seansı paylaş" }).click();
  const sheet = page.getByRole("dialog", { name: "Seansını paylaş" });
  await sheet.getByRole("button", { name: "Paylaş", exact: true }).click();
  const shared = () =>
    page.evaluate(() => (window as unknown as { __shared: SharedFile[] }).__shared);
  await expect.poll(shared).toEqual([
    expect.objectContaining({ name: "mentor-seans.png", type: "image/png" }),
  ]);
  expect((await shared())[0].size).toBeGreaterThan(50_000);
});
