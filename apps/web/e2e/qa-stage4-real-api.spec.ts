import { execFileSync } from "node:child_process";
import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";

const api = process.env.QA_STAGE4_API_URL;
const runId = process.env.QA_STAGE4_RUN_ID ?? "";
const evidenceDate = new Date().toISOString().slice(0, 10);
test.skip(api !== "http://localhost:3001/v1" || !/^[a-z0-9]{8}$/.test(runId),
  "Requires the isolated Stage 4 API and a short run ID.");
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const adminUrl = "http://localhost:3203";
const password = "MentorQa!2026";
type Account = {
  email: string;
  id: string;
  displayName: string;
  token: string;
  refreshCookies: Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"];
};
const accounts: Record<string, Account> = {};
const initialFlags: Record<string, boolean> = {};
const flagKeys = ["forum.enabled", "mentorship.enabled", "mentorship.seats.sponsorship_enabled"] as const;
let adminToken = "";

function serviceSql(sql: string) {
  execFileSync("docker", [
    "exec", "mentor-postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "mentor",
    "-d", "mentor_test", "-c", `begin; select set_config('app.role','SERVICE',true); ${sql} commit;`,
  ]);
}

async function ensureAccount(request: APIRequestContext, label: string): Promise<Account> {
  const email = `qa-stage4-${runId}-${label}@example.test`;
  const displayName = `QA Stage Four ${label}`;
  let response = await request.post(`${api}/auth/login`, { data: { email, password } });
  if (response.status() === 429) {
    // Previous QA runs share the local signup/login throttle; wait for its minute window once.
    await new Promise((resolve) => setTimeout(resolve, 60_000));
    response = await request.post(`${api}/auth/login`, { data: { email, password } });
  }
  if (response.status() === 401) {
    const signup = () => request.post(`${api}/auth/signup`, {
      data: {
        email, password, displayName, username: `qa4_${runId}_${label}`,
        kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true,
        intent: "STUDENT",
      },
    });
    response = await signup();
    if (response.status() === 429) {
      await new Promise((resolve) => setTimeout(resolve, 65_000));
      response = await signup();
    }
    expect(response.status()).toBe(201);
  } else {
    expect(response.status()).toBe(200);
  }
  const body = await response.json() as { accessToken: string; user: { id: string } };
  const refreshCookies = (await request.storageState()).cookies.filter(
    (cookie) => cookie.name === "mentor_web_refresh",
  );
  expect(refreshCookies).toHaveLength(1);
  return { email, id: body.user.id, displayName, token: body.accessToken, refreshCookies };
}

async function setFlag(request: APIRequestContext, key: string, value: boolean) {
  const response = await request.patch(`${api}/admin/config/${key}`, {
    headers: { Authorization: `Bearer ${adminToken}` }, data: { value },
  });
  expect(response.status()).toBe(200);
}

async function browserLogin(context: BrowserContext, account: Account) {
  await context.addCookies(account.refreshCookies);
}

async function acknowledgeJourneyLevels(context: BrowserContext, account: Account) {
  const headers = { Authorization: `Bearer ${account.token}` };
  const pending = await context.request.get(`${api}/community/journey-levels/unseen`, { headers });
  expect(pending.status()).toBe(200);
  for (const { id } of (await pending.json() as { celebrations: Array<{ id: string }> }).celebrations) {
    const acknowledged = await context.request.post(`${api}/community/journey-levels/celebrated`, {
      headers, data: { celebrationId: id },
    });
    expect(acknowledged.status()).toBe(204);
  }
}

test.beforeAll(async ({ request }) => {
  test.setTimeout(300_000); // Signup throttling may require one full minute per disposable account.
  for (const label of ["admin", "coach", "mobile"]) {
    accounts[label] = await ensureAccount(request, label);
  }
  const profile = await request.patch(`${api}/users/me`, {
    headers: { Authorization: `Bearer ${accounts.mobile!.token}` },
    data: { examType: "KPSS", examVariant: "LISANS" },
  });
  expect(profile.status()).toBe(200);
  serviceSql(`
    update users set roles=array_append(roles,'SUPER_ADMIN')
      where id='${accounts.admin!.id}' and array_position(roles,'SUPER_ADMIN') is null;
    update users set roles=array_append(roles,'COACH'), email_verified_at=now()
      where id='${accounts.coach!.id}' and array_position(roles,'COACH') is null;
    update users set email_verified_at=now() where id='${accounts.coach!.id}';
    insert into mentorship_coach_applications (user_id,status,headline,bio)
      values ('${accounts.coach!.id}','ACTIVE','QA coach','Synthetic Stage 4 test profile')
      on conflict (user_id) do update set status='ACTIVE';
  `);
  const login = await request.post(`${api}/auth/admin/login`, {
    data: { email: accounts.admin!.email, password },
  });
  expect(login.status()).toBe(200);
  adminToken = (await login.json() as { accessToken: string }).accessToken;

  const config = await request.get(`${api}/admin/config`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(config.status()).toBe(200);
  const entries = await config.json() as Array<{ key: string; value: unknown }>;
  for (const key of flagKeys) {
    const entry = entries.find((item) => item.key === key);
    expect(entry?.value).toEqual(expect.any(Boolean));
    initialFlags[key] = entry!.value as boolean;
  }
  await setFlag(request, "forum.enabled", true);
  await setFlag(request, "mentorship.enabled", true);
  // Fake providers and disposable accounts in mentor_test only; restore the production-off default.
  await setFlag(request, "mentorship.seats.sponsorship_enabled", true);
});

test.afterAll(async ({ request }) => {
  if (accounts.mobile) {
    await request.delete(`${api}/mentorship/my-coach`, {
      headers: { Authorization: `Bearer ${accounts.mobile.token}` },
    });
  }
  if (adminToken) {
    for (const key of [...flagKeys].reverse()) {
      if (key in initialFlags) await setFlag(request, key, initialFlags[key]!);
    }
  }
});

test("C01: real community hub loads in TR and EN", async ({ page, context, request }, testInfo) => {
  const student = accounts.mobile!;
  await browserLogin(context, student);
  await acknowledgeJourneyLevels(context, student);
  const hub = await request.get(`${api}/forum/hub`, {
    headers: { Authorization: `Bearer ${student.token}` },
  });
  expect(hub.status()).toBe(200);
  await page.goto("/topluluk");
  await expect(page).toHaveURL(/\/topluluk$/);
  await expect(page.getByRole("region", { name: "Öne çıkan gönderi" })).toBeVisible();
  await page.screenshot({ path: `../../docs/qa/evidence/${evidenceDate}-stage4-community-${testInfo.project.name}.png` });
  await page.goto("/en/community");
  await expect(page).toHaveURL(/\/en\/community$/);
  await expect(page.getByRole("region", { name: "Featured post" })).toBeVisible();
  // The web client rotates the refresh cookie on first load; keep the current one for M01.
  student.refreshCookies = (await context.cookies()).filter(
    (cookie) => cookie.name === "mentor_web_refresh",
  );
  expect(student.refreshCookies).toHaveLength(1);
});

test("M01: consent gates a coach link and ending it revokes private reads", async (
  { page, context, browser, request }, testInfo,
) => {
  const student = accounts.mobile!;
  const other = accounts.admin!;
  const coach = accounts.coach!;
  await browserLogin(context, student);
  await acknowledgeJourneyLevels(context, student);
  const coachAuth = { Authorization: `Bearer ${coach.token}` };
  const studentAuth = { Authorization: `Bearer ${student.token}` };
  const privateMarker = `stage4-private-${runId}-${testInfo.project.name}`;
  const privateChat = await request.post(`${api}/coach/chat`, {
    headers: studentAuth,
    data: { message: `Kendime zarar vermek istiyorum ${privateMarker}` },
  });
  expect(privateChat.status()).toBe(201);
  const issue = await request.post(`${api}/mentorship/invite-code`, { headers: coachAuth });
  expect(issue.status()).toBe(200);
  const code = (await issue.json() as { code: string }).code;
  expect((await request.get(`${api}/mentorship/students/${student.id}`, { headers: coachAuth })).status()).toBe(404);

  await page.goto(`/kocluk-daveti?code=${code}`);
  await expect(page.getByLabel("Davet kodu")).toHaveValue(code);
  const noCoach = await request.get(`${api}/mentorship/my-coach`, { headers: studentAuth });
  expect(noCoach.status()).toBe(200);
  expect(await noCoach.text()).toBe("");
  await page.getByRole("button", { name: "Kodu getir" }).click();
  await expect(page.getByRole("heading", { name: "Koçunun görebildikleri" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Koçunun göremedikleri" })).toBeVisible();
  await page.screenshot({ path: `../../docs/qa/evidence/${evidenceDate}-stage4-consent-${testInfo.project.name}.png` });

  await page.goto(`/en/coach-invitation?code=${code}`);
  await expect(page.getByLabel("Invite code")).toHaveValue(code);
  await page.getByRole("button", { name: "Look it up" }).click();
  await expect(page.getByRole("heading", { name: "What your coach can see" })).toBeVisible();
  await page.getByRole("button", { name: "I agree, connect me" }).click();
  await expect(page).toHaveURL(/\/en\/my-coach$/);
  await expect(page.getByText(coach.displayName)).toBeVisible();

  const linked = await request.get(`${api}/mentorship/students/${student.id}`, { headers: coachAuth });
  expect(linked.status()).toBe(200);
  expect(JSON.stringify(await linked.json())).not.toContain(privateMarker);
  const roster = await request.get(`${api}/mentorship/students`, { headers: coachAuth });
  expect(roster.status()).toBe(200);
  expect(JSON.stringify(await roster.json())).not.toContain(privateMarker);
  expect((await request.get(`${api}/mentorship/students/${other.id}`, { headers: coachAuth })).status()).toBe(404);
  const coachContext = await browser.newContext({
    baseURL: "http://localhost:3000",
    viewport: testInfo.project.name.startsWith("mobile")
      ? { width: 375, height: 812 }
      : { width: 1280, height: 800 },
  });
  try {
    await browserLogin(coachContext, coach);
    await acknowledgeJourneyLevels(coachContext, coach);
    const coachPage = await coachContext.newPage();
    await coachPage.goto("/kocluk");
    await expect(coachPage.getByText(student.displayName)).toBeVisible();
    await coachPage.screenshot({ path: `../../docs/qa/evidence/${evidenceDate}-stage4-roster-${testInfo.project.name}.png` });
  } finally {
    await coachContext.close();
  }
  const ended = await request.delete(`${api}/mentorship/my-coach`, { headers: studentAuth });
  expect(ended.status()).toBe(204);
  expect((await request.get(`${api}/mentorship/students/${student.id}`, { headers: coachAuth })).status()).toBe(404);
});

test("A01: admin Chrome login shows role-gated settings", async (
  { page, context, request }, testInfo,
) => {
  const denied = await request.get(`${api}/admin/config`, {
    headers: { Authorization: `Bearer ${accounts.mobile!.token}` },
  });
  expect(denied.status()).toBe(403);
  await page.goto(`${adminUrl}/login`);
  await page.getByLabel("E-posta").fill(accounts.admin!.email);
  await page.getByLabel("Şifre").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(adminUrl + "/");
  await page.goto(`${adminUrl}/config`);
  await expect(page.getByText("mentorship.enabled", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ayarlar" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("mentor_admin_token"))).toBeNull();
  await page.screenshot({ path: `../../docs/qa/evidence/${evidenceDate}-stage4-admin-${testInfo.project.name}.png` });
  const cookies = await context.cookies();
  expect(cookies.some((cookie) => cookie.name === "mentor_admin_refresh" && cookie.httpOnly)).toBe(true);
});
