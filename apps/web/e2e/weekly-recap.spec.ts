import { expect, test } from "@playwright/test";
import type { WeeklyReviewDto } from "@mentor/types";
import {
  exam,
  insufficientWeekly,
  mockAnalysisApi,
  readyWeekly,
  user,
} from "./analysis.fixture";

const partialWeekly: WeeklyReviewDto = {
  ...insufficientWeekly,
  recap: {
    status: "PARTIAL",
    activeDays: 1,
    weeklyTitle: null,
    nextStorySignal: {
      kind: "FOCUS_SESSION",
      title: "Odak ateşini yak",
      message: "Küçük bir seansla ritmini birlikte görelim.",
    },
    nextStorySignals: [
      {
        kind: "FOCUS_SESSION",
        title: "Odak ateşini yak",
        message: "Küçük bir seansla ritmini birlikte görelim.",
      },
      {
        kind: "MOCK_EXAM",
        title: "Deneme radarını aç",
        message: "Bir deneme girerek performans hikâyeni açabilirsin.",
      },
    ],
    closingMessage: "Tek bir tamamlanan görev bile bu haftanın gerçek bir izi.",
  },
  evidence: {
    mockExamCount: 0,
    completedSessionCount: 0,
    qualifyingSessionCount: 0,
    completedPlanTaskCount: 1,
  },
  rhythm: {
    ...insufficientWeekly.rhythm,
    activeDays: 1,
    longestActiveRun: 1,
    days: [
      { date: "2026-07-06", active: true },
      { date: "2026-07-07", active: false },
      { date: "2026-07-08", active: false },
      { date: "2026-07-09", active: false },
      { date: "2026-07-10", active: false },
      { date: "2026-07-11", active: false },
      { date: "2026-07-12", active: false },
    ],
  },
  plan: {
    completedTaskCount: 1,
    subjectBreakdown: [
      {
        subjectRef: "matematik",
        subjectName: "Matematik",
        completedTaskCount: 1,
      },
    ],
    message: "Matematik için bir küçük adımı tamamladın.",
  },
  highlights: [
    {
      kind: "COMPLETED_TASKS",
      completedTaskCount: 1,
      message: "Planındaki bir küçük adımı tamamladın.",
    },
  ],
};

test("READY hikâyesi mobilde swipe ve klavyeyle, otomatik ilerlemeden gezilir", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await mockAnalysisApi(page, { weekly: [readyWeekly] });

  await page.goto(
    `/analiz/haftanin-hikayesi?examId=${exam.id}&source=analysis`,
  );

  const slide = page.getByTestId("weekly-recap-slide");
  await expect(slide).toHaveAttribute("data-slide-kind", "cover");
  await page.waitForTimeout(700);
  await expect(slide).toHaveAttribute("data-slide-kind", "cover");

  const box = await slide.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.8, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.2, box!.y + box!.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(slide).toHaveAttribute("data-slide-kind", "rhythm");

  await page.keyboard.press("ArrowRight");
  await expect(slide).toHaveAttribute("data-slide-kind", "subject");
  await page.keyboard.press("ArrowRight");
  await expect(slide).toHaveAttribute("data-slide-kind", "performance");
  await page.keyboard.press("ArrowLeft");
  await expect(slide).toHaveAttribute("data-slide-kind", "subject");
  await expect(page.locator("html")).not.toHaveCSS("overflow-x", "scroll");
  expect(api.unexpected).toEqual([]);
});

test("PARTIAL yalnız mevcut kanıtları gösterir ve AI/satış çağrısı yapmaz", async ({
  page,
}) => {
  const api = await mockAnalysisApi(page, { weekly: [partialWeekly] });

  await page.goto(`/analiz/haftanin-hikayesi?examId=${exam.id}`);
  await expect(
    page.getByText("Geçen haftadan kalan güzel izler"),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("weekly-recap-slide")).toHaveAttribute(
    "data-slide-kind",
    "rhythm",
  );
  await expect(page.getByText("0", { exact: true })).toHaveCount(0);

  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("weekly-recap-slide")).toHaveAttribute(
    "data-slide-kind",
    "spark",
  );
  await expect(page.getByText("1 görev")).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("weekly-recap-slide")).toHaveAttribute(
    "data-slide-kind",
    "closing",
  );
  await expect(page.getByRole("button", { name: /coin ile/i })).toHaveCount(0);
  expect(
    api.requests.some(({ path }) =>
      path.startsWith("/v1/economy/deep-analysis"),
    ),
  ).toBe(false);
  expect(
    api.requests.some(
      ({ method, path }) =>
        method === "POST" && path === "/v1/coach/weekly-review",
    ),
  ).toBe(false);
});

test("EMPTY sakin başlangıç aksiyonlarını hikâye destesi olmadan sunar", async ({
  page,
}) => {
  await mockAnalysisApi(page, { weekly: [insufficientWeekly] });

  await page.goto(`/analiz/haftanin-hikayesi?examId=${exam.id}`);

  await expect(
    page.getByText("Sessiz haftalar da yolculuğun parçası"),
  ).toBeVisible();
  await expect(page.getByTestId("weekly-recap-slide")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Görev ekle" })).toHaveAttribute(
    "href",
    /\/plan\?add=1/,
  );
  await expect(
    page.getByRole("link", { name: "Seans başlat" }),
  ).toHaveAttribute("href", /\/seans/);
});

test("sınav türü eksikse mevcut onboarding korumasına döner", async ({
  page,
}) => {
  const api = await mockAnalysisApi(page, {
    authUser: { ...user, examType: null },
  });

  await page.goto("/analiz/haftanin-hikayesi");

  await expect(page).toHaveURL(/\/baslangic$/);
  await expect(page.getByRole("button", { name: "Devam" })).toBeVisible();
  expect(api.weeklyCalls).toBe(0);
});

test("reduced-motion tercihinde hikâye crossfade moduna geçer", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockAnalysisApi(page, { weekly: [readyWeekly] });

  await page.goto(`/analiz/haftanin-hikayesi?examId=${exam.id}`);

  await expect(page.getByTestId("weekly-recap-story")).toHaveAttribute(
    "data-reduced-motion",
    "true",
  );
});

test("AI gecikmesi veya hatası hikâyeyi engellemez ve deterministik nota düşer", async ({
  page,
}) => {
  const api = await mockAnalysisApi(page, {
    weekly: [readyWeekly],
    deepAnalysis: {
      eligible: true,
      weekStart: readyWeekly.period.startDate,
      cost: 25,
      coinConfirmed: 0,
      canAfford: false,
      unlocked: true,
      premium: true,
    },
    weeklyNarration: "error",
  });

  await page.goto(`/analiz/haftanin-hikayesi?examId=${exam.id}`);
  await expect(page.getByTestId("weekly-recap-slide")).toHaveAttribute(
    "data-slide-kind",
    "cover",
  );
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press("ArrowRight");
  }

  await expect(page.getByText(readyWeekly.recap.closingMessage)).toBeVisible();
  expect(
    api.requests.filter(
      ({ method, path }) =>
        method === "POST" && path === "/v1/coach/weekly-review",
    ),
  ).toHaveLength(1);
});

test("AI Puhu coin açma yalnız finalde ve iki dokunuşla çalışır", async ({
  page,
}) => {
  const lockedView = {
    eligible: true,
    weekStart: readyWeekly.period.startDate,
    cost: 25,
    coinConfirmed: 100,
    canAfford: true,
    unlocked: false,
    premium: false,
  } as const;
  const api = await mockAnalysisApi(page, {
    weekly: [readyWeekly],
    deepAnalysis: lockedView,
    deepAnalysisPurchase: { ...lockedView, unlocked: true },
    weeklyNarration: {
      narration: "Üç odak seansın sürdürülebilir bir ritme dönüştü.",
      model: "fake",
      suggestedTask: {
        title: "Matematik için kısa tekrar",
        subjectRef: "matematik",
      },
    },
  });

  await page.goto(`/analiz/haftanin-hikayesi?examId=${exam.id}`);
  await expect(page.getByTestId("weekly-recap-slide")).toHaveAttribute(
    "data-slide-kind",
    "cover",
  );
  await expect(page.getByRole("button", { name: /coin ile/i })).toHaveCount(0);
  for (let step = 0; step < 7; step += 1) {
    await page.keyboard.press("ArrowRight");
  }

  const unlock = page.getByRole("button", {
    name: "25 coin ile AI Puhu notunu aç",
  });
  await unlock.click();
  await expect(
    page.getByRole("button", { name: "Emin misin? 25 coin harcanacak" }),
  ).toBeVisible();
  expect(
    api.requests.filter(
      ({ method, path }) =>
        method === "POST" && path === "/v1/economy/deep-analysis",
    ),
  ).toHaveLength(0);

  await page
    .getByRole("button", { name: "Emin misin? 25 coin harcanacak" })
    .click();
  await expect
    .poll(
      () =>
        api.requests.filter(
          ({ method, path }) =>
            method === "POST" && path === "/v1/economy/deep-analysis",
        ).length,
    )
    .toBe(1);
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByText("Üç odak seansın sürdürülebilir bir ritme dönüştü."),
  ).toBeVisible();
});

test("TR/EN route sözleşmesi ve Escape kaynak dönüşü korunur", async ({
  page,
}) => {
  await mockAnalysisApi(page, { weekly: [readyWeekly, readyWeekly] });

  await page.goto(`/en/analysis/weekly-story?examId=${exam.id}`);
  await expect(
    page.getByText("The meaningful traces from last week"),
  ).toBeVisible();

  await page.goto(
    `/analiz/haftanin-hikayesi?examId=${exam.id}&source=analysis`,
  );
  await expect(page.getByTestId("weekly-recap-slide")).toHaveAttribute(
    "data-slide-kind",
    "cover",
  );
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/analiz\?tab=progress$/);
});
