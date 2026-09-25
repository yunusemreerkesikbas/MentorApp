# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qa-stage4-real-api.spec.ts >> A01: admin Chrome login shows role-gated settings
- Location: e2e\qa-stage4-real-api.spec.ts:233:5

# Error details

```
"beforeAll" hook timeout of 30000ms exceeded.
```

# Test source

```ts
  1   | import { execFileSync } from "node:child_process";
  2   | import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
  3   | 
  4   | const api = process.env.QA_STAGE4_API_URL;
  5   | const runId = process.env.QA_STAGE4_RUN_ID ?? "";
  6   | const evidenceDate = new Date().toISOString().slice(0, 10);
  7   | test.skip(api !== "http://localhost:3001/v1" || !/^[a-z0-9]{8}$/.test(runId),
  8   |   "Requires the isolated Stage 4 API and a short run ID.");
  9   | test.describe.configure({ mode: "serial" });
  10  | test.setTimeout(120_000);
  11  | 
  12  | const adminUrl = "http://localhost:3203";
  13  | const password = "MentorQa!2026";
  14  | type Account = {
  15  |   email: string;
  16  |   id: string;
  17  |   displayName: string;
  18  |   token: string;
  19  |   refreshCookies: Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"];
  20  | };
  21  | const accounts: Record<string, Account> = {};
  22  | const initialFlags: Record<string, boolean> = {};
  23  | const flagKeys = ["forum.enabled", "mentorship.enabled", "mentorship.seats.sponsorship_enabled"] as const;
  24  | let adminToken = "";
  25  | 
  26  | function serviceSql(sql: string) {
  27  |   execFileSync("docker", [
  28  |     "exec", "mentor-postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "mentor",
  29  |     "-d", "mentor_test", "-c", `begin; select set_config('app.role','SERVICE',true); ${sql} commit;`,
  30  |   ]);
  31  | }
  32  | 
  33  | async function ensureAccount(request: APIRequestContext, label: string): Promise<Account> {
  34  |   const email = `qa-stage4-${runId}-${label}@example.test`;
  35  |   const displayName = `QA Stage Four ${label}`;
  36  |   let response = await request.post(`${api}/auth/login`, { data: { email, password } });
  37  |   if (response.status() === 429) {
  38  |     // Previous QA runs share the local signup/login throttle; wait for its minute window once.
  39  |     await new Promise((resolve) => setTimeout(resolve, 60_000));
  40  |     response = await request.post(`${api}/auth/login`, { data: { email, password } });
  41  |   }
  42  |   if (response.status() === 401) {
  43  |     const signup = () => request.post(`${api}/auth/signup`, {
  44  |       data: {
  45  |         email, password, displayName, username: `qa4_${runId}_${label}`,
  46  |         kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true,
  47  |         intent: "STUDENT",
  48  |       },
  49  |     });
  50  |     response = await signup();
  51  |     if (response.status() === 429) {
  52  |       await new Promise((resolve) => setTimeout(resolve, 65_000));
  53  |       response = await signup();
  54  |     }
  55  |     expect(response.status()).toBe(201);
  56  |   } else {
  57  |     expect(response.status()).toBe(200);
  58  |   }
  59  |   const body = await response.json() as { accessToken: string; user: { id: string } };
  60  |   const refreshCookies = (await request.storageState()).cookies.filter(
  61  |     (cookie) => cookie.name === "mentor_web_refresh",
  62  |   );
  63  |   expect(refreshCookies).toHaveLength(1);
  64  |   return { email, id: body.user.id, displayName, token: body.accessToken, refreshCookies };
  65  | }
  66  | 
  67  | async function setFlag(request: APIRequestContext, key: string, value: boolean) {
  68  |   const response = await request.patch(`${api}/admin/config/${key}`, {
  69  |     headers: { Authorization: `Bearer ${adminToken}` }, data: { value },
  70  |   });
  71  |   expect(response.status()).toBe(200);
  72  | }
  73  | 
  74  | async function browserLogin(context: BrowserContext, account: Account) {
  75  |   await context.addCookies(account.refreshCookies);
  76  | }
  77  | 
  78  | async function acknowledgeJourneyLevels(context: BrowserContext, account: Account) {
  79  |   const headers = { Authorization: `Bearer ${account.token}` };
  80  |   const pending = await context.request.get(`${api}/community/journey-levels/unseen`, { headers });
  81  |   expect(pending.status()).toBe(200);
  82  |   for (const { id } of (await pending.json() as { celebrations: Array<{ id: string }> }).celebrations) {
  83  |     const acknowledged = await context.request.post(`${api}/community/journey-levels/celebrated`, {
  84  |       headers, data: { celebrationId: id },
  85  |     });
  86  |     expect(acknowledged.status()).toBe(204);
  87  |   }
  88  | }
  89  | 
> 90  | test.beforeAll(async ({ request }) => {
      |      ^ "beforeAll" hook timeout of 30000ms exceeded.
  91  |   for (const label of ["admin", "coach", "mobile"]) {
  92  |     accounts[label] = await ensureAccount(request, label);
  93  |   }
  94  |   const profile = await request.patch(`${api}/users/me`, {
  95  |     headers: { Authorization: `Bearer ${accounts.mobile!.token}` },
  96  |     data: { examType: "KPSS", examVariant: "LISANS" },
  97  |   });
  98  |   expect(profile.status()).toBe(200);
  99  |   serviceSql(`
  100 |     update users set roles=array_append(roles,'SUPER_ADMIN')
  101 |       where id='${accounts.admin!.id}' and array_position(roles,'SUPER_ADMIN') is null;
  102 |     update users set roles=array_append(roles,'COACH'), email_verified_at=now()
  103 |       where id='${accounts.coach!.id}' and array_position(roles,'COACH') is null;
  104 |     update users set email_verified_at=now() where id='${accounts.coach!.id}';
  105 |     insert into mentorship_coach_applications (user_id,status,headline,bio)
  106 |       values ('${accounts.coach!.id}','ACTIVE','QA coach','Synthetic Stage 4 test profile')
  107 |       on conflict (user_id) do update set status='ACTIVE';
  108 |   `);
  109 |   const login = await request.post(`${api}/auth/admin/login`, {
  110 |     data: { email: accounts.admin!.email, password },
  111 |   });
  112 |   expect(login.status()).toBe(200);
  113 |   adminToken = (await login.json() as { accessToken: string }).accessToken;
  114 | 
  115 |   const config = await request.get(`${api}/admin/config`, {
  116 |     headers: { Authorization: `Bearer ${adminToken}` },
  117 |   });
  118 |   expect(config.status()).toBe(200);
  119 |   const entries = await config.json() as Array<{ key: string; value: unknown }>;
  120 |   for (const key of flagKeys) {
  121 |     const entry = entries.find((item) => item.key === key);
  122 |     expect(entry?.value).toEqual(expect.any(Boolean));
  123 |     initialFlags[key] = entry!.value as boolean;
  124 |   }
  125 |   await setFlag(request, "forum.enabled", true);
  126 |   await setFlag(request, "mentorship.enabled", true);
  127 |   // Fake providers and disposable accounts in mentor_test only; restore the production-off default.
  128 |   await setFlag(request, "mentorship.seats.sponsorship_enabled", true);
  129 | });
  130 | 
  131 | test.afterAll(async ({ request }) => {
  132 |   if (accounts.mobile) {
  133 |     await request.delete(`${api}/mentorship/my-coach`, {
  134 |       headers: { Authorization: `Bearer ${accounts.mobile.token}` },
  135 |     });
  136 |   }
  137 |   if (adminToken) {
  138 |     for (const key of [...flagKeys].reverse()) {
  139 |       if (key in initialFlags) await setFlag(request, key, initialFlags[key]!);
  140 |     }
  141 |   }
  142 | });
  143 | 
  144 | test("C01: real community hub loads in TR and EN", async ({ page, context, request }, testInfo) => {
  145 |   const student = accounts.mobile!;
  146 |   await browserLogin(context, student);
  147 |   await acknowledgeJourneyLevels(context, student);
  148 |   const hub = await request.get(`${api}/forum/hub`, {
  149 |     headers: { Authorization: `Bearer ${student.token}` },
  150 |   });
  151 |   expect(hub.status()).toBe(200);
  152 |   await page.goto("/topluluk");
  153 |   await expect(page).toHaveURL(/\/topluluk$/);
  154 |   await expect(page.getByRole("region", { name: "Öne çıkan gönderi" })).toBeVisible();
  155 |   await page.screenshot({ path: `../../docs/qa/evidence/${evidenceDate}-stage4-community-${testInfo.project.name}.png` });
  156 |   await page.goto("/en/community");
  157 |   await expect(page).toHaveURL(/\/en\/community$/);
  158 |   await expect(page.getByRole("region", { name: "Featured post" })).toBeVisible();
  159 |   // The web client rotates the refresh cookie on first load; keep the current one for M01.
  160 |   student.refreshCookies = (await context.cookies()).filter(
  161 |     (cookie) => cookie.name === "mentor_web_refresh",
  162 |   );
  163 |   expect(student.refreshCookies).toHaveLength(1);
  164 | });
  165 | 
  166 | test("M01: consent gates a coach link and ending it revokes private reads", async (
  167 |   { page, context, browser, request }, testInfo,
  168 | ) => {
  169 |   const student = accounts.mobile!;
  170 |   const other = accounts.admin!;
  171 |   const coach = accounts.coach!;
  172 |   await browserLogin(context, student);
  173 |   await acknowledgeJourneyLevels(context, student);
  174 |   const coachAuth = { Authorization: `Bearer ${coach.token}` };
  175 |   const studentAuth = { Authorization: `Bearer ${student.token}` };
  176 |   const privateMarker = `stage4-private-${runId}-${testInfo.project.name}`;
  177 |   const privateChat = await request.post(`${api}/coach/chat`, {
  178 |     headers: studentAuth,
  179 |     data: { message: `Kendime zarar vermek istiyorum ${privateMarker}` },
  180 |   });
  181 |   expect(privateChat.status()).toBe(201);
  182 |   const issue = await request.post(`${api}/mentorship/invite-code`, { headers: coachAuth });
  183 |   expect(issue.status()).toBe(200);
  184 |   const code = (await issue.json() as { code: string }).code;
  185 |   expect((await request.get(`${api}/mentorship/students/${student.id}`, { headers: coachAuth })).status()).toBe(404);
  186 | 
  187 |   await page.goto(`/kocluk-daveti?code=${code}`);
  188 |   await expect(page.getByLabel("Davet kodu")).toHaveValue(code);
  189 |   const noCoach = await request.get(`${api}/mentorship/my-coach`, { headers: studentAuth });
  190 |   expect(noCoach.status()).toBe(200);
```