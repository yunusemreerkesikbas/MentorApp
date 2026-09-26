import { expect, test } from "@playwright/test";
import {
  ALI_ID,
  BRIEF_TEXT,
  followup,
  istanbulToday,
  mockStudentApi,
  newReport,
  richReport,
  shiftDay,
} from "./coach-student.fixture";

/**
 * The coach's student page (redesigned 2026-09-25): the week drawn day by day with one ledge, the
 * assistant speaking only for a coach whose plan includes it, the note edited in place, "Sıradaki"
 * walking the round the roster saved, and a failed load said in place.
 */

const ROUND_KEY = "mentor.coach-round";
const TODAY = istanbulToday();

test("hafta şeridi bu haftayı gün gün çizer ve koçun görevlerini sayar", async ({ page }) => {
  const minutes = Array<number>(28).fill(0);
  minutes[27] = 150;
  const task = (status: "DONE" | "PENDING", assignedByCoach = true) => ({
    taskDate: TODAY,
    title: `Görev ${status}`,
    subject: null,
    topic: null,
    status,
    assignedByCoach,
    coachNote: null,
  });
  await mockStudentApi(page, {
    reports: {
      [ALI_ID]: richReport({
        dailyFocusMinutes28d: minutes,
        planTasks: [task("DONE"), task("DONE"), task("PENDING"), task("PENDING"), task("DONE", false)],
      }),
    },
  });
  await page.goto(`/kocluk/${ALI_ID}`);

  const hero = page.getByTestId("week-hero");
  await expect(hero.getByRole("heading", { name: "Bu hafta 2 sa 30 dk çalıştı" })).toBeVisible();
  await expect(hero.getByRole("list", { name: "Bu hafta, gün gün" }).getByRole("listitem")).toHaveCount(7);
  await expect(hero.getByText("Bu hafta verdiğin 4 görevin 2 tanesi tamam.")).toBeVisible();
  // Today speaks its numbers; the drawing itself is hidden from a screen reader.
  await expect(hero.locator('li[aria-current="date"]')).toContainText("150 dk çalıştı.");
  await expect(hero.locator('li[aria-current="date"]')).toContainText(
    "Senin verdiğin 4 görevin 2 tanesi yapıldı.",
  );
  // One filled ledge on the page.
  await expect(page.getByRole("button", { name: "Haftayı planla" })).toHaveCount(1);
});

test("Koç Pro'da asistan kendiliğinden yazar; kapalıyken kural cümlesi kalır", async ({ page }) => {
  const calls = await mockStudentApi(page, { pro: true });
  await page.goto(`/kocluk/${ALI_ID}`);
  const hero = page.getByTestId("week-hero");
  await expect(hero.getByText(BRIEF_TEXT)).toBeVisible();
  await expect(hero.getByText("Asistanından")).toBeVisible();
  expect(calls.brief).toBeGreaterThan(0);
});

test("asistan kapalıyken çağrı gitmez ve işaretin kuralı söylenir", async ({ page }) => {
  const calls = await mockStudentApi(page, { pro: false });
  await page.goto(`/kocluk/${ALI_ID}`);
  const hero = page.getByTestId("week-hero");
  await expect(
    hero.getByText(
      "Son deneme, önceki denemelerin ortalamasının altında. Son denemenin ders kırılımına bak.",
    ),
  ).toBeVisible();
  await expect(hero.getByText("Asistanından")).toHaveCount(0);
  expect(calls.brief).toBe(0);
});

test("asistan hata verirse sessizce kural cümlesine döner", async ({ page }) => {
  const calls = await mockStudentApi(page, { pro: true, brief: "fail" });
  await page.goto(`/kocluk/${ALI_ID}`);
  const hero = page.getByTestId("week-hero");
  await expect(hero.getByText("Son denemenin ders kırılımına bak.", { exact: false })).toBeVisible();
  await expect(hero.getByText("Asistanından")).toHaveCount(0);
  await expect(page.getByText("Bir sorun oluştu")).toHaveCount(0);
  expect(calls.brief).toBeGreaterThan(0);
});

test("denemeler ders adlarıyla ve doğru/yanlış/boş parçalarıyla çizilir", async ({ page }) => {
  await mockStudentApi(page);
  await page.goto(`/kocluk/${ALI_ID}`);
  const mocks = page.getByRole("region", { name: "Denemeler" });
  await expect(mocks.getByText("74,5", { exact: true })).toBeVisible();
  await expect(mocks.getByText("Matematik", { exact: true })).toBeVisible();
  await expect(mocks.getByText("matematik", { exact: true })).toHaveCount(0);
  await expect(mocks.getByText("19 D · 5 Y · 6 B")).toBeVisible();
  await expect(mocks.getByRole("img", { name: "Matematik: 19 doğru, 5 yanlış, 6 boş, 17,75 net" })).toBeVisible();
});

test("not bırak notu yerinde açar ve öğrenciye giden tek kaydı gönderir", async ({ page }) => {
  const calls = await mockStudentApi(page);
  await page.goto(`/kocluk/${ALI_ID}`);
  await page.getByRole("button", { name: "Not bırak" }).click();

  const field = page.getByRole("textbox", { name: "Ali'ye notun" });
  await expect(field).toBeFocused();
  await field.fill("Cuma denemesinden sonra konuşalım.");
  await page.getByRole("button", { name: "Notu kaydet" }).click();

  await expect.poll(() => calls.note).toEqual(["Cuma denemesinden sonra konuşalım."]);
  const card = page.getByRole("region", { name: "Notun" });
  await expect(card.getByText("Cuma denemesinden sonra konuşalım.")).toBeVisible();
  await expect(card.getByRole("textbox")).toHaveCount(0);
});

test("ilgilendim işareti konur ve aynı yerden geri alınır", async ({ page }) => {
  const calls = await mockStudentApi(page);
  await page.goto(`/kocluk/${ALI_ID}`);
  // One name in both states (a toggle's label must not change); the state is `aria-pressed`, and
  // when the coach looked is said beside it.
  const toggle = page.getByRole("button", { name: "İlgilendim", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Bugün baktın", { exact: true })).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Bugün baktın", { exact: true })).toHaveCount(0);
  expect(calls.attention).toEqual([true, false]);
});

test("Sıradaki turun sırasını izler ve son öğrencide turu bitirir", async ({ page }) => {
  await page.addInitScript(
    ([key, value]) => window.sessionStorage.setItem(key, value),
    [
      ROUND_KEY,
      JSON.stringify([
        { studentId: "s-zeynep", name: "Zeynep" },
        { studentId: ALI_ID, name: "Ali" },
        { studentId: "s-ece", name: "Ece" },
      ]),
    ] as const,
  );
  await mockStudentApi(page);
  await page.goto(`/kocluk/${ALI_ID}`);
  const next = page.getByRole("link", { name: "Sıradaki öğrenci: Ece" });
  await expect(next).toBeVisible();
  await next.click();
  await expect(page).toHaveURL(/\/kocluk\/s-ece$/);
  // The last stop, whether or not the coach marked anyone: not a claim that the round is done.
  await expect(page.getByRole("link", { name: "Turun sonu" })).toBeVisible();
});

test("Sıradaki sayfayı ileri, Öğrencilerim geri kaydırır; yeni sayfa hemen tıklanır", async ({ page }) => {
  // Records the types React hands the browser's view transition, one entry per navigation.
  await page.addInitScript(() => {
    const seen: string[][] = [];
    Object.assign(window, { __viewTransitionTypes: seen });
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((options?: unknown) => {
      const types = (options as { types?: Iterable<string> } | undefined)?.types;
      seen.push(types ? [...types] : []);
      return start(options as Parameters<typeof start>[0]);
    }) as typeof document.startViewTransition;
  });
  await page.addInitScript(
    ([key, value]) => window.sessionStorage.setItem(key, value),
    [
      ROUND_KEY,
      JSON.stringify([
        { studentId: ALI_ID, name: "Ali" },
        { studentId: "s-ece", name: "Ece" },
      ]),
    ] as const,
  );
  await mockStudentApi(page);
  const types = () =>
    page.evaluate(() => (window as unknown as { __viewTransitionTypes: string[][] }).__viewTransitionTypes);

  await page.goto(`/kocluk/${ALI_ID}`);
  // A coach reads the page before moving on, by which time the link has prefetched the next page.
  // Clicked before that, the page is fetched after the click and commits in a transition of its
  // own, without the type: it swaps without the slide (a fallback, not a failure).
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Sıradaki öğrenci: Ece" }).click();
  await expect(page).toHaveURL(/\/kocluk\/s-ece$/);
  // Polled: the type lands with the transition, a beat after the URL may already read the new page.
  await expect.poll(types).toContainEqual(["nav-forward"]);
  // The slide never holds the page: the next student's mark takes a click straight away.
  const toggle = page.getByRole("button", { name: "İlgilendim", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // The header's way back, not the menu's tab (the menu's is a plain navigation, no slide).
  await page.getByRole("main").getByRole("link", { name: "Öğrencilerim", exact: true }).click();
  await expect(page).toHaveURL(/\/kocluk$/);
  await expect.poll(types).toContainEqual(["nav-back"]);
});
test("doğrudan açılan raporda Sıradaki görünmez", async ({ page }) => {
  await mockStudentApi(page);
  await page.goto(`/kocluk/${ALI_ID}`);
  await expect(page.getByRole("heading", { name: "Ali Demir" })).toBeVisible();
  await expect(page.getByTestId("round-next")).toHaveCount(0);
});

test("rapor açılamazsa yerinde söyler ve yeniden dener", async ({ page }) => {
  const calls = await mockStudentApi(page, { failReport: true });
  await page.goto(`/kocluk/${ALI_ID}`);
  const alert = page.getByRole("alert").filter({ hasText: "Öğrencinin raporu açılamadı." });
  await expect(alert).toBeVisible();
  // Said in place, once: no toast on top of it.
  await expect(page.getByText("Bir sorun oluştu")).toHaveCount(0);
  calls.healReport();
  await alert.getByRole("button", { name: "Yeniden dene" }).click();
  await expect(page.getByRole("heading", { name: "Ali Demir" })).toBeVisible();
});

test("yeni öğrenci ilk hafta diliyle karşılanır ve brifing istenmez", async ({ page }) => {
  const calls = await mockStudentApi(page, { pro: true, reports: { [ALI_ID]: newReport() } });
  await page.goto(`/kocluk/${ALI_ID}`);
  const hero = page.getByTestId("week-hero");
  await expect(hero.getByRole("heading", { name: "Henüz bir iz yok" })).toBeVisible();
  await expect(hero.getByText("İlk görevi sen verebilirsin.")).toBeVisible();
  await expect(page.getByText("İlk çalışmasıyla burası dolmaya başlar.")).toBeVisible();
  await expect(page.getByText("Henüz not bırakmadın.", { exact: false })).toBeVisible();
  expect(calls.brief).toBe(0);
});

test("takip kartı açık kayıtları gösterir ve panele götürür", async ({ page }) => {
  await mockStudentApi(page, {
    followups: [
      followup(),
      followup({
        id: "f-2",
        title: "Tarih çalışma düzeni",
        response: "ACCEPTED",
        followUpDate: shiftDay(TODAY, 5),
      }),
    ],
  });
  await page.goto(`/kocluk/${ALI_ID}`);
  const card = page.getByRole("region", { name: "Takip" });
  await expect(card.getByText("Yanıt bekliyor")).toBeVisible();
  await expect(card.getByText("Kontrol bugün")).toBeVisible();
  // The coach's side of the student's answer.
  await expect(card.getByText("Kabul etti")).toBeVisible();
  await card.getByRole("button", { name: "Tüm kayıtlar (2)" }).click();
  const panel = page.getByRole("dialog", { name: "Takip" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Ali Demir · 2 kayıt")).toBeVisible();
});

test("takip panelinde ilk açık kayıt açık gelir, diğerleri satırdır ve dokununca açılır", async ({ page }) => {
  await mockStudentApi(page, {
    followups: [
      followup({
        id: "f-0",
        title: "Eski karar",
        status: "COMPLETED",
        sharedDecision: null,
        closedAt: "2026-09-10T08:00:00Z",
      }),
      followup(),
      followup({ id: "f-2", title: "Tarih çalışma düzeni", followUpDate: shiftDay(TODAY, 5) }),
    ],
  });
  await page.goto(`/kocluk/${ALI_ID}`);
  await page.getByRole("region", { name: "Takip" }).getByRole("button", { name: /Tüm kayıtlar/ }).click();
  const panel = page.getByRole("dialog", { name: "Takip" });
  const closed = panel.getByRole("button", { name: /Eski karar/ });
  const first = panel.getByRole("button", { name: /Denemeden sonra kısa görüşme/ });
  const second = panel.getByRole("button", { name: /Tarih çalışma düzeni/ });
  // Not the newest row: the first record that still needs the coach.
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(closed).toHaveAttribute("aria-expanded", "false");
  await expect(second).toHaveAttribute("aria-expanded", "false");
  await expect(panel.getByRole("button", { name: "Takibi tamamla" })).toHaveCount(1);

  await second.click();
  await expect(second).toHaveAttribute("aria-expanded", "true");
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(panel.getByRole("button", { name: "Takibi tamamla" })).toHaveCount(1);
});

test("planlayıcı seçili günle açılır ve haftayı yerel tarihle yazar", async ({ page }) => {
  await mockStudentApi(page);
  await page.goto(`/kocluk/${ALI_ID}`);
  await page.getByRole("button", { name: "Haftayı planla" }).click();
  const panel = page.getByRole("dialog", { name: "Haftayı planla" });
  // Focus starts on the week, not on a checkbox at the far end of the panel.
  await expect(panel.getByRole("group", { name: "Gün seç" }).locator('[aria-pressed="true"]')).toBeFocused();
  // "21–27 Eylül", never the API's `2026-09-21`.
  await expect(panel.getByText(/\d{4}-\d{2}-\d{2}/)).toHaveCount(0);
  // One filled button: the send at the foot.
  await expect(panel.getByRole("button", { name: "0 görevi planına ekle" })).toBeVisible();
});

test("yüklenirken ekran okuyucuya yüklendiğini söyler", async ({ page }) => {
  await mockStudentApi(page);
  await page.route(`**/v1/mentorship/students/${ALI_ID}`, async (route) => {
    if (route.request().method() === "GET") await new Promise((resolve) => setTimeout(resolve, 6_000));
    await route.fallback();
  });
  await page.goto(`/kocluk/${ALI_ID}`);
  // The hero's skeleton is a status, not a silent drawing.
  await expect(page.getByRole("status", { name: "Yükleniyor" }).first()).toBeVisible({ timeout: 5_000 });
});

test("haftalık kart rapor gelmeden cümle kurmaz", async ({ page }) => {
  test.setTimeout(45_000);
  await mockStudentApi(page, { weekly: "ready" });
  // The report answers late; the weekly preview answers at once.
  await page.route(`**/v1/mentorship/students/${ALI_ID}`, async (route) => {
    if (route.request().method() === "GET") await new Promise((resolve) => setTimeout(resolve, 8_000));
    await route.fallback();
  });
  await page.goto(`/kocluk/${ALI_ID}`);
  const card = page.getByRole("region", { name: "Haftalık değerlendirme" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  // Without the student's name the sentence read "PDF'i 'e sen ilet."
  await expect(card).not.toContainText("'e sen ilet");
  await expect(card).toContainText("PDF'i Ali'ye sen ilet.");
});

test("haftalık özellik kapalıyken kart hiç çizilmez", async ({ page }) => {
  await mockStudentApi(page, { weekly: "disabled" });
  // Both weekly reads answer late: the card must not draw while it waits to hear "off".
  await page.route("**/weekly-reports**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4_000));
    await route.fallback();
  });
  await page.goto(`/kocluk/${ALI_ID}`);
  await expect(page.getByRole("heading", { name: "Ali Demir" })).toBeVisible();
  // A snapshot, not a retrying assertion: a card that flashes and goes would pass a retry.
  expect(await page.getByRole("region", { name: "Haftalık değerlendirme" }).count()).toBe(0);
  await page.waitForTimeout(4_500);
  expect(await page.getByRole("region", { name: "Haftalık değerlendirme" }).count()).toBe(0);
});

test("haftalık kart dürüst metni söyler ve arşivi açar", async ({ page }) => {
  await mockStudentApi(page, { weekly: "ready", archive: 2 });
  await page.goto(`/kocluk/${ALI_ID}`);
  const card = page.getByRole("region", { name: "Haftalık değerlendirme" });
  await expect(card.getByText("PDF'i Ali'ye sen ilet.", { exact: false })).toBeVisible();
  await expect(card.getByText("Taslak")).toBeVisible();
  await card.getByRole("button", { name: "Arşiv (2)" }).click();
  const panel = page.getByRole("dialog", { name: "Haftalık değerlendirme" });
  await expect(panel.getByRole("link", { name: "PDF önizlemesini aç" }).first()).toBeVisible();
});
