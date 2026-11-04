import { expect, test, type Page } from "@playwright/test";
import type { WeeklyReportFollowUpDto } from "@mentor/types";
import { exam, mockAnalysisApi, readyWeekly } from "./analysis.fixture";

const id = "99999999-9999-4999-8999-999999999999";
const task = { id: "33333333-3333-4333-8333-333333333333", title: "Matematik tekrarı", subject: "Matematik",
  taskDate: "2026-11-04", status: "PENDING", origin: { type: "WEEKLY_REPORT", reportId: id } };

async function setup(page: Page, data: unknown) {
  const api = await mockAnalysisApi(page);
  await page.route(`**/v1/coach/weekly-recaps/${id}`, (route) => route.fulfill({ json: {
    id, examId: exam.id, weekStart: readyWeekly.period.startDate, endDate: readyWeekly.period.endDate,
    openedAt: "2026-07-13T10:00:00Z", source: "COIN", locale: "tr", review: readyWeekly,
    narration: { narration: "Kayıtlı yorumun.", model: "fake", suggestedTask: null },
  } }));
  await page.route(`**/v1/coach/weekly-recaps/${id}/follow-up`, (route) => route.fulfill({ json: data }));
  await page.goto(`/analiz/haftanin-hikayesi?reportId=${id}&view=analysis`);
  return api;
}

test("unsaved recommendation keeps its report attribution when opening the plan form", async ({ page }) => {
  const api = await setup(page, { task: null, previous: null });
  const card = page.getByTestId("weekly-report-follow-up");
  await expect(card.getByRole("link", { name: "Planıma ekle" })).toHaveAttribute("href", new RegExp(`source=weekly-report&weeklyReportId=${id}`));
  expect(api.requests.filter((r) => r.method === "POST" && /plan-task/.test(r.path))).toEqual([]);
});

for (const status of ["PENDING", "DONE"]) {
  test(`${status} shows the live task and prevents a duplicate add action`, async ({ page }) => {
    await setup(page, { task: { ...task, status }, previous: null });
    const card = page.getByTestId("weekly-report-follow-up");
    await expect(card.getByText(status === "DONE" ? "Tamamladın" : "Planında · 4 Kasım", { exact: true })).toBeVisible();
    await expect(card.getByRole("link", { name: "Planıma ekle" })).toHaveCount(0);
    await expect(card.getByRole("link", { name: "Planımdaki göreve git" })).toHaveAttribute("href", /date=2026-11-04/);
  });
}

test("next week's report distinguishes the baseline average, later attempt and live status", async ({ page }) => {
  await setup(page, { task: null, previous: { reportId: "older", weekStart: "2026-06-29",
    task: { ...task, status: "DONE" }, baselineNet: "10.00",
    measurement: { net: "12.00", takenAt: "2026-07-09T10:00:00Z", delta: "+2.00" },
    message: "Fark, önerinin etkisini tek başına göstermez." } });
  const card = page.getByTestId("weekly-report-previous-step");
  await expect(card.getByRole("heading", { name: "Geçen haftanın adımı" })).toBeVisible();
  await expect(card.getByText("10 net", { exact: true })).toBeVisible();
  await expect(card.getByText("12 net", { exact: true })).toBeVisible();
  await expect(card.getByText("+2", { exact: true })).toBeVisible();
  await expect(card.getByText("Fark, önerinin etkisini tek başına göstermez.")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("weekly-follow-up.png"), fullPage: true, animations: "disabled" });
});

test("failed follow-up reads show a retry and do not fall back to an untracked task", async ({ page }) => {
  await setup(page, { task: null, previous: null });
  await page.route(`**/v1/coach/weekly-recaps/${id}/follow-up`, (route) => route.fulfill({ status: 503,
    json: { code: "UNAVAILABLE", message: "Takip şu an yüklenemedi." } }));
  await page.reload();
  const card = page.getByTestId("weekly-report-follow-up");
  await expect(card.getByRole("alert")).toContainText("Takip şu an yüklenemedi.");
  await expect(card.getByRole("link", { name: "Planıma ekle" })).toHaveCount(0);
  await page.route(`**/v1/coach/weekly-recaps/${id}/follow-up`, (route) => route.fulfill({ json: { task: null, previous: null } satisfies WeeklyReportFollowUpDto }));
  await card.getByRole("button", { name: "Tekrar dene" }).click();
  await expect(card.getByRole("link", { name: "Planıma ekle" })).toBeVisible();
});
