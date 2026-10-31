import { createHash } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import type {
  AuthSession,
  EconomyBalance,
  QuestProgressView,
} from "@mentor/types";

export const api = "http://localhost:3501/v1";
const password = "NotebookQa!2026";
export type Headers = { Authorization: string };

export async function operator(request: APIRequestContext): Promise<Headers> {
  const login = await request.post(`${api}/auth/login`, {
    data: {
      email: `qa-notebook-operator-${process.env.QA_NOTEBOOK_RUN_ID}@example.test`,
      password,
    },
  });
  expect(login.status()).toBe(200);
  return {
    Authorization: `Bearer ${((await login.json()) as AuthSession).accessToken}`,
  };
}

export async function setting(
  request: APIRequestContext,
  headers: Headers,
  key: string,
  value: unknown,
) {
  const result = await request.patch(`${api}/admin/config/${key}`, {
    headers,
    data: { value },
  });
  expect(result.status()).toBe(200);
}

export async function account(page: Page, project: string, scenario: string) {
  const email = `qa-notebook-${project}-${scenario}-${process.env.QA_NOTEBOOK_RUN_ID}@example.test`;
  const login = await page.request.post(`${api}/auth/login`, {
    data: { email, password },
  });
  expect(login.status()).toBe(200);
  const session = (await login.json()) as AuthSession;
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  // Optional welcome and reward overlays are dismissed through their ordinary UI controls.
  await page.addLocatorHandler(
    page.getByRole("button", { name: "Harika!", exact: true }),
    async (locator) => locator.click(),
  );
  await page.addLocatorHandler(
    page.getByRole("dialog", { name: /^Seviye \d+ ·/ }),
    async (locator) => {
      await locator
        .getByRole("button", { name: "Devam et", exact: true })
        .click();
    },
  );
  const profile = async () => {
    const result = await page.request.patch(`${api}/users/me`, {
      headers,
      data: { examType: "KPSS", examVariant: "LISANS" },
    });
    expect(result.status()).toBe(200);
  };
  const verify = async () => {
    const raw = createHash("sha256").update(email).digest("hex");
    await page.goto(`/eposta-dogrula?token=${raw}`);
    await expect(
      page.getByText("E-postan doğrulandı. Hoş geldin!", { exact: true }),
    ).toBeVisible();
  };
  const balance = async () => {
    const result = await page.request.get(`${api}/economy/balance`, {
      headers,
    });
    expect(result.status()).toBe(200);
    return (await result.json()) as EconomyBalance;
  };
  const quests = async () => {
    const result = await page.request.get(`${api}/economy/quests`, { headers });
    expect(result.status()).toBe(200);
    return (await result.json()) as QuestProgressView[];
  };
  return { id: session.user.id, headers, profile, verify, balance, quests };
}

export async function overview(
  request: APIRequestContext,
  admin: Headers,
  id: string,
) {
  const result = await request.get(`${api}/admin/users/${id}/economy`, {
    headers: admin,
  });
  expect(result.status()).toBe(200);
  return (await result.json()) as {
    balance: { xp: number; coinConfirmed: number; coinPending: number };
    ledger: { amount: number; reason: string }[];
  };
}

export async function openQuests(page: Page) {
  await page.goto("/ayarlar");
  await page.getByRole("button", { name: "Görevler", exact: true }).click();
  return page.getByRole("dialog", { name: "Görevler", exact: true });
}

export async function addAndCompleteTask(page: Page, title: string) {
  await page.goto("/plan");
  await page.getByRole("button", { name: "Görev ekle", exact: true }).click();
  const sheet = page
    .getByLabel("Yeni görev", { exact: true })
    .filter({
      has: page.getByRole("button", { name: "Görev ekle", exact: true }),
    });
  await page
    .getByRole("textbox", { name: "Yeni görev", exact: true })
    .fill(title);
  const created = page.waitForResponse(
    (res) =>
      res.url() === `${api}/plan-tasks` && res.request().method() === "POST",
  );
  await sheet.getByRole("button", { name: "Görev ekle", exact: true }).click();
  expect((await created).status()).toBe(201);
  const done = page.waitForResponse(
    (res) =>
      res.url().startsWith(`${api}/plan-tasks/`) &&
      res.request().method() === "PATCH",
  );
  await page.getByRole("checkbox", { name: title, exact: true }).click();
  expect((await done).status()).toBe(200);
  await expect(
    page.getByRole("checkbox", { name: title, exact: true }),
  ).toBeChecked();
}
