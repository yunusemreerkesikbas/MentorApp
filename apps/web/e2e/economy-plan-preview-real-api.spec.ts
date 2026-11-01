import { expect, test, type Page } from "@playwright/test";
import { account, api, operator, setting } from "./fixtures/economy-live";

test.skip(
  process.env.QA_NOTEBOOK_LIVE !== "1",
  "Requires the isolated real API fixture",
);
test.beforeEach(async ({ page, request }) => {
  const admin = await operator(request);
  for (const [key, value] of [
    ["economy.enabled", true],
    ["ai.enabled", true],
    ["ai.plan.coin_enabled", true],
    ["ai.features.plan.ai.free_enabled", false],
    ["ai.features.daily.greeting.free_enabled", false],
    ["ai.budget.monthly_cap_usd_cents", 0],
    ["economy.coin.plan_preview_cost", 20],
    ["ai.plan.coin_daily_limit", 1],
    ["ai.plan_draft.daily_limit", 5],
  ] as const)
    await setting(request, admin, key, value);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
});
test.afterEach(async ({ request }) => {
  const admin = await operator(request);
  await setting(request, admin, "ai.enabled", false);
  await setting(request, admin, "ai.plan.coin_enabled", false);
  await setting(
    request,
    admin,
    "ai.features.daily.greeting.free_enabled",
    false,
  );
});

async function wizard(page: Page) {
  await page.getByRole("button", { name: "Koçla planla", exact: true }).click();
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("button", { name: "Şimdilik geç", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Önizlemeyi hazırla", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", {
      name: "Planını Coin hakkınla hazırla",
      exact: true,
    }),
  ).toBeVisible();
}

test("Coin plan preview: earned 20 Coin funds one saved preview; reread/apply never spend twice", async ({
  page,
  request,
}, info) => {
  const learner = await account(page, info.project.name, "planpreview");
  await learner.profile();
  await learner.verify();
  expect((await learner.balance()).coinConfirmed).toBe(20);
  await page.goto("/plan");
  await wizard(page);
  expect((await learner.balance()).coinConfirmed).toBe(20);
  await page.screenshot({
    path: info.outputPath("plan-20-coin-confirmation.png"),
  });
  const generated = page.waitForResponse(
    (r) =>
      r.url().endsWith("/coach/plan-previews") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "20 Coin ile taslak hazırla", exact: true })
    .click();
  const result = await generated;
  expect(result.status()).toBe(201);
  const saved = await result.json();
  expect(saved.coinSpent).toBe(20);
  await expect(
    page.getByRole("button", { name: "Seçilenleri uygula", exact: true }),
  ).toBeVisible();
  expect((await learner.balance()).coinConfirmed).toBe(0);
  await expect(
    page
      .getByText("Koçun baktıkları", { exact: true })
      .locator("..")
      .getByText("PREMIUM", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("paid-plan-preview.png") });
  await page.reload();
  await page.getByRole("button", { name: "Koçla planla", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Seçilenleri uygula", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Seçilenleri uygula", exact: true })
    .click();
  await expect(
    page.getByText("Planın güncellendi", { exact: true }),
  ).toBeVisible();
  expect((await learner.balance()).coinConfirmed).toBe(0);
  const ledger = await page.request.get(`${api}/economy/ledger`, {
    headers: learner.headers,
  });
  expect(
    (await ledger.json()).filter(
      (row: { reason: string }) => row.reason === "plan.preview.purchase",
    ),
  ).toHaveLength(1);
  await setting(request, await operator(request), "economy.enabled", false);
  await page.reload();
  await page.getByRole("button", { name: "Koçla planla", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Seçilenleri uygula", exact: true }),
  ).toBeVisible();
});

test("Coin plan preview: changed admin quote requires fresh confirmation", async ({
  page,
  request,
}, info) => {
  const learner = await account(page, info.project.name, "planquote");
  await learner.profile();
  await learner.verify();
  await page.goto("/plan");
  await wizard(page);
  const admin = await operator(request);
  await setting(request, admin, "economy.coin.plan_preview_cost", 10);
  await setting(request, admin, "ai.plan.coin_daily_limit", 2);
  const rejected = page.waitForResponse(
    (r) =>
      r.url().endsWith("/coach/plan-previews") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "20 Coin ile taslak hazırla", exact: true })
    .click();
  expect((await rejected).status()).toBe(409);
  await expect(
    page.getByText(
      "Plan taslağının Coin bedeli değişti. Güncel bedelle yeniden onay verebilirsin.",
      { exact: true },
    ),
  ).toBeVisible();
  expect((await learner.balance()).coinConfirmed).toBe(20);
  await page
    .getByRole("button", { name: "Önizlemeyi hazırla", exact: true })
    .click();
  const generated = page.waitForResponse(
    (r) =>
      r.url().endsWith("/coach/plan-previews") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "10 Coin ile taslak hazırla", exact: true })
    .click();
  expect((await generated).status()).toBe(201);
  await expect(
    page.getByRole("button", { name: "Seçilenleri uygula", exact: true }),
  ).toBeVisible();
  expect((await learner.balance()).coinConfirmed).toBe(10);
  await page.screenshot({ path: info.outputPath("dynamic-plan-price-10.png") });
});

test("Free daily note: reloading rereads the cached note after its one-use taste", async ({
  page,
  request,
}, info) => {
  const admin = await operator(request);
  await setting(
    request,
    admin,
    "ai.features.daily.greeting.free_enabled",
    true,
  );
  await setting(request, admin, "ai.features.daily.greeting.free_limit", 1);
  const learner = await account(page, info.project.name, "dailyread");
  await learner.profile();
  await learner.verify();
  const first = page.waitForResponse(
    (r) =>
      r.url().endsWith("/coach/daily-greeting") &&
      r.request().method() === "POST",
  );
  await page.goto("/panel");
  const initial = await first;
  expect(initial.status()).toBe(200);
  const note = await initial.json();
  await expect(page.getByText(note.greeting, { exact: true })).toBeVisible();
  const next = page.waitForResponse(
    (r) =>
      r.url().endsWith("/coach/daily-greeting") &&
      r.request().method() === "POST",
  );
  await page.reload();
  const cached = await next;
  expect(cached.status()).toBe(200);
  expect(await cached.json()).toMatchObject({
    model: "cache",
    greeting: note.greeting,
  });
  await expect(page.getByText(note.greeting, { exact: true })).toBeVisible();
  expect((await learner.balance()).coinConfirmed).toBe(20);
  await page.screenshot({
    path: info.outputPath("daily-note-reread-free.png"),
  });
});
