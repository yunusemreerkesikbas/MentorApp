import { expect, test } from "@playwright/test";
import { mockAnalysisApi, multipleAnalysis } from "./analysis.fixture";
test("analysis defaults to progress and preserves selected review scope", async ({
  page,
}) => {
  await mockAnalysisApi(page, { analysis: multipleAnalysis });
  await page.goto("/analiz");
  await expect(page.getByRole("tab", { name: "Gelişim" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByText("Çalıştığın sorular", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Başka konu seç" }).click();
  await page.getByRole("option", { name: "Tarih", exact: true }).click();
  await page.getByRole("tab", { name: "Son 30 gün", exact: true }).click();
  const start = page.getByRole("link", { name: /Tekrara başla/ });
  await expect(start).toHaveAttribute("href", /subjectRef=tarih/);
  await expect(start).toHaveAttribute("href", /days=30/);
  await expect(start).toHaveAttribute("href", /review=focus/);
  await expect(
    page.getByRole("heading", { name: "Çalışma geçmişin" }),
  ).toBeVisible();
});

test("empty focused review offers early practice and preserves the return scope", async ({
  page,
}) => {
  await mockAnalysisApi(page, { analysis: multipleAnalysis });
  await page.route("**/v1/coaching/notebook/entries?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }),
    }),
  );
  await page.goto(
    "/yanlis-defteri?review=focus&examId=11111111-1111-4111-8111-111111111111&subjectRef=tarih&focus=tarih%7C&days=30",
  );
  await expect(
    page.getByText("Bu seçimde tekrar zamanı gelen soru yok."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Aktif sorularla erken çalış" })
    .click();
  await expect(page.getByText("Bu seçimde aktif soru yok.")).toBeVisible();
  await page.getByRole("link", { name: "Analize dön" }).click();
  await expect(
    page.getByRole("button", { name: "Başka konu seç" }),
  ).toContainText("Tarih");
  await expect(
    page.getByRole("tab", { name: "Son 30 gün", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("refined progress keeps review primary and plan accessible by keyboard", async ({
  page,
}, testInfo) => {
  await mockAnalysisApi(page, { analysis: multipleAnalysis });
  await page.route("**/v1/coaching/notebook/review-history?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "review-1",
            entryId: "entry-1",
            subjectName: "Matematik",
            topicName: "Problemler",
            reviewedAt: "2026-09-08T09:00:00Z",
            solved: false,
            early: false,
            nextReviewAt: "2026-09-09T09:00:00Z",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      }),
    }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/analiz");
  await expect(page.getByRole("link", { name: /Tekrara başla/ })).toBeVisible();
  const details = page
    .locator("details")
    .filter({ has: page.getByText("Plan ve deneme takibi", { exact: true }) });
  await expect(details).not.toHaveAttribute("open", "");
  const summary = details.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await page.keyboard.press("Enter");
  await expect(details).not.toHaveAttribute("open", "");
  await expect(
    page.getByRole("link", { name: "Matematik · Problemler", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Son 7 gün", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Önceki" })).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("analysis-redesign.png"),
    fullPage: true,
  });
});
