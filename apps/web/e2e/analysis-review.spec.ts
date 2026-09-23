import { expect, test } from "@playwright/test";
import type { AnalysisImprovementCycleDto } from "@mentor/types";
import {
  exam,
  gotoAnalysis,
  mistakesAnalysis,
  mockAnalysisApi,
  multipleAnalysis,
} from "./analysis.fixture";

test("Yanlışlarım sebepleri, yerleri ve tekrarları kendi sorularına açar", async ({
  page,
}) => {
  const api = await mockAnalysisApi(page, {
    analysis: mistakesAnalysis,
    reviewHistory: [
      {
        id: "review-1",
        entryId: "entry-1",
        examId: exam.id,
        subjectRef: "matematik",
        subjectName: "Matematik",
        topicRef: "problemler",
        topicName: "Problemler",
        reviewedAt: "2026-09-08T09:00:00Z",
        solved: false,
        early: false,
        nextReviewAt: "2026-09-09T09:00:00Z",
      },
    ],
  });
  await gotoAnalysis(page, "/analiz?tab=mistakes");
  await expect(page.getByRole("tab", { name: "Yanlışlarım" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // One ledge, and its number is the set the review opens: both read this exam's review summary.
  const start = page.getByRole("link", { name: "Tekrara başla · 2 soru" });
  await expect(start).toHaveAttribute(
    "href",
    `/yanlis-defteri?review=focus&examId=${exam.id}`,
  );
  await expect(
    page.getByRole("link", { name: /Biliyordum, dikkat hatası/ }),
  ).toHaveAttribute("href", /review=focus&.*errorType=CARELESS/);

  const where = page.getByRole("region", { name: "Nerede kaçırıyorsun?" });
  await expect(where.getByRole("link", { name: /Problemler/ })).toHaveAttribute(
    "href",
    /subjectRef=matematik&topicRef=problemler/,
  );
  await expect(where.getByRole("link", { name: /Tarih/ })).toHaveAttribute(
    "href",
    /review=focus&.*subjectRef=tarih$/,
  );

  // The notebook's window is drawn as a path; the due count lives only on the ledge.
  const funnel = page.getByRole("region", { name: "Son 60 gün" });
  await expect(funnel.getByRole("progressbar")).toHaveCount(3);
  await expect(funnel.getByText("5", { exact: true })).toHaveCount(0);

  const recent = page.getByRole("region", { name: "Son tekrarların" });
  await expect(
    recent.getByRole("link", { name: /Matematik · Problemler/ }),
  ).toHaveAttribute("href", /entryId=entry-1/);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect((await start.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(api.unexpected).toEqual([]);
});

test("boş defterde Yanlışlarım tek kapı gösterir", async ({ page }) => {
  await mockAnalysisApi(page, { analysis: multipleAnalysis });
  await gotoAnalysis(page, "/analiz?tab=mistakes");
  await expect(
    page.getByText("Yanlış defterine ilk soruyu ekleyince"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Yanlış defterini aç" }),
  ).toHaveAttribute("href", "/yanlis-defteri");
  await expect(page.getByRole("link", { name: /Tekrara başla/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: /Son \d+ gün/ })).toHaveCount(0);
});

test("plana bağlı odakta ledge odağın tekrarını sayısıyla açar", async ({
  page,
}) => {
  const cycle: AnalysisImprovementCycleDto = {
    task: {
      id: "55555555-5555-4555-8555-555555555555",
      title: "Problemler konusunu tekrar et",
      status: "PENDING",
      taskDate: "2026-07-14",
      createdAt: "2026-07-14T09:00:00Z",
    },
    focus: {
      subjectRef: "matematik",
      subjectName: "Matematik",
      topicRef: "problemler",
      topicName: "Problemler",
      source: "PHOTO_SIGNAL",
      evidenceCount: 3,
    },
    baseline: {
      mockExamId: multipleAnalysis.trend[0]!.id,
      takenAt: "2026-07-13T10:00:00Z",
      net: "12.00",
    },
    followUp: null,
    notebook: {
      matchingCount: 5,
      reviewedAfterPlanCount: 1,
      dueCount: 2,
      healedCount: 0,
    },
    steps: { planned: true, practiced: false, measured: false, closed: false },
    message: "Problemler planında. Sıradaki adım odaktaki yanlışları tekrar etmek.",
  };
  const api = await mockAnalysisApi(page, {
    analysis: { ...multipleAnalysis, improvementCycle: cycle },
  });
  await gotoAnalysis(page, "/analiz?tab=progress");

  const hero = page.getByTestId("analysis-improvement-cycle");
  await expect(
    hero.getByRole("heading", { name: "Sırada Problemler tekrarı var" }),
  ).toBeVisible();
  await expect(hero.getByText("1/5 soru")).toBeVisible();
  // `from=progress` brings the notebook's "Analize dön" back here instead of Yanlışlarım.
  const start = hero.getByRole("link", { name: "Tekrara başla · 2 soru" });
  await expect(start).toHaveAttribute(
    "href",
    `/yanlis-defteri?review=focus&from=progress&examId=${exam.id}&subjectRef=matematik&topicRef=problemler`,
  );
  expect(
    api.requests.some(
      ({ path }) =>
        path.startsWith("/v1/coaching/notebook/review-summary?") &&
        path.includes("subjectRef=matematik") &&
        path.includes("topicRef=problemler"),
    ),
  ).toBe(true);
  expect((await start.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
});

for (const from of [null, "progress"] as const) {
  test(`defterden "Analize dön" açıldığı görünüme döner (${from ?? "mistakes"})`, async ({
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
      `/yanlis-defteri?review=focus&examId=${exam.id}&subjectRef=tarih${from ? `&from=${from}` : ""}`,
    );
    await expect(
      page.getByText("Bu seçimde tekrar zamanı gelen soru yok."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Aktif sorularla erken çalış" })
      .click();
    await expect(page.getByText("Bu seçimde aktif soru yok.")).toBeVisible();
    await page.getByRole("link", { name: "Analize dön" }).click();
    await expect(page).toHaveURL(new RegExp(`/analiz\\?tab=${from ?? "mistakes"}$`));
    await expect(
      page.getByRole("tab", { name: from ? "Gelişim" : "Yanlışlarım" }),
    ).toHaveAttribute("aria-selected", "true");
  });
}
