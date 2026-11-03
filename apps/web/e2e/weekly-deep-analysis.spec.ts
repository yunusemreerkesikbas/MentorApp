import { expect, test, type Page } from "@playwright/test";
import type { WeeklyRecapReportDto, WeeklyRecapSource } from "@mentor/types";
import { exam, mockAnalysisApi, readyWeekly } from "./analysis.fixture";

const report: WeeklyRecapReportDto = {
  id: "99999999-9999-4999-8999-999999999999", examId: exam.id,
  weekStart: readyWeekly.period.startDate, endDate: readyWeekly.period.endDate,
  locale: "tr", source: "COIN", openedAt: "2026-07-13T10:00:00Z",
  review: { ...readyWeekly, deepAnalysis: {
    metrics: [{ id: "FOCUS_MINUTES", current: 265, previous: 180, delta: 85,
      message: "Bu hafta 265 dakika odaklandın. Önceki haftada 180 dakika kayıtlı." }],
    subjects: [{ subjectRef: "matematik", subjectName: "Matematik", averageNet: "12.00",
      previousAverageNet: "10.00", delta: "+2.00", mockExamCount: 2, previousMockExamCount: 2,
      focusMinutes: 190, completedTaskCount: 2, trend: "UP", message: "Matematik ortalaman +2.00 net değişti." }],
    evidenceMessage: "Denemelerin zorluğu değişebilir; net farkı tek başına çalışmanın etkisini açıklamaz.",
  } },
  narration: { narration: "Bu haftaki emeğini görüyorum. Küçük adımların birikti. Sıradaki adımı birlikte seçelim.",
    model: "fake", suggestedTask: { subjectRef: "matematik", title: "Matematik konusunu tekrar et" } },
};

async function setup(page: Page, source: WeeklyRecapSource = "COIN", saved = report) {
  const api = await mockAnalysisApi(page, { weekly: [readyWeekly], recapOffer: {
    enabled: true, mode: source, canOpen: true, cost: source === "COIN" ? 250 : 0,
    coinConfirmed: 500, premium: source === "PREMIUM",
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
    if (source === "COIN") {
      await page.getByRole("button", { name: "250 Coin ile aç", exact: true }).click();
      await page.getByRole("button", { name: "Onayla ve aç", exact: true }).click();
    } else await page.getByRole("button", { name: source === "EARNED" ? "Hediyemi aç" : "Haftamı aç", exact: true }).click();
    const detail = page.getByTestId("weekly-deep-analysis");
    await expect(detail.getByRole("heading", { name: "Derin analiz", exact: true })).toBeVisible();
    await expect(detail.getByText("12.00 net", { exact: true })).toBeVisible();
    await expect(detail.getByText(report.narration.narration)).toBeVisible();
    await expect(detail.getByRole("link", { name: "Planıma ekle" })).toHaveAttribute("href", /add=1/);
    await detail.getByRole("button", { name: "Haftanın hikâyesi", exact: true }).click();
    await expect(page.getByTestId("weekly-recap-story")).toBeVisible();
    await page.getByRole("button", { name: "Derin analizi oku", exact: true }).click();
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
  await expect(detail.getByText(/Bu rapor açıldığında ders bazlı ayrıntılar/)).toBeVisible();
  await expect(detail.getByText(report.narration.narration)).toBeVisible();
  expect(h.opens).toHaveLength(0);
  expect(h.reads).toBe(1);
});

test("a locked or incomplete week exposes no deep report", async ({ page }) => {
  await mockAnalysisApi(page, { recapOffer: { enabled: true, ready: false, mode: "COIN", canOpen: false,
    reason: "COACHING_WEEKLY_REVIEW_INSUFFICIENT", message: "Biraz daha veri gerekli." } });
  await page.goto(`/analiz/haftanin-hikayesi?examId=${exam.id}&view=analysis`);
  await expect(page.getByTestId("weekly-recap-access")).toBeVisible();
  await expect(page.getByTestId("weekly-deep-analysis")).toHaveCount(0);
  await expect(page.getByText(report.narration.narration)).toHaveCount(0);
});

test("the analysis entry is visible to Free users", async ({ page }) => {
  await mockAnalysisApi(page);
  await page.goto("/analiz");
  await expect(page.getByRole("link", { name: "Haftalık raporuma bak" })).toHaveAttribute("href", /view=analysis/);
});

test("English chrome supports an owned study-only report", async ({ page }) => {
  await setup(page, "EARNED", { ...report, locale: "en", review: { ...readyWeekly,
    deepAnalysis: { metrics: [], subjects: [], evidenceMessage: "No attempts this week. This review describes your study routine." } } });
  await page.goto(`/en/analysis/recap?reportId=${report.id}&view=analysis`);
  const detail = page.getByTestId("weekly-deep-analysis");
  await expect(detail.getByRole("heading", { name: "Deep analysis", exact: true })).toBeVisible();
  await expect(detail.getByText("No attempts this week. This review describes your study routine.")).toBeVisible();
  await expect(detail.getByText("No subject-level activity was recorded this week.")).toBeVisible();
});
