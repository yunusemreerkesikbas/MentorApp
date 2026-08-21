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
  // The calm empty state is no longer a redirect message on Gelişim — the shell defaults
  // straight to Gir, whose own form already teaches "no attempts yet" by being the thing to fill
  // in (`analysis-summary-band.tsx`'s own comment: "the Gir tab's own empty state already teaches
  // this; don't repeat it here").
  await expect(page.getByRole("tab", { name: "Gir" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Deneme sonucu gir" }),
  ).toBeVisible();

  // Gelişim's own empty-trend state — unrelated to the weekly recap teaser, which used to live
  // on this page but has since moved wholesale to the dashboard (`panel-shell.tsx`); `/analiz`
  // no longer calls the weekly-review endpoint at all, so there is nothing left here to assert
  // about it.
  await page.getByRole("tab", { name: "Gelişim" }).click();
  await expect(
    page.getByRole("heading", { name: "Henüz deneme yok" }),
  ).toBeVisible();
  await expect(
    page.getByText("İlk deneme sonucunu girdikten sonra trend burada görünecek."),
  ).toBeVisible();
  expect(api.weeklyCalls).toBe(0);
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
  // The focus card used to be a collapsible `<details>`; it is now a flat card shown whenever
  // there is a focus to show, and simply absent when there is not — no expand/collapse state
  // left to assert on either side.
  await expect(
    firstPage.getByRole("heading", { name: "Çalışma odağın" }),
  ).toBeVisible();
  expect(firstApi.unexpected).toEqual([]);

  const noFocusPage = await page.context().newPage();
  const noFocusApi = await mockAnalysisApi(noFocusPage, {
    analysis: { ...firstAnalysis, nextFocus: null },
  });
  await noFocusPage.goto("/analiz?tab=progress");
  await expect(
    noFocusPage.getByRole("heading", { name: "Çalışma odağın" }),
  ).toHaveCount(0);
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

  // The evidence trend used to sit behind a keyboard-openable `<details>`; the focus card is now
  // a flat, always-expanded card (same redesign that dropped the "Haftanın Hikâyesi hazır" teaser
  // above), so its recent-trend block is already on screen with nothing left to open.
  await expect(page.getByText("Son 4 deneme")).toBeVisible();

  await expectNoHorizontalOverflow(page);
  for (const target of [
    page.getByRole("tab", { name: "Gir" }),
    page.getByRole("tab", { name: "Gelişim" }),
    page.getByRole("tab", { name: "Yanlışlarım" }),
    plan,
    coach,
  ]) {
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  expect(api.unexpected).toEqual([]);
});

test("sekme geçişlerini RSC navigasyonu olmadan lazy yükler", async ({
  page,
}) => {
  const api = await mockAnalysisApi(page, {
    analysis: multipleAnalysis,
    weekly: [readyWeekly],
  });
  await page.goto("/analiz?tab=progress");
  await expect(
    page.getByRole("heading", { name: "Çalışma odağın" }),
  ).toBeVisible();

  await waitForRscRequestsToSettle(page);

  // Scoped to this page's own route: on mobile, the always-visible bottom tab bar prefetches its
  // OTHER links (e.g. "Yanlış defteri") independent of anything a user does here, and that is not
  // what this test is about — it is about whether switching Analiz's own tabs avoids a navigation.
  const navigations: string[] = [];
  page.on("request", (request) => {
    if (
      (request.resourceType() === "document" ||
        request.url().includes("_rsc")) &&
      new URL(request.url()).pathname.includes("analiz")
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
  // The photo-categorize card this used to poll for is gone — the notebook replaced it
  // (`analysis-tab-mistakes.tsx`'s own comment), so what proves the switch happened without a
  // navigation is simply that this tab's own panel is now the one attached.
  await expect(page.locator("#analysis-panel-mistakes")).toBeVisible();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "Gir" })).toBeFocused();

  // The weekly-recap teaser lived here once but has since moved to the dashboard — `/analiz`
  // never calls the weekly-review endpoint at all now.
  expect(api.weeklyCalls).toBe(0);
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

test("İngilizce statik analiz metinlerini gösterir", async ({ page }) => {
  const api = await mockAnalysisApi(page, { analysis: emptyAnalysis });

  await page.goto("/en/analysis");

  await expect(
    page.getByRole("main", { name: "Mock Exam Analysis" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Progress" })).toBeVisible();
  // Same shell-default as the Turkish empty-state test: it lands on Enter, not a redirect
  // message on Progress.
  await expect(
    page.getByRole("heading", { name: "Enter mock exam results" }),
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

test("deneme kaydedilince yanlışları deftere taşımayı önerir", async ({
  page,
}) => {
  const api = await mockAnalysisApi(page, {});

  await page.goto("/analiz");
  await page.getByRole("tab", { name: "Gir" }).click();

  // One subject with wrong answers is enough — the handoff counts them, it does not import them.
  // `exact` matters: the app sidebar has a "Yanlış defteri" link, and label matching is a
  // substring match by default.
  const wrongFields = page.getByLabel("Yanlış", { exact: true });
  await wrongFields.first().fill("12");
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect.poll(() => api.createdMockExams.length).toBe(1);

  // A count and a door, never twelve auto-created cards: the student picks which mistakes are
  // worth filing, which is the whole reason the review deck can be trusted.
  await expect(page.getByText(/12 yanlış var/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Deftere geç" }),
  ).toHaveAttribute(
    "href",
    "/yanlis-defteri?mockExam=12121212-1212-4121-8121-121212121212",
  );
});
