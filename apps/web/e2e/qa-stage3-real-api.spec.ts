import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test, type BrowserContext } from "@playwright/test";

const api = process.env.QA_STAGE3_API_URL;
test.skip(api !== "http://localhost:3201/v1", "Requires the isolated Stage 3 QA API.");
test.describe.configure({ mode: "serial" });

const suffix = randomUUID().slice(0, 8);
const account = { email: `qa-stage3-${suffix}@example.test`, password: "MentorQa!2026" };
const planId = randomUUID();
let userId = "";

function serviceSql(sql: string) {
  execFileSync("docker", [
    "exec", "mentor-postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "mentor",
    "-d", "mentor_test", "-c", `begin; select set_config('app.role','SERVICE',true); ${sql} commit;`,
  ]);
}

test.beforeAll(async ({ request }) => {
  const signup = await request.post(`${api}/auth/signup`, {
    data: {
      ...account,
      displayName: "QA Stage Three",
      username: `qa_stage3_${suffix}`,
      kvkkAccepted: true,
      termsAccepted: true,
      ageEligibilityConfirmed: true,
      intent: "STUDENT",
    },
  });
  expect(signup.status()).toBe(201);
  const body = await signup.json() as { accessToken: string; user: { id: string } };
  userId = body.user.id;
  const profile = await request.patch(`${api}/users/me`, {
    data: { examType: "KPSS", examVariant: "LISANS" },
    headers: { Authorization: `Bearer ${body.accessToken}` },
  });
  expect(profile.status()).toBe(200);
  // Profile completion may earn Coin when the economy flag was left on by another QA run.
  // Keep this account Free with no spendable right using an append-only adjustment.
  serviceSql(`insert into ledger_entries (user_id,unit,amount,reason,status)
    select '${userId}','COIN',-sum(amount)::int,'qa.stage3.zero-balance','CONFIRMED'
    from ledger_entries where user_id='${userId}' and unit='COIN' and status='CONFIRMED'
    having sum(amount)>0;`);
});

test.afterAll(() => {
  if (!userId) return;
  serviceSql(`delete from subscriptions where user_id='${userId}' and plan_id='${planId}'; delete from plans where id='${planId}';`);
});

async function login(context: BrowserContext): Promise<string> {
  const response = await context.request.post(`${api}/auth/login`, { data: account });
  expect(response.status()).toBe(200);
  return (await response.json() as { accessToken: string }).accessToken;
}

async function acknowledgeJourneyLevels(context: BrowserContext, token: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const pending = await context.request.get(`${api}/community/journey-levels/unseen`, { headers });
  expect(pending.status()).toBe(200);
  for (const { id } of (await pending.json() as { celebrations: Array<{ id: string }> }).celebrations) {
    const acknowledged = await context.request.post(`${api}/community/journey-levels/celebrated`, {
      headers, data: { celebrationId: id },
    });
    expect(acknowledged.status()).toBe(204);
  }
}

test("A01: Free chat is gated by the real API in TR and EN", async ({ page, context }) => {
  const token = await login(context);
  const auth = { Authorization: `Bearer ${token}` };
  const access = await context.request.get(`${api}/coach/access`, { headers: auth });
  expect(access.status()).toBe(200);
  const freeAccess = await access.json() as { canChat: boolean; mode: string; reason: string };
  expect(freeAccess).toMatchObject({ canChat: false, mode: "NONE" });
  const blocked = await context.request.post(`${api}/coach/chat`, {
    headers: auth, data: { message: "Bugün nasıl çalışmalıyım?" },
  });
  expect(blocked.status()).toBe(freeAccess.reason === "INSUFFICIENT_COIN" ? 422 : 403);

  let streams = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/v1/coach/chat/stream")) streams++;
  });
  await page.goto("/koc/sohbet");
  await expect(page).toHaveURL(/\/koc\/sohbet$/);
  await expect(page.getByText("Premium veya kazanılmış hakla sohbet açık.")).toBeVisible();
  await expect(page.locator("#coach-input")).toHaveCount(0);
  await page.goto("/en/coach/chat");
  await expect(page).toHaveURL(/\/en\/coach\/chat$/);
  await expect(page.getByText("Chat opens with Premium or an earned right.")).toBeVisible();
  await expect(page.locator("#coach-input")).toHaveCount(0);
  expect(streams).toBe(0);
});

test("A02/P01: fake Premium opens chat and shows subscription facts", async ({ page, context }, testInfo) => {
  serviceSql(`
    insert into plans (id,name,period_months,price_minor,currency,trial_days,is_active)
      values ('${planId}','QA Stage 3 Premium',1,24900,'TRY',7,true);
    insert into subscriptions (user_id,plan_id,status,provider,provider_ref,current_period_start,current_period_end)
      values ('${userId}','${planId}','ACTIVE','FAKE','qa_stage3_${suffix}',now(),now()+interval '30 days');
    insert into coach_profiles (user_id,calibration_status,memory_consent)
      values ('${userId}','COMPLETED','DECLINED')
      on conflict (user_id) do update set calibration_status='COMPLETED';
  `);
  const token = await login(context);
  const auth = { Authorization: `Bearer ${token}` };
  const access = await context.request.get(`${api}/coach/access`, { headers: auth });
  expect(await access.json()).toMatchObject({ canChat: true, mode: "PREMIUM" });

  // Profile completion earned the first journey level. Acknowledge that separate product event
  // before exercising the chat composer, so its full-screen celebration cannot cover the send CTA.
  await acknowledgeJourneyLevels(context, token);

  await page.goto("/koc/sohbet");
  const levelUp = page.locator('.journey-spotlight-theme[role="dialog"]');
  if (await levelUp.isVisible()) {
    await levelUp.getByRole("button", { name: "Devam et" }).click();
    await expect(levelUp).toBeHidden();
  }
  const input = page.locator("#coach-input");
  await expect(input).toBeEnabled();
  const message = `Bugün bir küçük adım seçelim ${suffix}`;
  await input.fill(message);
  const streamed = page.waitForResponse((response) =>
    response.url() === `${api}/coach/chat/stream` && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Gönder" }).click();
  expect((await streamed).status()).toBe(201);
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page.getByText(/25 dakikalık odak \+ 5 dakika mola/)).toBeVisible();
  await page.screenshot({ path: `../../docs/qa/evidence/2026-09-24-stage3-premium-chat-${testInfo.project.name}.png` });
  await page.goto("/abonelik");
  await expect(page.getByRole("button", { name: "Aboneliği iptal et" })).toBeVisible();
});

test("N01: notification preferences persist after a real browser reload", async ({ page, context }) => {
  const token = await login(context);
  const auth = { Authorization: `Bearer ${token}` };
  await acknowledgeJourneyLevels(context, token);
  await page.goto("/ayarlar");
  const email = page.getByRole("switch", { name: "E-posta hatırlatmaları" });
  await expect(email).toBeVisible();
  const initiallyChecked = await email.isChecked();
  await email.click();
  await expect(email).toHaveAttribute("aria-checked", String(!initiallyChecked));
  await expect.poll(async () => {
    const response = await context.request.get(`${api}/notifications/preferences`, { headers: auth });
    expect(response.status()).toBe(200);
    return (await response.json() as { emailEnabled: boolean }).emailEnabled;
  }).toBe(!initiallyChecked);
  await page.reload();
  await expect(page.getByRole("switch", { name: "E-posta hatırlatmaları" })).toHaveAttribute("aria-checked", String(!initiallyChecked));
  await page.getByRole("switch", { name: "E-posta hatırlatmaları" }).click();
  await expect.poll(async () => {
    const response = await context.request.get(`${api}/notifications/preferences`, { headers: auth });
    return (await response.json() as { emailEnabled: boolean }).emailEnabled;
  }).toBe(initiallyChecked);
});
