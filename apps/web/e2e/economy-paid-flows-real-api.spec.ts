import { expect, test } from "@playwright/test";
import { account, api, operator, setting } from "./fixtures/economy-live";

test.skip(
  process.env.QA_NOTEBOOK_LIVE !== "1",
  "Requires the isolated real API fixture",
);
test.afterEach(async ({ request }) => {
  // Preserve the fixture's AI-off baseline for the existing notebook/reward scenarios.
  await setting(request, await operator(request), "ai.enabled", false);
});

test("Coin-rich Free account sees plan/greeting paywalls while chat has Coin access", async ({
  page,
  request,
}, info) => {
  const admin = await operator(request);
  for (const [key, value] of [
    ["economy.enabled", true],
    ["ai.enabled", true],
    ["ai.plan.coin_enabled", false],
    ["ai.budget.monthly_cap_usd_cents", 0],
    ["ai.features.plan.ai.free_enabled", false],
    ["ai.features.daily.greeting.free_enabled", false],
    ["ai.features.coach.chat.free_enabled", false],
    ["economy.coin.ai_chat_cost", 5],
    ["ai.chat.free_coin_daily_limit", 5],
  ] as const)
    await setting(request, admin, key, value);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  const learner = await account(page, info.project.name, "paidflows");
  await learner.profile();
  await learner.verify();
  expect((await learner.balance()).coinConfirmed).toBe(20);
  const billablePosts: string[] = [];
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      /\/coach\/(plan-draft|plan-adaptation|daily-greeting|chat(?:\/stream)?)$/.test(
        req.url(),
      )
    )
      billablePosts.push(req.url());
  });

  await page.goto("/plan");
  await page.getByRole("button", { name: "Koçla planla", exact: true }).click();
  await expect(page.getByTestId("premium-paywall")).toBeVisible();
  expect((await learner.balance()).coinConfirmed).toBe(20);
  await page.screenshot({
    path: info.outputPath("coin-does-not-open-plan.png"),
  });

  await page.goto("/panel");
  await page.getByRole("button", { name: /Güne koçunla uyan/ }).click();
  await expect(page.getByTestId("premium-paywall")).toBeVisible();
  expect((await learner.balance()).coinConfirmed).toBe(20);
  await page.screenshot({
    path: info.outputPath("coin-does-not-open-greeting.png"),
  });

  const access = await page.request.get(`${api}/coach/access`, {
    headers: learner.headers,
  });
  expect(access.status()).toBe(200);
  expect(await access.json()).toMatchObject({
    canChat: true,
    mode: "COIN",
    chatCost: 5,
  });
  await page.goto("/koc");
  await expect(
    page.getByRole("textbox", { name: "Koçuna mesaj yaz", exact: true }),
  ).toBeVisible();
  expect((await learner.balance()).coinConfirmed).toBe(20);
  expect(billablePosts).toHaveLength(0);
  await page.screenshot({
    path: info.outputPath("coin-chat-ready-no-automatic-debit.png"),
  });
});
