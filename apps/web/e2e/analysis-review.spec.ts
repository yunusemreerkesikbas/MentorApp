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
  await page
    .getByRole("combobox", { name: "Başka konu seç" })
    .selectOption("tarih|");
  await page.getByRole("button", { name: "Son 30 gün", exact: true }).click();
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
    page.getByRole("combobox", { name: "Başka konu seç" }),
  ).toHaveValue("tarih|");
  await expect(
    page.getByRole("button", { name: "Son 30 gün", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
