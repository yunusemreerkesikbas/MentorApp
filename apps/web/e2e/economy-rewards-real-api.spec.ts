import { expect, test } from "@playwright/test";
import {
  account,
  addAndCompleteTask,
  api,
  openQuests,
  operator,
  overview,
  setting,
} from "./fixtures/economy-live";

test.skip(
  process.env.QA_NOTEBOOK_LIVE !== "1",
  "Requires the isolated live economy fixture",
);

test.beforeEach(async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  const admin = await operator(request);
  for (const [key, value] of [
    ["economy.enabled", true],
    ["economy.coin.daily_cap", 50],
    ["economy.coin.weekly_cap", 200],
    ["economy.coin.min_xp_for_coin", 0],
    ["economy.coin.notebook_slot_cost", 20],
    ["economy.notebook_slots.max_per_user", 2],
    ["economy.quest.onboarding_reward_coin", 10],
    ["economy.quest.weekly_allowance_reward_coin", 15],
    // Daily active-day Coin (2026-11-01) off here: these scenarios count onboarding + weekly only.
    ["economy.quest.daily_active_reward_coin", 0],
    ["economy.quest.weekly_allowance_active_days_target", 5],
  ] as const)
    await setting(request, admin, key, value);
});

test("closed economy keeps task progress without rewards or reopening backpay", async ({
  page,
  request,
}, info) => {
  const admin = await operator(request);
  await setting(request, admin, "economy.enabled", false);
  const learner = await account(page, info.project.name, "closed");
  await learner.profile();
  await learner.verify();
  await addAndCompleteTask(page, "Ödülsüz ritüel");
  const progress = await learner.quests();
  for (const id of [
    "daily.plan-task-done",
    "onboarding.profile-setup",
    "onboarding.email-verified",
  ]) {
    expect(progress.find((q) => q.id === id)).toMatchObject({
      completed: true,
      rewardUnit: "NONE",
      rewardAmount: 0,
    });
  }
  const dialog = await openQuests(page);
  await expect(
    dialog.getByText("Bugünün planından 1 görev tamamla", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText(/\+\d+ (XP|Coin)/)).toHaveCount(0);
  await expect(page.locator('[aria-label="Coin ve XP"]:visible')).toHaveCount(
    0,
  );
  await page.screenshot({
    path: info.outputPath("closed-ritual-progress.png"),
  });
  expect((await overview(request, admin, learner.id)).balance).toEqual({
    xp: 0,
    coinConfirmed: 0,
    coinPending: 0,
  });
  expect(
    (
      await page.request.get(`${api}/economy/notebook-slots`, {
        headers: learner.headers,
      })
    ).status(),
  ).toBe(404);
  await setting(request, admin, "economy.enabled", true);
  await page.reload();
  await learner.quests();
  expect((await learner.balance()).coinConfirmed).toBe(0);
  expect((await overview(request, admin, learner.id)).balance.xp).toBe(0);
});

test("daily cap blocks a second reward; audited admin changes use current values once", async ({
  page,
  request,
}, info) => {
  const admin = await operator(request);
  await setting(request, admin, "economy.coin.daily_cap", 10);
  const learner = await account(page, info.project.name, "limits");
  await learner.profile();
  await learner.verify();
  expect((await learner.balance()).coinConfirmed).toBe(10);
  const deniedQuest = (await learner.quests()).find(
    (q) => q.id === "onboarding.email-verified",
  )!;
  expect(deniedQuest).toMatchObject({ completed: false, action: null });
  const pendingDialog = await openQuests(page);
  await pendingDialog.getByRole("tab", { name: /Başlangıç/ }).click();
  await expect(
    pendingDialog.getByText("Adımın tamam. Coin hakkın şu an bekliyor.", {
      exact: true,
    }),
  ).toBeVisible();
  const emailRow = pendingDialog
    .getByTestId("daily-quest-row")
    .filter({ hasText: deniedQuest.title });
  await expect(emailRow).toBeVisible();
  await expect(emailRow.getByRole("button")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("capped-reward-pending.png") });
  const denied = await page.request.patch(
    `${api}/admin/config/economy.coin.daily_cap`,
    {
      headers: learner.headers,
      data: { value: 100 },
    },
  );
  expect(denied.status()).toBe(403);
  await setting(request, admin, "economy.quest.onboarding_reward_coin", 7);
  await setting(request, admin, "economy.coin.daily_cap", 17);
  await learner.quests();
  expect((await learner.balance()).coinConfirmed).toBe(17);
  await Promise.all([learner.quests(), learner.quests()]);
  const actual = await overview(request, admin, learner.id);
  expect(
    actual.ledger
      .filter((row) => row.reason.startsWith("quest.onboarding."))
      .map((row) => row.amount)
      .sort((a, b) => a - b),
  ).toEqual([7, 10]);
  expect(actual.balance.coinConfirmed).toBe(17);
  await page.goto("/ayarlar");
  await page.getByRole("button", { name: "Bakiyen", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Coin ile neler açabilirim?" }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("admin-cap-and-reward.png") });
});

test("weekly target changes pay verified study once and repeating a task cannot farm Coin", async ({
  page,
  request,
}, info) => {
  const admin = await operator(request);
  const learner = await account(page, info.project.name, "weekly");
  await learner.profile();
  await learner.verify();
  expect((await learner.balance()).coinConfirmed).toBe(20);
  await addAndCompleteTask(page, "Haftalık küçük adım");
  const before = (await learner.quests()).find(
    (q) => q.id === "weekly.effort-allowance",
  );
  expect(before).toMatchObject({
    completed: false,
    rewardAmount: 15,
    progressCurrent: 1,
    progressTarget: 5,
  });
  // Time is not advanced: the real audited setting lowers the test target for this browser journey.
  await setting(
    request,
    admin,
    "economy.quest.weekly_allowance_active_days_target",
    1,
  );
  expect(
    (await learner.quests()).find((q) => q.id === "weekly.effort-allowance")
      ?.completed,
  ).toBe(true);
  expect((await learner.balance()).coinConfirmed).toBe(35);
  await page.goto("/plan");
  const checkbox = page.getByRole("checkbox", {
    name: "Haftalık küçük adım",
    exact: true,
  });
  await checkbox.click();
  await expect(checkbox).not.toBeChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await learner.quests();
  expect((await learner.balance()).coinConfirmed).toBe(35);
  const dialog = await openQuests(page);
  await dialog.getByRole("tab", { name: /Haftalık/ }).click();
  await expect(dialog.getByText("+15 Coin", { exact: true })).toHaveCount(0); // completed rights do not advertise another payout
  await page.screenshot({ path: info.outputPath("weekly-earned-once.png") });
  const rows = (await overview(request, admin, learner.id)).ledger.filter(
    (row) => row.reason === "quest.weekly.effort-allowance",
  );
  expect(rows.map((row) => row.amount)).toEqual([15]);
});
