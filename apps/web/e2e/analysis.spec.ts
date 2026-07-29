import { expect, test, type Page, type Request } from "@playwright/test";
import {
  emptyAnalysis,
  firstAnalysis,
  insufficientWeekly,
  mockAnalysisApi,
  multipleAnalysis,
  readyWeekly,
  user,
} from "./analysis.fixture";

test("sınav türü olmayan kullanıcıyı onboarding akışına gönderir", async ({
  page,
}) => {
  const api = await mockAnalysisApi(page, {
    authUser: { ...user, examType: null },
  });

  await page.goto("/analiz");

  await expect(page).toHaveURL(/\/baslangic$/);
  expect(api.unexpected).toEqual([]);
});

test("boş ve ilk deneme durumlarını sakin biçimde gösterir", async ({
  page,
}) => {
  await page.addInitScript((startDate) => {
    window.localStorage.setItem(
      `mentor.weekly-recap.opened.v2:${startDate}`,
      "1",
    );
  }, insufficientWeekly.period.startDate);
  const api = await mockAnalysisApi(page, {
    analysis: emptyAnalysis,
    weekly: [insufficientWeekly],
  });
  await page.goto("/analiz");
  await expect(
    page.getByText(
      "Henüz deneme yok — Gir sekmesinden ilk sonucunu girebilirsin.",
    ),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Gelişim" }).click();
  await expect(page.getByText("Haftanın Hikâyesi hazır")).toBeVisible();
  await expect(page.getByText("Yeni bir başlangıç")).toBeVisible();
  expect(api.weeklyCalls).toBe(1);
  expect(api.photoAccessCalls).toBe(0);
  expect(api.unexpected).toEqual([]);

  const firstPage = await page.context().newPage();
  const firstApi = await mockAnalysisApi(firstPage, {
    analysis: firstAnalysis,
  });
  await firstPage.goto("/analiz?tab=progress");
  await expect(firstPage.getByTestId("analysis-latest-net")).toHaveAttribute(
    "aria-label",
    "Son net: 42.00",
  );
  await expect(firstPage.getByTestId("analysis-latest-net")).toHaveText(
    "42.00",
  );
  await expect(firstPage.getByText(/Geçen denemeye göre/)).toHaveCount(0);
  await expect(
    firstPage.getByText("Matematik", { exact: true }).first(),
  ).toBeVisible();
  await expect(firstPage.locator("details")).not.toHaveAttribute("open", "");
  expect(firstApi.unexpected).toEqual([]);

  const noFocusPage = await page.context().newPage();
  const noFocusApi = await mockAnalysisApi(noFocusPage, {
    analysis: { ...firstAnalysis, nextFocus: null },
  });
  await noFocusPage.goto("/analiz?tab=progress");
  await expect(noFocusPage.locator("details")).toHaveAttribute("open", "");
  expect(noFocusApi.unexpected).toEqual([]);
});

test("konu odağını eyleme taşır ve kanıtları klavyeyle açar", async ({
  page,
}) => {
  const api = await mockAnalysisApi(page, {
    analysis: multipleAnalysis,
    weekly: [readyWeekly],
  });
  await page.goto("/analiz?tab=progress");

  await expect(page.getByTestId("analysis-latest-net")).toHaveText("48.00");
  await expect(page.getByTestId("analysis-net-delta")).toContainText("+6.00");
  await expect(page.getByText("Problemler", { exact: true })).toBeVisible();
  await expect(page.getByText("Haftanın Hikâyesi hazır")).toBeVisible();

  const planLinks = page.getByRole("link", { name: "Planıma ekle" });
  const plan = planLinks.first();
  const coach = page.getByRole("link", { name: "Koçla konuş" });
  await expect(plan).toHaveAttribute(
    "href",
    /\/plan\?add=1&subject=Matematik&title=Problemler\+konusunu\+tekrar\+et/,
  );
  await expect(coach).toHaveAttribute(
    "href",
    /\/koc\/sohbet\?seed=.*Problemler/,
  );
  for (const link of [plan, coach]) {
    await link.evaluate((element) =>
      element.addEventListener("click", (event) => event.preventDefault(), {
        once: true,
      }),
    );
    await link.click();
  }
  expect(
    api.requests.filter(
      ({ method, path }) =>
        method === "POST" &&
        (/^\/v1\/plan-tasks/.test(path) || path === "/v1/coach/chat"),
    ),
  ).toEqual([]);

  const details = page.locator("details");
  await expect(details).not.toHaveAttribute("open", "");
  const summary = details.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");

  await expectNoHorizontalOverflow(page);
  for (const target of [
    page.getByRole("tab", { name: "Gir" }),
    page.getByRole("tab", { name: "Gelişim" }),
    page.getByRole("tab", { name: "Yanlışlarım" }),
    plan,
    coach,
    summary,
  ]) {
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  expect(api.unexpected).toEqual([]);
});

test("AI Puhu notunu arka planda hazırlar ve öneriyi yalnız plan formuna taşır", async ({
  page,
}) => {
  const api = await mockAnalysisApi(page, {
    analysis: multipleAnalysis,
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
    weeklyNarration: {
      narration: "Bu hafta ritmini korudun.",
      model: "fake",
      suggestedTask: {
        title: "Türkçe haftalık tekrar",
        subjectRef: "turkce",
      },
    },
  });
  await page.goto("/analiz?tab=progress");
  await page.getByRole("link", { name: "Hikâyeyi aç" }).click();
  await expect(page).toHaveURL(/\/analiz\/haftanin-hikayesi/);

  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: "İleri" }).click();
  }

  await expect(page.getByText("Bu hafta ritmini korudun.")).toBeVisible();
  await page.getByRole("button", { name: "İleri" }).click();
  const suggested = page.getByRole("link", { name: "Öneriyi planımda aç" });
  await expect(suggested).toHaveAttribute(
    "href",
    /\/plan\?add=1&title=T%C3%BCrk%C3%A7e\+haftal%C4%B1k\+tekrar&subject=turkce|\/plan\?add=1&subject=turkce&title=T%C3%BCrk%C3%A7e\+haftal%C4%B1k\+tekrar/,
  );
  expect(
    api.requests.filter(
      ({ method, path }) =>
        method === "POST" && path === "/v1/coach/weekly-review",
    ),
  ).toHaveLength(1);
});

test("sekme geçişlerini RSC navigasyonu olmadan lazy yükler", async ({
  page,
}) => {
  const api = await mockAnalysisApi(page, {
    analysis: multipleAnalysis,
    weekly: [readyWeekly],
  });
  await page.goto("/analiz?tab=progress");
  await expect(page.getByText("Haftanın Hikâyesi hazır")).toBeVisible();

  await waitForRscRequestsToSettle(page);

  const navigations: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "document" ||
      request.url().includes("_rsc")
    ) {
      navigations.push(request.url());
    }
  });

  const developmentTab = page.getByRole("tab", { name: "Gelişim" });
  await expect(developmentTab).toHaveAttribute(
    "aria-controls",
    "analysis-panel-progress",
  );
  await expect(page.locator("#analysis-panel-progress")).toHaveAttribute(
    "aria-labelledby",
    "analysis-tab-progress",
  );
  await developmentTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Yanlışlarım" })).toBeFocused();
  await expect.poll(() => api.photoAccessCalls).toBe(1);
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "Gir" })).toBeFocused();

  expect(api.weeklyCalls).toBe(1);
  expect(navigations).toEqual([]);
  expect(api.unexpected).toEqual([]);
  expect(
    api.requests.some(({ path }) =>
      [
        "/v1/coach/access",
        "/v1/coach/ghost-narration",
        "/v1/coach/weekly-review",
      ].some((forbidden) => path.startsWith(forbidden)),
    ),
  ).toBe(false);
});

test("haftalık değerlendirme hatasından tekrar deneyerek döner", async ({
  page,
}) => {
  const api = await mockAnalysisApi(page, {
    analysis: firstAnalysis,
    weekly: ["error", readyWeekly],
  });
  await page.goto("/analiz?tab=progress");

  await expect(
    page.getByText("Haftalık değerlendirme yüklenemedi."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tekrar dene" }).click();
  await expect(page.getByText("Haftanın Hikâyesi hazır")).toBeVisible();
  expect(api.weeklyCalls).toBe(2);
  expect(api.unexpected).toEqual([]);
});

test("İngilizce statik analiz metinlerini gösterir", async ({ page }) => {
  const api = await mockAnalysisApi(page, { analysis: emptyAnalysis });

  await page.goto("/en/analysis");

  await expect(
    page.getByRole("main", { name: "Mock Exam Analysis" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Progress" })).toBeVisible();
  await expect(
    page.getByText("No exams yet — enter your first result in the Enter tab."),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(api.unexpected).toEqual([]);
});

async function waitForRscRequestsToSettle(page: Page): Promise<void> {
  await new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      page.off("request", handleRequest);
      resolve();
    };
    const handleRequest = (request: Request) => {
      if (!request.url().includes("_rsc")) return;
      clearTimeout(timer);
      timer = setTimeout(finish, 750);
    };
    page.on("request", handleRequest);
    timer = setTimeout(finish, 750);
  });
}
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth);
}
