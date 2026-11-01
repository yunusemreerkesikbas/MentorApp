import { expect, test, type Page } from "@playwright/test";
import type { DeepAnalysisView } from "@mentor/types";
import { exam, mockAnalysisApi, readyWeekly } from "./analysis.fixture";

const locked: DeepAnalysisView = {
  eligible: true,
  weekStart: readyWeekly.period.startDate,
  cost: 25,
  coinConfirmed: 100,
  canAfford: true,
  unlocked: false,
  premium: false,
  purchased: false,
  generationAvailable: false,
};

async function openNote(page: Page) {
  await page.goto(`/analiz/haftanin-hikayesi?examId=${exam.id}`);
  await expect(page.getByTestId("weekly-recap-slide")).toHaveAttribute(
    "data-slide-kind",
    "welcome",
  );
  for (let step = 0; step < 7; step += 1)
    await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("weekly-recap-slide")).toHaveAttribute(
    "data-slide-kind",
    "final",
  );
  await page.getByRole("button", { name: "Puhu notu" }).click();
}

test("bütçe kapalıyken Coin teklifi ve Premium satın alma yönlendirmesi gösterilmez", async ({
  page,
}, testInfo) => {
  const api = await mockAnalysisApi(page, {
    weekly: [readyWeekly],
    deepAnalysis: locked,
  });
  await openNote(page);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "AI Puhu notu şu an hazırlanamadı" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /coin ile|Premium ile aç/i }),
  ).toHaveCount(0);
  expect(
    api.requests.filter(
      ({ method, path }) =>
        method === "POST" &&
        ["/v1/economy/deep-analysis", "/v1/coach/weekly-review"].includes(path),
    ),
  ).toHaveLength(0);
  await page.screenshot({
    path: testInfo.outputPath("budget-unavailable.png"),
  });
});

test("bütçe kapalıyken alınmış haftalık hakkın önbellekteki notu okunur", async ({
  page,
}) => {
  const api = await mockAnalysisApi(page, {
    weekly: [readyWeekly],
    deepAnalysis: { ...locked, purchased: true, unlocked: true },
    weeklyNarration: {
      narration: "Bu haftalık notun hazır.",
      model: "cache",
      suggestedTask: { subjectRef: null, title: "Haftalık tekrar" },
    },
  });
  await openNote(page);
  await expect(page.getByText("Bu haftalık notun hazır.")).toBeVisible();
  await expect(page.getByRole("button", { name: /coin ile/i })).toHaveCount(0);
  await expect(
    page.getByText("AI Puhu notu şu an hazırlanamadı", { exact: false }),
  ).toHaveCount(0);
  expect(
    api.requests.filter(
      ({ method, path }) =>
        method === "POST" && path === "/v1/economy/deep-analysis",
    ),
  ).toHaveLength(0);
});

test("dahil olan haftalık hak Coin satın alma isteği göndermeden notu hazırlar", async ({
  page,
}) => {
  const api = await mockAnalysisApi(page, {
    weekly: [readyWeekly],
    deepAnalysis: { ...locked, unlocked: true, generationAvailable: true },
    weeklyNarration: {
      narration: "Haftalık hakkınla hazırlanan notun.",
      model: "fake",
      suggestedTask: { subjectRef: null, title: "Haftalık tekrar" },
    },
  });
  await openNote(page);
  await expect(
    page.getByText("Haftalık hakkınla hazırlanan notun."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /coin ile/i })).toHaveCount(0);
  expect(
    api.requests.filter(
      ({ method, path }) =>
        method === "POST" && path === "/v1/economy/deep-analysis",
    ),
  ).toHaveLength(0);
});

test("tekliften sonra bütçe kapanırsa satın alma reddi Coin düğmesini kaldırır", async ({
  page,
}) => {
  await mockAnalysisApi(page, {
    weekly: [readyWeekly],
    deepAnalysis: { ...locked, generationAvailable: true },
  });
  const apiBase = process.env.QA_STAGE2_API_URL ?? "http://localhost:3001/v1";
  await page.route(`${apiBase}/economy/deep-analysis`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": new URL(
          process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
        ).origin,
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({
        code: "AI_BUDGET_EXCEEDED",
        message: "AI şu an dinleniyor. Biraz sonra yeniden deneyebilirsin.",
      }),
    });
  });
  await openNote(page);
  await page
    .getByRole("button", { name: "25 coin ile AI Puhu notunu aç" })
    .click();
  await page
    .getByRole("button", { name: "Emin misin? 25 coin harcanacak" })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "AI Puhu notu şu an hazırlanamadı" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /coin ile|Premium ile aç/i }),
  ).toHaveCount(0);
});
