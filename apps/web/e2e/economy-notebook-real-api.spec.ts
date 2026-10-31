import { createHash } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import type {
  AuthSession,
  EconomyBalance,
  NotebookSlotView,
  NotebookSummaryDto,
  Paginated,
} from "@mentor/types";

/** No routes, response fixtures or seeded Coin: the browser talks to the real disposable API. */
const api = "http://localhost:3501/v1";
const password = "NotebookQa!2026";
const run = process.env.QA_NOTEBOOK_RUN_ID;
test.skip(
  process.env.QA_NOTEBOOK_LIVE !== "1",
  "Requires playwright.notebook-live.config.ts",
);

async function operator(request: APIRequestContext) {
  const login = await request.post(`${api}/auth/login`, {
    data: { email: `qa-notebook-operator-${run}@example.test`, password },
  });
  expect(login.status()).toBe(200);
  const session = (await login.json()) as AuthSession;
  return { Authorization: `Bearer ${session.accessToken}` };
}

async function setting(
  request: APIRequestContext,
  headers: Record<string, string>,
  key: string,
  value: unknown,
) {
  const result = await request.patch(`${api}/admin/config/${key}`, {
    headers,
    data: { value },
  });
  expect(result.status()).toBe(200);
}

async function earnedAccount(page: Page, project: string, scenario: string) {
  const email = `qa-notebook-${project}-${scenario}-${run}@example.test`;
  const login = await page
    .context()
    .request.post(`${api}/auth/login`, { data: { email, password } });
  expect(login.status()).toBe(200);
  const session = (await login.json()) as AuthSession;
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const profile = await page.context().request.patch(`${api}/users/me`, {
    headers,
    data: { examType: "KPSS", examVariant: "LISANS" },
  });
  expect(profile.status()).toBe(200);
  const balance = async () => {
    const res = await page
      .context()
      .request.get(`${api}/economy/balance`, { headers });
    expect(res.status()).toBe(200);
    return (await res.json()) as EconomyBalance;
  };
  expect((await balance()).coinConfirmed).toBe(10);
  const token = createHash("sha256").update(email).digest("hex");
  await page.goto(`/eposta-dogrula?token=${token}`);
  await expect(
    page.getByText("E-postan doğrulandı. Hoş geldin!", { exact: true }),
  ).toBeVisible();
  expect((await balance()).coinConfirmed).toBe(20);
  const ledger = await page
    .context()
    .request.get(`${api}/economy/ledger`, { headers });
  expect(
    ((await ledger.json()) as { reason: string; amount: number }[]).map(
      (row) => [row.reason, row.amount],
    ),
  ).toEqual(
    expect.arrayContaining([
      ["quest.onboarding.profile-setup", 10],
      ["quest.onboarding.email-verified", 10],
    ]),
  );
  await page.goto("/defterlerim");
  await expect(
    page.getByRole("heading", { name: "Defterlerim", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Harika!", exact: true }).click();
  return { headers, balance, email };
}

async function createNotebook(page: Page, title: string) {
  await page.getByLabel("Defter adı").fill(title);
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page).toHaveURL(/\/defterlerim\/[a-f0-9-]+$/);
  await page.goto("/defterlerim");
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}

async function openNew(page: Page) {
  await page.getByRole("button", { name: "Yeni defter", exact: true }).click();
}

async function removeNotebook(page: Page, title: string) {
  await page.getByRole("heading", { name: title, exact: true }).hover();
  await page
    .getByRole("button", { name: `${title} defterini sil`, exact: true })
    .click();
  await page.getByRole("button", { name: "Defteri sil", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(0);
}

test.beforeEach(async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  const headers = await operator(request);
  await setting(request, headers, "economy.enabled", true);
  await setting(request, headers, "economy.coin.notebook_slot_cost", 20);
  await setting(request, headers, "economy.notebook_slots.max_per_user", 2);
});

test("earned Coin buys capacity that survives reload, login and deletion", async ({
  page,
}, info) => {
  const account = await earnedAccount(page, info.project.name, "purchase");
  await openNew(page);
  await createNotebook(page, "Ücretsiz defter");
  await openNew(page);
  const dialog = page.getByRole("dialog", { name: "Bir deftere daha yer aç" });
  await expect(dialog.getByText("Kullanılabilir Coin: 20")).toBeVisible();
  const purchase = page.waitForResponse(
    (res) =>
      res.url() === `${api}/economy/notebook-slots` &&
      res.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "20 Coin ile +1 defter kapasitesi aç" })
    .click();
  expect((await purchase).status()).toBe(201);
  expect((await account.balance()).coinConfirmed).toBe(0);
  await createNotebook(page, "Coin defteri");
  await page.reload();
  await expect(
    page.getByText("Özel defter: 2 / 2", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("purchased-notebook.png") });

  // Real logout clears the scoped refresh cookie; signing in through the form restores ownership.
  expect(
    (await page.context().request.post(`${api}/auth/logout`)).status(),
  ).toBe(204);
  await page.goto("/giris?next=/defterlerim");
  await page.getByLabel("E-posta", { exact: true }).fill(account.email);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  const loginResponse = page.waitForResponse(
    (res) => res.url() === `${api}/auth/login` && res.status() === 200,
  );
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  account.headers.Authorization = `Bearer ${((await (await loginResponse).json()) as AuthSession).accessToken}`;
  await expect(
    page.getByText("Özel defter: 2 / 2", { exact: true }),
  ).toBeVisible();
  await removeNotebook(page, "Coin defteri");
  await openNew(page);
  await expect(page.getByLabel("Defter adı")).toBeVisible();
  await createNotebook(page, "Yeniden kullanılan kapasite");
  const list = await page
    .context()
    .request.get(`${api}/coaching/notebooks`, { headers: account.headers });
  const notebooks = (await list.json()) as Paginated<NotebookSummaryDto>;
  expect(notebooks.items[0].limits).toMatchObject({
    maxCustomNotebooks: 2,
    maxPages: 20,
    maxEntries: 50,
    maxPhotos: 5,
  });
  expect((await account.balance()).coinConfirmed).toBe(0);
});

test("admin changes price and cap; economy-off preserves reusable capacity", async ({
  page,
  request,
}, info) => {
  const admin = await operator(request);
  const account = await earnedAccount(page, info.project.name, "switches");
  await openNew(page);
  await createNotebook(page, "İlk defter");
  await openNew(page);
  await expect(
    page.getByRole("button", { name: "20 Coin ile +1 defter kapasitesi aç" }),
  ).toBeVisible();
  await setting(request, admin, "economy.coin.notebook_slot_cost", 10);
  await page
    .getByRole("button", { name: "20 Coin ile +1 defter kapasitesi aç" })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Fiyat veya kapasite değişti",
  );
  expect((await account.balance()).coinConfirmed).toBe(20);
  await page
    .getByRole("button", { name: "10 Coin ile +1 defter kapasitesi aç" })
    .click();
  await createNotebook(page, "İkinci defter");
  await openNew(page);
  await page
    .getByRole("button", { name: "10 Coin ile +1 defter kapasitesi aç" })
    .click();
  await createNotebook(page, "Üçüncü defter");
  expect((await account.balance()).coinConfirmed).toBe(0);
  await openNew(page);
  await expect(page.getByRole("dialog")).toContainText(
    "ek kapasite sınırına ulaştın",
  );
  await expect(page.getByRole("button", { name: /Coin ile \+1/ })).toHaveCount(
    0,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kapat", exact: true })
    .click();
  await setting(request, admin, "economy.notebook_slots.max_per_user", 0);
  await setting(request, admin, "economy.enabled", false);
  await page.reload();
  await expect(
    page.getByText("Özel defter: 3 / 3", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('[aria-label="Coin ve XP"]:visible')).toHaveCount(
    0,
  );
  await openNew(page);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Premium seçeneklerini gör" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Coin ile \+1/ })).toHaveCount(
    0,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kapat", exact: true })
    .click();
  await removeNotebook(page, "Üçüncü defter");
  await openNew(page);
  await createNotebook(page, "Ekonomi kapalıyken yeniden kullanım");
  await page.screenshot({
    path: info.outputPath("economy-off-owned-capacity.png"),
  });
  const quests = await page
    .context()
    .request.get(`${api}/economy/quests`, { headers: account.headers });
  expect(
    (
      (await quests.json()) as { rewardUnit: string; rewardAmount: number }[]
    ).every((q) => q.rewardUnit === "NONE" && q.rewardAmount === 0),
  ).toBe(true);
  await setting(request, admin, "economy.enabled", true);
  await page.reload();
  await expect(
    page.getByText("Özel defter: 3 / 3", { exact: true }),
  ).toBeVisible();
  const state = await page
    .context()
    .request.get(`${api}/economy/notebook-slots`, { headers: account.headers });
  expect((await state.json()) as NotebookSlotView).toMatchObject({
    purchasedSlots: 2,
    maxPurchasableSlots: 0,
    status: "LIMIT_REACHED",
  });
  expect((await account.balance()).coinConfirmed).toBe(0);
});
