import { expect, test, type Page } from "@playwright/test";
import { account, api, operator, setting } from "./fixtures/economy-live";

test.skip(process.env.QA_WRAPPED_LIVE !== "1", "Requires the isolated Wrapped API fixture");
test.beforeEach(async ({ page, request }) => {
  const admin = await operator(request);
  for (const [key, value] of [
    ["coaching.weekly_recap.access_enabled", true], ["coaching.weekly_recap.free_enabled", true],
    ["coaching.weekly_recap.free_limit", 1], ["coaching.weekly_recap.coin_enabled", true],
    ["coaching.weekly_recap.coin_limit", 2], ["coaching.weekly_recap.coin_window_days", 30],
    ["coaching.weekly_recap.ai_enabled", true], ["ai.enabled", true], ["economy.enabled", true],
    ["ai.budget.monthly_cap_usd_cents", 0], ["economy.coin.deep_analysis_cost", 25],
  ] as const) await setting(request, admin, key, value);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function completeWeek(page: Page, headers: { Authorization: string }) {
  const today = await page.request.get(`${api}/coaching/today`, { headers });
  const week = (await today.json()).weeklyRecapPeriod;
  expect(week).toBeTruthy();
  // The isolated fixture supplies last week's history; Free cannot edit past plan dates.
  const access = await page.request.get(`${api}/coach/weekly-recaps/access?examId=${week.examId}`, { headers });
  expect((await access.json()).ready).toBe(true);
  // Acknowledge unrelated onboarding overlays through their ordinary self API before this journey.
  const unseen = await page.request.get(`${api}/community/journey-levels/unseen`, { headers });
  expect(unseen.status()).toBe(200);
  for (const celebration of (await unseen.json()).celebrations as { id: string }[])
    expect((await page.request.post(`${api}/community/journey-levels/celebrated`, {
      headers, data: { celebrationId: celebration.id },
    })).status()).toBe(204);
  return week.examId as string;
}

test("earned first Wrapped saves its story and rereads from archive while AI is off", async ({ page, request }, info) => {
  const learner = await account(page, info.project.name, "wrappedfree");
  await learner.profile(); await learner.verify();
  const exam = await completeWeek(page, learner.headers);
  const requests: string[] = [];
  page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/coach/weekly-recaps")) requests.push(r.url()); });
  await page.goto(`/analiz/haftanin-hikayesi?examId=${exam}`);
  await expect(page.getByRole("button", { name: "İlk hikâyemi ücretsiz aç", exact: true })).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.screenshot({ path: info.outputPath("wrapped-earned-offer.png") });
  const generated = page.waitForResponse((r) => r.url().endsWith("/coach/weekly-recaps") && r.request().method() === "POST");
  await page.getByRole("button", { name: "İlk hikâyemi ücretsiz aç", exact: true }).click();
  const response = await generated; expect(response.status()).toBe(201);
  const saved = await response.json(); expect(saved.source).toBe("EARNED");
  await expect(page.getByTestId("weekly-recap-story")).toBeVisible();
  await page.screenshot({ path: info.outputPath("wrapped-owned-story.png") });
  const balance = (await learner.balance()).coinConfirmed;
  await setting(request, await operator(request), "ai.enabled", false);
  await page.goto(`/analiz/haftanin-hikayesi?examId=${exam}`);
  await expect(page.getByRole("heading", { name: "Geçmiş raporlarım", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("wrapped-archive.png") });
  await page.getByRole("button", { name: "Tekrar izle", exact: true }).click();
  await expect(page.getByTestId("weekly-recap-story")).toBeVisible();
  expect(requests).toHaveLength(1);
  expect((await learner.balance()).coinConfirmed).toBe(balance);
});

test("Coin Wrapped refreshes a changed admin quote and obeys a dynamic shared cap", async ({ page, request }, info) => {
  const learner = await account(page, info.project.name, "wrappedcoin");
  await learner.profile(); await learner.verify();
  const exam = await completeWeek(page, learner.headers);
  const admin = await operator(request);
  await setting(request, admin, "coaching.weekly_recap.free_enabled", false);
  await setting(request, admin, "economy.coin.deep_analysis_cost", 10);
  await page.goto(`/analiz/haftanin-hikayesi?examId=${exam}`);
  await page.getByRole("button", { name: "10 Coin ile aç", exact: true }).click();
  await setting(request, admin, "economy.coin.deep_analysis_cost", 5);
  const stale = page.waitForResponse((r) => r.url().endsWith("/coach/weekly-recaps") && r.request().method() === "POST");
  const before = (await learner.balance()).coinConfirmed;
  await page.getByRole("button", { name: "10 Coin kullanmayı onayla", exact: true }).click();
  expect((await stale).status()).toBe(409);
  await expect(page.getByRole("button", { name: "5 Coin ile aç", exact: true })).toBeVisible();
  expect((await learner.balance()).coinConfirmed).toBe(before);
  await page.getByRole("button", { name: "5 Coin ile aç", exact: true }).click();
  await page.screenshot({ path: info.outputPath("wrapped-coin-confirm.png") });
  await page.getByRole("button", { name: "5 Coin kullanmayı onayla", exact: true }).click();
  await expect(page.getByTestId("weekly-recap-story")).toBeVisible();
  expect((await learner.balance()).coinConfirmed).toBe(before - 5);
  await setting(request, admin, "coaching.weekly_recap.coin_limit", 0);
  const state = await page.request.get(`${api}/coach/weekly-recaps/access?examId=${exam}`, { headers: learner.headers });
  expect(await state.json()).toMatchObject({ mode: "OWNED", canOpen: true, coinRemaining: 0 });
});
