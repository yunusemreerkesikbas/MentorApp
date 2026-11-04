import { expect, test, type Page } from "@playwright/test";
import type { WeeklyRecapReportDto, WeeklyRecapSource } from "@mentor/types";
import { exam, mockAnalysisApi, readyWeekly } from "./analysis.fixture";

async function capture(page: Page, name: string, fullPage = true) {
  if (page.viewportSize()!.width >= 1024 && await page.getByTestId("weekly-deep-analysis").count()) {
    await expect.poll(async () => page.evaluate(() => {
      const title = document.querySelector("[data-testid='weekly-deep-analysis'] h1")!;
      const sidebar = document.querySelector(".mentor-app-sidebar")!;
      return title.getBoundingClientRect().left >= sidebar.getBoundingClientRect().right;
    })).toBe(true);
  }
  await page.screenshot({ path: test.info().outputPath(name), fullPage, animations: "disabled" });
}

async function openAnalysisFromFinalSlide(page: Page) {
  const action = page.getByRole("button", { name: "Derin analizi oku", exact: true });
  const slide = page.getByTestId("weekly-recap-slide");
  await expect(slide).toHaveAttribute("data-slide-kind", "welcome");
  const next = page.getByRole("button", { name: "İleri", exact: true }).first();
  for (let step = 0; step < 7; step++) {
    await expect(action).toHaveCount(0);
    await next.click();
  }
  await expect(slide).toHaveAttribute("data-slide-kind", "final");
  await expect(action).toBeVisible({ timeout: 10_000 });
  await capture(page, "recap-final-analysis-action.png", false);
  await action.click();
}

const report: WeeklyRecapReportDto = {
  id: "99999999-9999-4999-8999-999999999999", examId: exam.id,
  weekStart: readyWeekly.period.startDate, endDate: readyWeekly.period.endDate,
  locale: "tr", source: "COIN", openedAt: "2026-07-13T10:00:00Z",
  review: { ...readyWeekly, deepAnalysis: {
    metrics: [{ id: "FOCUS_MINUTES", current: 265, previous: 180, delta: 85,
      message: "Bu hafta 265 dakika odaklandın. Önceki haftada 180 dakika kayıtlı." },
      { id: "ACTIVE_DAYS", current: 5, previous: 3, delta: 2,
        message: "Bu hafta 5 gün iz bıraktın. Önceki haftada 3 aktif günün vardı." },
      { id: "PLAN_TASKS", current: 4, previous: 6, delta: -2,
        message: "Bu hafta 4 görev tamamladın. Önceki haftada 6 görevi bitirmiştin." }],
    subjects: [{ subjectRef: "matematik", subjectName: "Matematik", averageNet: "12.00",
      previousAverageNet: "10.00", delta: "+2.00", mockExamCount: 2, previousMockExamCount: 2,
      focusMinutes: 190, completedTaskCount: 2, trend: "UP", message: "Matematik ortalaman +2.00 net değişti." },
      { subjectRef: "turkce", subjectName: "Türkçe", averageNet: "18.00", previousAverageNet: "20.00",
        delta: "-2.00", mockExamCount: 2, previousMockExamCount: 2, focusMinutes: 0, completedTaskCount: 0,
        trend: "DOWN", message: "Türkçe ortalaman -2.00 net değişti. Bu değişim tek başına konuyu bilmediğini göstermez." },
      { subjectRef: "tarih", subjectName: "Tarih", averageNet: null, previousAverageNet: null,
        delta: null, mockExamCount: 0, previousMockExamCount: 0, focusMinutes: 45, completedTaskCount: 1,
        trend: "NO_EXAM", message: "Bu hafta Tarih için deneme kaydı yok. Çalışma kayıtların görünür, net değişimi henüz karşılaştırılamıyor." }],
    evidenceMessage: "Denemelerin zorluğu değişebilir; net farkı tek başına çalışmanın etkisini açıklamaz.",
  } },
  narration: { narration: "Bu haftaki emeğini görüyorum. Küçük adımların birikti. Sıradaki adımı birlikte seçelim.",
    model: "fake", suggestedTask: { subjectRef: "matematik", title: "Matematik konusunu tekrar et" } },
};

async function setup(page: Page, source: WeeklyRecapSource = "COIN", saved = report) {
  const api = await mockAnalysisApi(page, { premium: source === "PREMIUM", weekly: [readyWeekly], recapOffer: {
    enabled: true, mode: source, canOpen: true, cost: source === "COIN" ? 250 : 0,
    coinConfirmed: 500, premium: source === "PREMIUM",
    teaser: { activeDays: readyWeekly.rhythm.activeDays, focusMinutes: readyWeekly.rhythm.focusMinutes, topSubject: "Matematik" },
  } });
  const opens: unknown[] = [];
  let reads = 0;
  await page.route("**/v1/coach/weekly-recaps", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    opens.push(route.request().postDataJSON());
    await route.fulfill({ json: { ...saved, source } });
  });
  await page.route(`**/v1/coach/weekly-recaps/${report.id}`, async (route) => {
    reads++;
    await route.fulfill({ json: saved });
  });
  return { api, opens, get reads() { return reads; } };
}

for (const source of ["COIN", "EARNED", "PREMIUM"] as const) {
  test(`${source} opens both views with one acquisition`, async ({ page }) => {
    const h = await setup(page, source);
    await page.goto(`/analiz/haftanin-hikayesi?examId=${exam.id}&view=analysis`);
    await expect(page.getByText("Hikâyen ve derin analizin birlikte açılır.", { exact: true })).toBeVisible();
    await capture(page, `${source.toLowerCase()}-access.png`);
    if (source === "COIN") {
      await page.getByRole("button", { name: "250 Coin ile aç", exact: true }).click();
      await capture(page, "coin-confirmation.png");
      await page.getByRole("button", { name: "Onayla ve aç", exact: true }).click();
    } else await page.getByRole("button", { name: source === "EARNED" ? "Hediyemi aç" : "Haftamı aç", exact: true }).click();
    const detail = page.getByTestId("weekly-deep-analysis");
    await expect(detail.getByRole("heading", { level: 1, name: "Aktif günlerin 3 günden 5 güne çıktı, Matematik +2 net." })).toBeVisible();
    await expect(detail.getByText("12 net", { exact: true })).toBeVisible();
    await expect(detail.getByText("Bu haftaki lakabın: Odak Makinesi")).toBeVisible();
    await expect(detail.getByText(report.narration.narration)).toBeVisible();
    if (source === "COIN") await capture(page, "weekly-deep-analysis.png");
    await expect(detail.getByRole("link", { name: "Planıma ekle" })).toHaveAttribute("href", /add=1/);
    await detail.getByRole("button", { name: "Haftanın hikâyesini izle", exact: true }).click();
    await expect(page.getByTestId("weekly-recap-story")).toBeVisible();
    await capture(page, "recap-story.png", false);
    await openAnalysisFromFinalSlide(page);
    await expect(detail).toBeVisible();
    expect(h.opens).toHaveLength(1);
    expect(h.opens[0]).toMatchObject({ source, expectedCost: source === "COIN" ? 250 : 0 });
    expect(h.reads).toBe(0);
    expect(h.api.requests.filter((r) => r.method === "POST" && /weekly-review|deep-analysis/.test(r.path))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(h.api.unexpected).toEqual([]);
  });
}

test("a historical owned report preserves its note and explains missing detail", async ({ page }) => {
  const old = { ...report, review: readyWeekly };
  const h = await setup(page, "COIN", old);
  await page.goto(`/analiz/haftanin-hikayesi?reportId=${report.id}&view=analysis`);
  const detail = page.getByTestId("weekly-deep-analysis");
  await expect(detail.getByText(/Bu rapor, ders ders kıyas eklenmeden önce açıldı/)).toBeVisible();
  await expect(detail.getByText(report.narration.narration)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("historical-report.png"), fullPage: true });
  expect(h.opens).toHaveLength(0);
  // Development Strict Mode may replay the initial read-only effect.
  expect(h.reads).toBeGreaterThanOrEqual(1);
  const initialReads = h.reads;
  await detail.getByRole("button", { name: "Haftanın hikâyesini izle", exact: true }).click();
  await openAnalysisFromFinalSlide(page);
  await expect(detail).toBeVisible();
  expect(h.reads).toBe(initialReads);
  expect(h.opens).toHaveLength(0);
});

test("a locked or incomplete week exposes no deep report", async ({ page }) => {
  await mockAnalysisApi(page, { recapOffer: { enabled: true, ready: false, mode: "COIN", canOpen: false,
    reason: "COACHING_WEEKLY_REVIEW_INSUFFICIENT", message: "Biraz daha veri gerekli." } });
  await page.goto(`/analiz/haftanin-hikayesi?examId=${exam.id}&view=analysis`);
  await expect(page.getByTestId("weekly-recap-access")).toBeVisible();
  await expect(page.getByTestId("weekly-deep-analysis")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("incomplete-week.png"), fullPage: true });
  await expect(page.getByText(report.narration.narration)).toHaveCount(0);
});

test("the analysis entry is visible to Free users", async ({ page }) => {
  await mockAnalysisApi(page);
  await page.goto("/analiz");
  await expect(page.getByRole("link", { name: "Haftalık raporuma bak" })).toHaveAttribute("href", /view=analysis/);
  await page.screenshot({ path: test.info().outputPath("free-analysis-entry.png"), fullPage: true });
});

test("English chrome supports an owned study-only report", async ({ page }) => {
  await setup(page, "EARNED", { ...report, locale: "en", review: { ...readyWeekly,
    deepAnalysis: { metrics: [], subjects: [], evidenceMessage: "No attempts this week. This review describes your study routine." } } });
  await page.goto(`/en/analysis/recap?reportId=${report.id}&view=analysis`);
  const detail = page.getByTestId("weekly-deep-analysis");
  await expect(detail.getByText(/· Deep analysis$/)).toBeVisible();
  await expect(detail.getByText("No attempts this week. This review describes your study routine.")).toBeVisible();
  await expect(detail.getByText("No subject-level activity was recorded this week.")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("english-study-only.png"), fullPage: true });
});

test("previous-only subject averages keep their sample count visible", async ({ page }) => {
  await setup(page, "COIN", { ...report, review: { ...report.review, deepAnalysis: {
    ...report.review.deepAnalysis!, subjects: [{ ...report.review.deepAnalysis!.subjects[0]!,
      averageNet: null, previousAverageNet: "13.25", mockExamCount: 0, previousMockExamCount: 7,
      delta: null, trend: "NO_EXAM", message: "Bu hafta Matematik için deneme kaydı yok." }],
  } } });
  await page.goto(`/analiz/haftanin-hikayesi?reportId=${report.id}&view=analysis`);
  const detail = page.getByTestId("weekly-deep-analysis");
  await expect(detail.getByText(/^Geçen hafta 13,25 net, 7 deneme ·/)).toBeVisible();
  await expect(detail.getByText("Deneme yok", { exact: true })).toBeVisible();
});

for (const reason of ["INSUFFICIENT_COIN", "WEEKLY_RECAP_LIMIT_REACHED"] as const) {
  test(`${reason} blocks a new acquisition and preserves the preview`, async ({ page }) => {
    const api = await mockAnalysisApi(page, { recapOffer: { enabled: true, ready: true, mode: "COIN",
      canOpen: false, cost: 250, coinConfirmed: reason === "INSUFFICIENT_COIN" ? 80 : 500,
      coinRemaining: reason === "INSUFFICIENT_COIN" ? 2 : 0, reason,
      nextAvailableAt: "2026-11-20T10:00:00Z", message: "Yeni rapor şu an açılamıyor." } });
    await page.goto(`/analiz/haftanin-hikayesi?examId=${exam.id}&view=analysis`);
    const card = page.getByTestId("weekly-recap-access");
    await expect(card).toBeVisible();
    if (reason === "INSUFFICIENT_COIN") await expect(card.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "80");
    else await expect(card.getByText(/Sıradaki hakkın/)).toBeVisible();
    await expect(card.getByRole("button", { name: "250 Coin ile aç", exact: true })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`${reason.toLowerCase()}.png`), fullPage: true });
    expect(api.requests.filter((r) => r.method === "POST" && /weekly-recaps$/.test(r.path))).toEqual([]);
  });
}

test("desktop reading view stays outside the sidebar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"));
  await setup(page);
  await page.goto(`/analiz/haftanin-hikayesi?reportId=${report.id}&view=analysis`);
  const title = page.getByTestId("weekly-deep-analysis").getByRole("heading", { level: 1 });
  await expect(title).toBeVisible();
  const layout = await page.evaluate(() => {
    const sidebar = document.querySelector(".mentor-app-sidebar")!;
    const heading = document.querySelector("[data-testid='weekly-deep-analysis'] h1")!;
    const shell = document.querySelector(".mentor-app-shell")!;
    return { sidebarRight: sidebar.getBoundingClientRect().right, titleLeft: heading.getBoundingClientRect().left,
      shellPadding: getComputedStyle(shell).paddingLeft, viewport: innerWidth };
  });
  console.log("Report layout", layout);
  expect(layout.titleLeft).toBeGreaterThanOrEqual(layout.sidebarRight);
});
