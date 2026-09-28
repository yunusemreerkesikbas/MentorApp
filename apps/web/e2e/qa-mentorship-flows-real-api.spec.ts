import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

/**
 * Coach ↔ student lifecycle against the REAL API (not mocks): invite, consent, assignment, note,
 * follow-up, feedback loop, guardrails, leaving and re-linking — two people, two browsers.
 *
 * Runs only against the isolated QA stack (web built with NEXT_PUBLIC_API_URL → this API, which
 * points at `mentor_test` with fake AI/storage/payments and console email):
 *   QA_MENTORSHIP_API_URL=http://localhost:3101/v1 QA_MENTORSHIP_RUN_ID=<6-10 [a-z0-9]>
 *   PLAYWRIGHT_BASE_URL=http://localhost:3100
 * Always with `--workers=1`: both projects flip the same config flags, so they must not overlap.
 */
const api = process.env.QA_MENTORSHIP_API_URL ?? "";
const runId = process.env.QA_MENTORSHIP_RUN_ID ?? "";
test.skip(
  !/^http:\/\/localhost:\d+\/v1$/.test(api) || !/^[a-z0-9]{6,10}$/.test(runId),
  "Requires the isolated QA API (mentor_test) and a short run ID.",
);
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);

const password = "MentorQa!2026";
const evidenceDate = new Date().toISOString().slice(0, 10);
const FLAG_KEYS = [
  "mentorship.enabled",
  "mentorship.applications.open",
  "mentorship.followups.enabled",
  "mentorship.weekly_reports.enabled",
  "mentorship.coach.free_seats",
] as const;

type Account = {
  email: string;
  username: string;
  id: string;
  displayName: string;
  token: string;
  refreshCookies: Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"];
};
type Notification = { category: string; title: string; body: string; linkUrl: string | null };
type PlanTask = { id: string; title: string; status: string; origin?: { type: string } | null };

const accounts: Record<string, Account> = {};
const initialConfig: Record<string, unknown> = {};
let adminToken = "";
let project = "d";
let coachCtx: BrowserContext;
let adaCtx: BrowserContext;
let coachPage: Page;
let adaPage: Page;
let inviteCode = "";
let lastSignupAt = 0;

function istanbulDay(offset = 0): string {
  const now = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(now);
}

function serviceSql(sql: string): string {
  return execFileSync("docker", [
    "exec", "mentor-postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "mentor", "-d", "mentor_test",
    "-Atc", `begin; select set_config('app.role','SERVICE',true); ${sql} commit;`,
  ]).toString();
}

async function throttled<T extends { status(): number }>(call: () => Promise<T>): Promise<T> {
  let response = await call();
  // Signup is 5/min and login 10/min per IP; earlier runs share the window.
  if (response.status() === 429) {
    await new Promise((resolve) => setTimeout(resolve, 62_000));
    response = await call();
  }
  return response;
}

async function ensureAccount(
  request: APIRequestContext,
  label: string,
  displayName: string,
  intent: "STUDENT" | "COACH" = "STUDENT",
): Promise<Account> {
  const email = `qa-mf-${runId}-${label}@example.test`;
  const username = `qmf_${runId}_${label}`;
  let response = await throttled(() => request.post(`${api}/auth/login`, { data: { email, password } }));
  if (response.status() === 401) {
    response = await throttled(() =>
      request.post(`${api}/auth/signup`, {
        data: {
          email, password, displayName, username,
          kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true, intent,
        },
      }),
    );
    expect(response.status(), await response.text()).toBe(201);
    lastSignupAt = Date.now();
  } else {
    expect(response.status(), await response.text()).toBe(200);
  }
  const body = (await response.json()) as { accessToken: string; user: { id: string } };
  const refreshCookies = (await request.storageState()).cookies.filter(
    (cookie) => cookie.name === "mentor_web_refresh",
  );
  expect(refreshCookies).toHaveLength(1);
  return { email, username, id: body.user.id, displayName, token: body.accessToken, refreshCookies };
}

function auth(account: Account) {
  return { Authorization: `Bearer ${account.token}` };
}

async function setConfig(request: APIRequestContext, key: string, value: unknown) {
  const response = await request.patch(`${api}/admin/config/${key}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { value },
  });
  expect(response.status(), `${key}: ${await response.text()}`).toBe(200);
}

async function acknowledgeJourneyLevels(request: APIRequestContext, account: Account) {
  const pending = await request.get(`${api}/community/journey-levels/unseen`, { headers: auth(account) });
  if (pending.status() !== 200) return;
  const { celebrations } = (await pending.json()) as { celebrations: Array<{ id: string }> };
  for (const { id } of celebrations) {
    await request.post(`${api}/community/journey-levels/celebrated`, {
      headers: auth(account),
      data: { celebrationId: id },
    });
  }
}

async function notifications(request: APIRequestContext, account: Account): Promise<Notification[]> {
  const response = await request.get(`${api}/notifications?page=1`, { headers: auth(account) });
  expect(response.status()).toBe(200);
  return ((await response.json()) as { items: Notification[] }).items;
}

async function planTasksOn(request: APIRequestContext, account: Account, date: string): Promise<PlanTask[]> {
  const response = await request.get(`${api}/plan-tasks?date=${date}`, { headers: auth(account) });
  expect(response.status()).toBe(200);
  return ((await response.json()) as { items: PlanTask[] }).items;
}

/** Polls the inbox: listeners run after the write's response (best-effort, async). */
async function expectNotification(
  request: APIRequestContext,
  account: Account,
  match: (n: Notification) => boolean,
  what: string,
) {
  await expect
    .poll(async () => (await notifications(request, account)).some(match), {
      message: `${account.displayName} should receive: ${what}`,
      timeout: 20_000,
    })
    .toBe(true);
}

async function newContext(browser: Browser, account?: Account): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: test.info().project.use.viewport,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    // Screens fade and slide in; evidence screenshots must show the settled page.
    reducedMotion: "reduce",
  });
  if (account) await context.addCookies(account.refreshCookies);
  return context;
}

/**
 * Opens a day on the student's plan the way a person does: the week arrows and the day chip.
 * (`/plan?date=` is how notifications come in; M06 covers that door.)
 */
async function openPlanDay(page: Page, isoDate: string) {
  const day = new Date(`${isoDate}T12:00:00Z`);
  const chip = `${["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cts"][day.getUTCDay()]} ${day.getUTCDate()}`;
  await page.goto("/plan");
  await expect(page.getByRole("button", { name: "Sonraki hafta" })).toBeVisible({ timeout: 20_000 });
  const button = page.getByRole("button", { name: chip, exact: true });
  if (!(await button.isVisible())) {
    await page.getByRole("button", { name: isoDate < istanbulDay() ? "Önceki hafta" : "Sonraki hafta" }).click();
  }
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: `../../docs/qa/evidence/${evidenceDate}-mentorship-flows-${name}-${project}.png`,
    fullPage: true,
  });
}

test.beforeAll(async ({ browser, request }, testInfo) => {
  test.setTimeout(600_000); // Signup throttling may cost a minute per extra account.
  project = testInfo.project.name.startsWith("mobile") ? "m" : "d";

  accounts.admin = await ensureAccount(request, "admin", "QA Admin");
  serviceSql(`update users set roles=array_append(roles,'SUPER_ADMIN')
    where id='${accounts.admin.id}' and array_position(roles,'SUPER_ADMIN') is null;`);
  const adminLogin = await throttled(() =>
    request.post(`${api}/auth/admin/login`, { data: { email: accounts.admin!.email, password } }),
  );
  expect(adminLogin.status()).toBe(200);
  adminToken = ((await adminLogin.json()) as { accessToken: string }).accessToken;

  const config = await request.get(`${api}/admin/config`, { headers: { Authorization: `Bearer ${adminToken}` } });
  expect(config.status()).toBe(200);
  const entries = (await config.json()) as Array<{ key: string; value: unknown }>;
  for (const key of FLAG_KEYS) initialConfig[key] = entries.find((entry) => entry.key === key)?.value;
  await setConfig(request, "mentorship.enabled", true);
  await setConfig(request, "mentorship.applications.open", true);
  await setConfig(request, "mentorship.followups.enabled", true);
  await setConfig(request, "mentorship.weekly_reports.enabled", true);
  await setConfig(request, "mentorship.coach.free_seats", 3);

  // Coaches register themselves (APP-089): COACH intent at signup, then the registry row.
  for (const [label, name] of [[`${project}coach`, "Selin Aydın"], [`${project}coach2`, "Murat Er"]] as const) {
    const coach = await ensureAccount(request, label, name, "COACH");
    const registration = await request.post(`${api}/mentorship/coach-registration`, {
      headers: auth(coach),
      data: {
        headline: "KPSS Türkçe ve paragraf koçu",
        bio: "Sekiz yıldır KPSS adaylarına haftalık program ve deneme takibi yapıyorum.",
      },
    });
    expect([201, 409], await registration.text()).toContain(registration.status());
    // Email verification is what unlocks the invite code; the inbox is not part of this test.
    serviceSql(`update users set email_verified_at=coalesce(email_verified_at, now()) where id='${coach.id}';`);
    accounts[label === `${project}coach` ? "coach" : "coach2"] = coach;
  }

  for (const [key, name] of [["ada", "Ada Yılmaz"], ["ece", "Ece Demir"]] as const) {
    const student = await ensureAccount(request, `${project}${key}`, name);
    const profile = await request.patch(`${api}/users/me`, {
      headers: auth(student),
      data: { examType: "KPSS", examVariant: "LISANS" },
    });
    expect(profile.status()).toBe(200);
    accounts[key] = student;
  }

  // Leftovers of an interrupted run: nobody starts linked.
  for (const key of ["ada", "ece"]) {
    await request.delete(`${api}/mentorship/my-coach`, { headers: auth(accounts[key]!) });
  }
  for (const key of ["admin", "coach", "coach2", "ada", "ece"]) {
    await acknowledgeJourneyLevels(request, accounts[key]!);
  }

  coachCtx = await newContext(browser, accounts.coach!);
  adaCtx = await newContext(browser, accounts.ada!);
  coachPage = await coachCtx.newPage();
  adaPage = await adaCtx.newPage();
});

test.afterAll(async ({ request }) => {
  await coachCtx?.close();
  await adaCtx?.close();
  for (const key of ["ada", "ece", "fresh"]) {
    if (accounts[key]) await request.delete(`${api}/mentorship/my-coach`, { headers: auth(accounts[key]!) });
  }
  if (adminToken) {
    for (const key of FLAG_KEYS) {
      if (initialConfig[key] !== undefined) await setConfig(request, key, initialConfig[key]);
    }
  }
});

test("M01 koç davet kodunu üretir, kod maskeli durur ve koltuk kartı doğru sayar", async ({ request }) => {
  await coachPage.goto("/kocluk");
  // A coach with nobody yet gets the invite as the page's hero; later it lives in the rail.
  const card = coachPage.getByRole("region", { name: /İlk öğrencini davet et|Davet ve koltuklar/ });
  await expect(card.getByText("İlk 3 öğrencin ücretsiz koltukta.")).toBeVisible({ timeout: 20_000 });
  const create = card.getByRole("button", { name: "Kod oluştur" });
  await expect(create.or(card.getByText(/MENTOR-KOC-/).first())).toBeVisible();
  if (await create.isVisible()) await create.click();
  await expect(card.getByText(/MENTOR-KOC-•+/)).toBeVisible();
  await card.getByRole("button", { name: "Kodu göster" }).click();
  const overview = await request.get(`${api}/mentorship/overview`, { headers: auth(accounts.coach!) });
  expect(overview.status()).toBe(200);
  const state = (await overview.json()) as {
    inviteCode: { code: string } | null; activeStudents: number; seatAllowance: number;
  };
  expect(state.inviteCode?.code).toMatch(/^MENTOR-KOC-/);
  inviteCode = state.inviteCode!.code;
  await expect(card.getByText(inviteCode)).toBeVisible();
  expect(state.activeStudents).toBe(0);
  expect(state.seatAllowance).toBe(3);
  await expect(card.getByRole("button", { name: "Davet linkini kopyala" })).toBeVisible();
  await shot(coachPage, "coach-invite");
});

test("M02 öğrenci linkle önizler, onay metnini okur, açıkça kabul edince bağlanır", async ({ request }) => {
  const ada = accounts.ada!;
  await adaPage.goto(`/kocluk-daveti?code=${inviteCode}`);
  await expect(adaPage.getByLabel("Davet kodu")).toHaveValue(inviteCode);
  // Following a link is not consent: nothing is looked up or linked on load.
  const before = await request.get(`${api}/mentorship/my-coach`, { headers: auth(ada) });
  expect(await before.text()).toBe("");

  await adaPage.getByRole("button", { name: "Kodu getir" }).click();
  await expect(adaPage.getByRole("region", { name: "Selin Aydın" })).toContainText(
    "Seni öğrencisi olarak takip etmek istiyor",
  );
  await expect(adaPage.getByText("KPSS Türkçe ve paragraf koçu")).toBeVisible();
  await expect(adaPage.getByRole("heading", { name: "Koçun görecekleri" })).toBeVisible();
  await expect(adaPage.getByRole("heading", { name: "Koçun göremeyecekleri" })).toBeVisible();
  await shot(adaPage, "student-consent");

  await adaPage.getByRole("button", { name: "Onaylıyorum, bağlan" }).click();
  await expect(adaPage).toHaveURL(/\/kocum$/);
  await expect(adaPage.getByText("Selin Aydın").first()).toBeVisible();
  await expect(adaPage.getByText(/tarihinden beri/)).toBeVisible();
  await shot(adaPage, "student-my-coach");

  await expectNotification(
    request, accounts.coach!,
    (n) => n.title === "Yeni öğrencin var" && n.body.includes("Ada Yılmaz"), "öğrenci katıldı",
  );
  const overview = await request.get(`${api}/mentorship/overview`, { headers: auth(accounts.coach!) });
  const state = (await overview.json()) as { activeStudents: number; usedSeats: number };
  expect(state).toMatchObject({ activeStudents: 1, usedSeats: 1 });
});

test("M03 koç öğrenciyi listede görür ve öğrencinin çalışma alanını açar", async ({ request }) => {
  await coachPage.goto("/kocluk");
  const row = coachPage.getByRole("link", { name: /Ada Yılmaz/ }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await shot(coachPage, "coach-roster");
  await row.click();
  await expect(coachPage).toHaveURL(new RegExp(`/kocluk/${accounts.ada!.id}$`));
  await expect(coachPage.getByRole("heading", { name: "Ada Yılmaz" })).toBeVisible({ timeout: 20_000 });
  await expect(coachPage.getByRole("button", { name: "Haftayı planla" }).first()).toBeVisible();
  await shot(coachPage, "coach-student");

  // The student joined a minute ago and has recorded nothing yet: not silent for the window (F3).
  const roster = await request.get(`${api}/mentorship/students?status=ACTIVE`, { headers: auth(accounts.coach!) });
  const joined = ((await roster.json()) as { items: Array<{ studentId: string; riskFlags: string[] }> }).items
    .find((item) => item.studentId === accounts.ada!.id)!;
  expect(joined.riskFlags).not.toContain("INACTIVE");
  await expect(coachPage.getByText("Sessiz", { exact: true })).toHaveCount(0);
});

test("M04 koç haftayı planlar; öğrenci görevi koç notuyla görür, içeriğini değiştiremez", async ({ request }) => {
  await coachPage.getByRole("button", { name: "Haftayı planla" }).first().click();
  const panel = coachPage.getByRole("dialog", { name: "Haftayı planla" });
  await expect(panel).toBeVisible();
  await panel.getByLabel("Görev", { exact: true }).fill("QA paragraf 20 soru");
  await panel.getByLabel("Notun (isteğe bağlı)").fill("Süre tut, yanlışları işaretle.");
  await panel.getByRole("button", { name: "Taslağa ekle" }).click();
  await panel.getByRole("button", { name: "1 görevi planına ekle" }).click();
  await expect(coachPage.getByText("Program eklendi").first()).toBeVisible();

  const isAssigned = (n: Notification) => n.title === "Koçundan bir görev" && (n.linkUrl ?? "").startsWith("/plan?date=");
  await expectNotification(request, accounts.ada!, isAssigned, "koç görev verdi");
  const assigned = (await notifications(request, accounts.ada!)).find(isAssigned)!;
  const taskDate = new URL(`http://x${assigned.linkUrl}`).searchParams.get("date")!;

  await openPlanDay(adaPage, taskDate);
  await expect(adaPage.getByText("QA paragraf 20 soru").first()).toBeVisible({ timeout: 20_000 });
  await expect(adaPage.getByText("Süre tut, yanlışları işaretle.").first()).toBeVisible();
  await shot(adaPage, "student-plan-coach-task");

  const task = (await planTasksOn(request, accounts.ada!, taskDate)).find((t) => t.title === "QA paragraf 20 soru")!;
  expect(task.origin?.type).toBe("MENTORSHIP");
  const edit = await request.patch(`${api}/plan-tasks/${task.id}`, {
    headers: auth(accounts.ada!), data: { title: "kendi başlığım" },
  });
  expect(edit.status()).toBe(403);
  const menu = adaPage.getByRole("button", { name: "QA paragraf 20 soru için seçenekler" }).first();
  if (await menu.isVisible()) {
    await menu.click();
    await expect(adaPage.getByRole("menuitem", { name: "Görevi düzenle" })).toHaveCount(0);
    await adaPage.keyboard.press("Escape");
  }
});

test("M05 öğrenci koç görevini tamamlar; koç ilerleme bildirimi alır, raporda bitti görünür", async ({ request }) => {
  const ada = accounts.ada!;
  const today = istanbulDay();
  await acknowledgeJourneyLevels(request, ada);
  await openPlanDay(adaPage, today);
  const box = adaPage.getByRole("checkbox", { name: "QA paragraf 20 soru" }).first();
  await expect(box).toBeVisible({ timeout: 20_000 });
  await box.click();
  await expect(box).toHaveAttribute("aria-checked", "true");

  await expectNotification(
    request, accounts.coach!, (n) => n.title === "Ada Yılmaz ödevini tamamladı", "öğrenci ödevi bitirdi",
  );
  const report = await request.get(`${api}/mentorship/students/${ada.id}`, { headers: auth(accounts.coach!) });
  expect(report.status()).toBe(200);
  const body = (await report.json()) as { planTasks: Array<{ title: string; status: string }> };
  expect(body.planTasks.find((t) => t.title === "QA paragraf 20 soru")?.status).toBe("DONE");
});

test("M06 ileri tarihli ödev bildirimi öğrenciyi görevin gününe götürür", async ({ request }) => {
  // Every student plan notification links to `/plan?date=`; until 2026-09-27 the plan ignored it.
  const ada = accounts.ada!;
  const tomorrow = istanbulDay(1);
  const assign = await request.post(`${api}/mentorship/students/${ada.id}/assignments`, {
    headers: auth(accounts.coach!),
    data: { tasks: [{ title: "QA yarınki okuma görevi", taskDate: tomorrow }] },
  });
  expect(assign.status(), await assign.text()).toBe(201);
  const isFuture = (n: Notification) => n.title === "Koçundan bir görev" && n.linkUrl === `/plan?date=${tomorrow}`;
  await expectNotification(request, ada, isFuture, "yarına ödev");

  await acknowledgeJourneyLevels(request, ada);
  await adaPage.goto(`/plan?date=${tomorrow}`);
  // The plan keeps a live stream open, so "networkidle" never comes; wait for the loaded day.
  await expect(adaPage.getByRole("button", { name: "Sonraki hafta" })).toBeVisible({ timeout: 20_000 });
  await expect(adaPage.getByRole("heading", { name: "Görevler" })).toBeVisible();
  await shot(adaPage, "student-notification-link-future-task");
  await expect(adaPage.getByText("QA yarınki okuma görevi").first()).toBeVisible({ timeout: 8_000 });
});

test("M06b koçun öğrenciyle kurduğu görüşme öğrencinin planında görünür", async ({ request }) => {
  // Until 2026-09-27 a meeting reached the student as a notification and nowhere else.
  const ada = accounts.ada!;
  const tomorrow = istanbulDay(1);
  const created = await request.post(`${api}/mentorship/events`, {
    headers: auth(accounts.coach!),
    data: {
      title: "QA haftalık görüşme", eventDate: tomorrow, startTime: "18:00", endTime: "18:30",
      attendeeIds: [ada.id],
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const isEvent = (n: Notification) =>
    n.title === "Planına bir etkinlik eklendi" && n.body.includes("QA haftalık görüşme");
  await expectNotification(request, ada, isEvent, "koç görüşme ekledi");
  const items = await request.get(`${api}/plan-items?date=${tomorrow}`, { headers: auth(ada) });
  test.info().annotations.push({ type: "student-plan-items", description: (await items.text()).slice(0, 500) });

  const link = (await notifications(request, ada)).find(isEvent)!.linkUrl!;
  await adaPage.goto(link);
  await expect(adaPage.getByRole("button", { name: "Sonraki hafta" })).toBeVisible({ timeout: 20_000 });
  await expect(adaPage.getByText("QA haftalık görüşme").first()).toBeVisible({ timeout: 8_000 });
  await expect(adaPage.getByRole("dialog", { name: "Etkinlik detayı" })).toBeVisible();
  await shot(adaPage, "student-plan-coach-event");
});

test("M07 koç not bırakır; öğrenci Koçum'da okur ve bildirim alır", async ({ request }) => {
  const ada = accounts.ada!;
  await coachPage.goto(`/kocluk/${ada.id}`);
  await coachPage.getByRole("button", { name: "Not bırak" }).click();
  const field = coachPage.getByRole("textbox", { name: /Ada'ya notun/ });
  await field.fill("Bu hafta paragrafa ağırlık ver, cuma denemeden sonra konuşalım.");
  await coachPage.getByRole("button", { name: "Notu kaydet" }).click();
  await expect(
    coachPage.getByRole("region", { name: "Notun" }).getByText("Bu hafta paragrafa ağırlık ver, cuma denemeden sonra konuşalım."),
  ).toBeVisible();

  await expectNotification(request, ada, (n) => n.title === "Koçundan bir not", "koç not bıraktı");
  await adaPage.goto("/kocum");
  await expect(adaPage.getByRole("heading", { name: "Koçundan not" })).toBeVisible({ timeout: 20_000 });
  await expect(adaPage.getByText("Bu hafta paragrafa ağırlık ver, cuma denemeden sonra konuşalım.")).toBeVisible();
});

test("M08 takip kaydı: öğrenci yalnız ortak kararı görür, kabul eder; koç yanıtı alır", async ({ request }) => {
  const ada = accounts.ada!;
  const secret = `ozel-${runId}-${project}`;
  await coachPage.goto(`/kocluk/${ada.id}`);
  await coachPage.getByRole("region", { name: "Takip" }).getByRole("button", { name: "Yeni kayıt" }).click();
  const panel = coachPage.getByRole("dialog", { name: "Takip" });
  await panel.getByLabel(/Aksiyon başlığı/).fill(`Paragraf hızı ${secret}`);
  await panel.getByLabel(/Koça özel not/).fill(`Ailesiyle ilgili konuştuk ${secret}`);
  await panel.getByLabel(/Ortak karar/).fill("Her gün 20 paragraf; cuma birlikte bakalım.");
  await panel.getByRole("button", { name: "Kaydet ve ortak kararı öğrenciyle paylaş" }).click();

  await expectNotification(request, ada, (n) => n.title === "Koçun bir karar paylaştı", "ortak karar paylaşıldı");
  const mine = await request.get(`${api}/mentorship/my-coach/followups`, { headers: auth(ada) });
  expect(mine.status()).toBe(200);
  expect(JSON.stringify(await mine.json())).not.toContain(secret);

  await adaPage.goto("/kocum");
  await expect(adaPage.getByText("Her gün 20 paragraf; cuma birlikte bakalım.")).toBeVisible({ timeout: 20_000 });
  await expect(adaPage.locator("body")).not.toContainText(secret);
  await adaPage.getByRole("button", { name: "Kabul et" }).click();
  await expect(adaPage.getByText("Kabul ettin").first()).toBeVisible();
  await shot(adaPage, "student-followup");

  await expectNotification(
    request, accounts.coach!, (n) => n.title === "Öğrencin takip kararına yanıt verdi", "öğrenci kararı yanıtladı",
  );
  // The coach's page, open all along, hears it on the live stream and reads the answer (O3).
  await expect(coachPage.getByText("Kabul etti").first()).toBeVisible({ timeout: 15_000 });
});

test("M09 öğrenci koç ödevini siler; koç başlığıyla haber alır, rapor silineni tutar", async ({ request }) => {
  const ada = accounts.ada!;
  const today = istanbulDay();
  const assign = await request.post(`${api}/mentorship/students/${ada.id}/assignments`, {
    headers: auth(accounts.coach!),
    data: { tasks: [{ title: "QA silinecek deneme analizi", taskDate: today }] },
  });
  expect(assign.status(), await assign.text()).toBe(201);

  await acknowledgeJourneyLevels(request, ada);
  await adaPage.goto("/plan");
  await adaPage.getByRole("button", { name: "QA silinecek deneme analizi için seçenekler" }).first().click();
  await adaPage.getByRole("menuitem", { name: "Sil" }).click();
  await adaPage.getByRole("button", { name: "Evet, sil" }).click();
  await expect(adaPage.getByText("QA silinecek deneme analizi")).toHaveCount(0);

  await expectNotification(
    request, accounts.coach!,
    (n) => n.title === "Ada Yılmaz bir ödevi planından çıkardı" && n.body.includes("QA silinecek deneme analizi"),
    "öğrenci ödevi sildi",
  );
  const report = await request.get(`${api}/mentorship/students/${ada.id}`, { headers: auth(accounts.coach!) });
  const body = (await report.json()) as { droppedAssignments: Array<{ title: string }> };
  expect(body.droppedAssignments.map((d) => d.title)).toContain("QA silinecek deneme analizi");
});

test("M10 öğrencinin çalışması ve ruh hali koça yansır; Koçum ne gittiğini sayıyla gösterir", async ({ request }) => {
  const ada = accounts.ada!;
  const started = await request.post(`${api}/study-sessions`, {
    headers: auth(ada),
    data: { preset: "25_5", startedAt: new Date(Date.now() - 30 * 60_000).toISOString() },
  });
  expect(started.status(), await started.text()).toBe(201);
  const session = (await started.json()) as { id: string };
  const finished = await request.patch(`${api}/study-sessions/${session.id}`, {
    headers: auth(ada), data: { status: "COMPLETED", actualFocusSeconds: 25 * 60 },
  });
  expect(finished.status(), await finished.text()).toBe(200);
  const mood = await request.post(`${api}/coaching/mood-checkins`, { headers: auth(ada), data: { mood: 2 } });
  // One check-in per day (an upsert), so 200 as well as 201.
  expect([200, 201], await mood.text()).toContain(mood.status());

  const after = await request.get(`${api}/mentorship/students?status=ACTIVE`, { headers: auth(accounts.coach!) });
  const row = ((await after.json()) as {
    items: Array<{ studentId: string; riskFlags: string[]; metrics: { dailyFocusMinutes14d: number[] } | null }>;
  }).items.find((item) => item.studentId === ada.id)!;
  expect(row.metrics?.dailyFocusMinutes14d.at(-1)).toBeGreaterThanOrEqual(25);
  expect(row.riskFlags).not.toContain("INACTIVE");
  expect(row.riskFlags).toContain("LOW_MOOD");
  // The student's raw words never travel; only the level does.
  expect(JSON.stringify(row)).not.toContain("struggleNote");

  await coachPage.goto(`/kocluk/${ada.id}`);
  await expect(coachPage.getByRole("heading", { name: "Ada Yılmaz" })).toBeVisible({ timeout: 20_000 });
  const mark = coachPage.getByRole("button", { name: "İlgilendim", exact: true });
  await expect(mark).toHaveAttribute("aria-pressed", "false");
  await mark.click();
  await expect(mark).toHaveAttribute("aria-pressed", "true");
  await shot(coachPage, "coach-student-active");

  await adaPage.goto("/kocum");
  const scope = adaPage.getByRole("region", { name: "Koçunun gördükleri" });
  await expect(scope).toContainText(/\d/, { timeout: 20_000 });
  await shot(adaPage, "student-my-coach-data");
});

test("M10b koçun kesinleştirdiği hafta öğrenciye ulaşır: bildirim raporu açar, Koçum listeler", async ({ request }) => {
  const ada = accounts.ada!;
  const coach = accounts.coach!;
  const preview = await request.get(`${api}/mentorship/students/${ada.id}/weekly-reports/preview`, {
    headers: auth(coach),
  });
  expect(preview.status(), await preview.text()).toBe(200);
  const draft = (await preview.json()) as { snapshot: { period: { startDate: string } }; sourceFingerprint: string };
  const evaluation = `Ritmi birlikte koruyalım ${runId}.`;
  const finalized = await request.post(`${api}/mentorship/students/${ada.id}/weekly-reports/finalize`, {
    headers: auth(coach),
    data: {
      weekStart: draft.snapshot.period.startDate,
      sourceFingerprint: draft.sourceFingerprint,
      operationId: randomUUID(),
      coachEvaluation: evaluation,
      replacesId: null,
    },
  });
  expect([200, 201], await finalized.text()).toContain(finalized.status());
  const reportId = ((await finalized.json()) as { id: string }).id;

  const isShared = (n: Notification) => n.linkUrl === `/my-coach/weekly-reports/${reportId}`;
  await expectNotification(request, ada, isShared, "koç haftayı değerlendirdi");
  // The student's copy is the printout's: no coach brief, no evidence (F5).
  const mine = await request.get(`${api}/mentorship/my-coach/weekly-reports/${reportId}`, { headers: auth(ada) });
  expect(mine.status()).toBe(200);
  expect(JSON.stringify(await mine.json())).not.toMatch(/"brief"|"evidence"|coachContext/);

  await adaPage.goto((await notifications(request, ada)).find(isShared)!.linkUrl!);
  await expect(adaPage.getByRole("heading", { name: "Haftalık değerlendirmen" })).toBeVisible({ timeout: 20_000 });
  await expect(adaPage.getByText(evaluation)).toBeVisible();
  await expect(adaPage.getByRole("region", { name: "Selin Aydın" })).toContainText("Koçunun değerlendirmesi");
  await shot(adaPage, "student-weekly-report");

  await adaPage.goto("/kocum");
  const card = adaPage.getByRole("region", { name: "Haftalık değerlendirmelerin" });
  await expect(card.getByRole("link")).toHaveCount(1, { timeout: 20_000 });
});

test("M10c öğrenci Koçum'dan koçuna not bırakır; koç haber alır ve raporda okur", async ({ request }) => {
  const ada = accounts.ada!;
  const coach = accounts.coach!;
  const note = `Cuma akşamları çalışamıyorum ${runId}.`;
  await adaPage.goto("/kocum");
  const card = adaPage.getByRole("region", { name: "Koçuna notun" });
  await card.getByRole("button", { name: "Not yaz" }).click({ timeout: 20_000 });
  await card.getByRole("textbox", { name: "Koçuna notun", exact: true }).fill(note);
  await card.getByRole("button", { name: "Notu kaydet" }).click();
  await expect(card.getByText(note)).toBeVisible({ timeout: 20_000 });
  await shot(adaPage, "student-note-to-coach");

  const isNote = (n: Notification) => n.title === "Ada Yılmaz sana not bıraktı" && n.linkUrl === `/students/${ada.id}`;
  await expectNotification(request, coach, isNote, "öğrenci not bıraktı");
  await coachPage.goto((await notifications(request, coach)).find(isNote)!.linkUrl!);
  await expect(coachPage.getByRole("region", { name: "Ada'nın notu" }).getByText(note)).toBeVisible({ timeout: 20_000 });
  await shot(coachPage, "coach-reads-student-note");
});

test("M11 sınırlar: bağsız öğrenci 404; ikinci koça bağlanamaz; koltuk doluysa net söylenir", async ({ browser, request }) => {
  const coach = accounts.coach!;
  const ece = accounts.ece!;
  expect((await request.get(`${api}/mentorship/students/${ece.id}`, { headers: auth(coach) })).status()).toBe(404);

  const issued = await request.post(`${api}/mentorship/invite-code`, { headers: auth(accounts.coach2!) });
  expect(issued.status(), await issued.text()).toBe(200);
  const otherCode = ((await issued.json()) as { code: string }).code;
  await adaPage.goto(`/kocluk-daveti?code=${otherCode}`);
  // Told up front, before reading a consent she cannot give; the API refuses a second coach anyway.
  await expect(adaPage.getByText(/Zaten bir koçun var: Selin Aydın/)).toBeVisible({ timeout: 20_000 });
  await adaPage.getByRole("button", { name: "Kodu getir" }).click();
  await expect(adaPage.getByRole("region", { name: "Murat Er" })).toContainText(
    "Seni öğrencisi olarak takip etmek istiyor",
  );
  await expect(adaPage.getByRole("button", { name: "Onaylıyorum, bağlan" })).toHaveCount(0);
  await expect(adaPage.getByText("Murat Er'e bağlanmak için önce Koçum'dan Selin Aydın ile", { exact: false })).toBeVisible();
  const second = await request.post(`${api}/mentorship/invitations/accept`, {
    headers: auth(accounts.ada!), data: { code: otherCode },
  });
  expect(second.status()).toBe(409);
  await shot(adaPage, "student-already-linked");

  await setConfig(request, "mentorship.coach.free_seats", 1);
  const eceCtx = await newContext(browser, ece);
  try {
    const page = await eceCtx.newPage();
    await page.goto(`/kocluk-daveti?code=${inviteCode}`);
    await page.getByRole("button", { name: "Kodu getir" }).click();
    await page.getByRole("button", { name: "Onaylıyorum, bağlan" }).click();
    await expect(page.getByText(/Koçunun koltukları şu an dolu/)).toBeVisible();
    await shot(page, "student-seats-full");
    const mine = await request.get(`${api}/mentorship/my-coach`, { headers: auth(ece) });
    expect(await mine.text()).toBe("");
    ece.refreshCookies = (await eceCtx.cookies()).filter((c) => c.name === "mentor_web_refresh");
  } finally {
    await eceCtx.close();
    await setConfig(request, "mentorship.coach.free_seats", 3);
  }
});

test("M12 dönen öğrenci: çıkışlıyken davet linki → giriş → koduyla davete döner", async ({ browser }) => {
  const ece = accounts.ece!;
  const context = await newContext(browser);
  try {
    const page = await context.newPage();
    await page.goto(`/kocluk-daveti?code=${inviteCode}`);
    await expect(page).toHaveURL(/\/giris\?next=/, { timeout: 20_000 });
    await page.getByLabel("E-posta").fill(ece.email);
    await page.getByLabel("Şifre", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page).toHaveURL(new RegExp(`/kocluk-daveti\\?code=${inviteCode}`), { timeout: 20_000 });
    await expect(page.getByLabel("Davet kodu")).toHaveValue(inviteCode);
  } finally {
    await context.close();
  }
});

test("M13 yeni öğrenci: davet linki → kayıt → başlangıç → davet koduna geri döner", async ({ browser }) => {
  // Until 2026-09-27 the invite was lost here and the new student landed on /panel.
  const stamp = Date.now().toString(36).slice(-4);
  const email = `qa-mf-${runId}-${project}fresh-${stamp}@example.test`;
  const wait = lastSignupAt + 62_000 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait)); // signup is 5/min
  const context = await newContext(browser);
  const trail: string[] = [];
  try {
    const page = await context.newPage();
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) trail.push(new URL(frame.url()).pathname + new URL(frame.url()).search);
    });
    await page.goto(`/kocluk-daveti?code=${inviteCode}`);
    await expect(page).toHaveURL(/\/giris\?next=/, { timeout: 20_000 });
    await page.getByRole("link", { name: "Hesap oluştur" }).click();
    await expect(page).toHaveURL(/\/kayit/);
    await page.getByLabel("Ad Soyad").fill("Deniz Kaya");
    await page.getByLabel("E-posta").fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("checkbox", { name: /KVKK aydınlatma/ }).click();
    await page.getByRole("checkbox", { name: /Kullanım Koşulları/ }).click();
    await page.getByRole("button", { name: "Kayıt ol" }).click();
    await expect(page).toHaveURL(/\/baslangic/, { timeout: 30_000 });

    // Onboarding: pick KPSS, then take the first choice of every question until the summary.
    await page.getByRole("button", { name: "Devam", exact: true }).click();
    await page.getByRole("radio", { name: "KPSS" }).click();
    await page.getByRole("button", { name: "Devam", exact: true }).click();
    for (let step = 0; step < 10; step += 1) {
      if (await page.getByRole("heading", { name: "Yolun hazır." }).isVisible()) break;
      const username = page.getByLabel("Kullanıcı adı");
      if (await username.isVisible()) {
        await username.fill(`qmf_${runId}_${project}f${stamp}`);
      } else {
        const radio = page.getByRole("radio").first();
        if (await radio.isVisible()) await radio.click();
      }
      await page.getByRole("button", { name: /^Devam/ }).first().click();
      await page.waitForTimeout(400);
    }
    await expect(page.getByRole("heading", { name: "Yolun hazır." })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Panele git" }).click();
    await page.waitForURL((url) => !url.pathname.includes("/baslangic"), { timeout: 20_000 });
    await page.waitForTimeout(3_000); // let any client-side redirect after onboarding land
    test.info().annotations.push({ type: "navigation-trail", description: trail.join(" → ") });
    await shot(page, "fresh-student-after-onboarding");
    // Expected: the coach's link survives signup and onboarding, as a study-room link does.
    await expect(page).toHaveURL(new RegExp(`/kocluk-daveti\\?code=${inviteCode}`));
  } finally {
    await context.close();
  }
});

test("M14 öğrenci bağı sonlandırır; koç haber alır, erişimi kapanır; bekleyen ödevler öğrencinin olur", async ({ request }) => {
  const ada = accounts.ada!;
  const coach = accounts.coach!;
  const tomorrow = istanbulDay(1);
  const assign = await request.post(`${api}/mentorship/students/${ada.id}/assignments`, {
    headers: auth(coach),
    data: { tasks: [{ title: "QA gelecek hafta programı", taskDate: tomorrow, coachNote: "Koçun notu" }] },
  });
  expect(assign.status(), await assign.text()).toBe(201);

  await adaPage.goto("/kocum");
  await adaPage.getByRole("button", { name: "Bağlantıyı sonlandır" }).click();
  await adaPage.getByRole("dialog").getByRole("button", { name: "Sonlandır" }).click();
  await expect(adaPage.getByText("Henüz bir koçun yok")).toBeVisible({ timeout: 20_000 });

  await expectNotification(
    request, coach, (n) => n.title === "Koçluk bağlantısı sona erdi" && n.body.includes("Ada Yılmaz"), "öğrenci ayrıldı",
  );
  expect((await request.get(`${api}/mentorship/students/${ada.id}`, { headers: auth(coach) })).status()).toBe(404);
  const ended = await request.get(`${api}/mentorship/students?status=ENDED`, { headers: auth(coach) });
  const endedRow = ((await ended.json()) as { items: Array<{ studentId: string; metrics: unknown }> }).items
    .find((row) => row.studentId === ada.id);
  expect(endedRow).toBeDefined();
  expect(endedRow!.metrics).toBeNull();

  // The coach's pending work stays in the plan as the student's own (F1): no mark, no note, editable.
  const task = (await planTasksOn(request, ada, tomorrow)).find((t) => t.title === "QA gelecek hafta programı")!;
  expect(task.origin ?? null).toBeNull();
  await openPlanDay(adaPage, tomorrow);
  await expect(adaPage.getByText("QA gelecek hafta programı").first()).toBeVisible({ timeout: 20_000 });
  // Every pending coach task of that day changed hands, so no badge and no coach note is left.
  await expect(adaPage.getByText("Koçundan", { exact: true })).toHaveCount(0);
  await expect(adaPage.getByText("Koçun notu", { exact: true })).toHaveCount(0);
  await adaPage.getByRole("button", { name: "QA gelecek hafta programı için seçenekler" }).first().click();
  await expect(adaPage.getByRole("menuitem", { name: "Görevi düzenle" })).toBeVisible();
  await adaPage.keyboard.press("Escape");
  await shot(adaPage, "student-plan-after-link-end");
  const edit = await request.patch(`${api}/plan-tasks/${task.id}`, { headers: auth(ada), data: { title: "Benim görevim" } });
  expect(edit.status()).toBe(200);
});

test("M15 yeniden bağlanan öğrenci temiz başlar; koç bağı sonlandırınca öğrenci haber alır", async ({ request }) => {
  const ada = accounts.ada!;
  await adaPage.goto(`/kocluk-daveti?code=${inviteCode}`);
  await adaPage.getByRole("button", { name: "Kodu getir" }).click();
  await adaPage.getByRole("button", { name: "Onaylıyorum, bağlan" }).click();
  await expect(adaPage).toHaveURL(/\/kocum$/, { timeout: 20_000 });
  // A new relationship period: the old note and the old shared decision stay in the old one.
  await expect(adaPage.getByRole("heading", { name: "Koçundan not" })).toHaveCount(0);
  await expect(adaPage.getByText("Her gün 20 paragraf; cuma birlikte bakalım.")).toHaveCount(0);
  // Her own note went with the old link too (F4): the card offers a new one.
  await expect(
    adaPage.getByRole("region", { name: "Koçuna notun" }).getByRole("button", { name: "Not yaz" }),
  ).toBeVisible();

  await coachPage.goto(`/kocluk/${ada.id}`);
  await coachPage.getByRole("button", { name: "Diğer işlemler" }).click();
  await coachPage.getByRole("menuitem", { name: "Bağlantıyı sonlandır" }).click();
  await coachPage.getByRole("dialog").getByRole("button", { name: "Sonlandır" }).click();
  await expect(coachPage).toHaveURL(/\/kocluk$/, { timeout: 20_000 });

  await expectNotification(
    request, ada,
    (n) => n.title === "Koçluk bağlantısı sona erdi" && n.body.includes("Selin Aydın"), "koç bağı sonlandırdı",
  );
  await adaPage.goto("/kocum");
  await expect(adaPage.getByText("Henüz bir koçun yok")).toBeVisible({ timeout: 20_000 });
});

test("M16 koç kodu yeniler; eski kod öğrenciye geçersiz olarak söylenir", async ({ request }) => {
  const oldCode = inviteCode;
  await coachPage.goto("/kocluk");
  await coachPage.getByRole("button", { name: "Kodu göster" }).first().waitFor({ timeout: 20_000 });
  await coachPage.getByRole("button", { name: "Yeni kod üret" }).first().click();
  await expect(coachPage.getByText("Yeni kod üretilsin mi?")).toBeVisible();
  await coachPage.getByRole("dialog").getByRole("button", { name: "Yeni kod üret" }).click();
  await expect
    .poll(async () => {
      const overview = await request.get(`${api}/mentorship/overview`, { headers: auth(accounts.coach!) });
      return ((await overview.json()) as { inviteCode: { code: string } | null }).inviteCode?.code;
    })
    .not.toBe(oldCode);

  const preview = await request.post(`${api}/mentorship/invitations/preview`, {
    headers: auth(accounts.ada!), data: { code: oldCode },
  });
  expect(preview.status()).toBe(404);
  await adaPage.goto(`/kocluk-daveti?code=${oldCode}`);
  await adaPage.getByRole("button", { name: "Kodu getir" }).click();
  await expect(adaPage.getByText("Bu davet kodu geçerli değil.")).toBeVisible();
});
