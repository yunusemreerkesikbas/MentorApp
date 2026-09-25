# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qa-stage4-real-api.spec.ts >> A01: admin Chrome login shows role-gated settings
- Location: e2e\qa-stage4-real-api.spec.ts:228:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 429
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
  43  |     response = await request.post(`${api}/auth/signup`, {
  44  |       data: {
  45  |         email, password, displayName, username: `qa4_${runId}_${label}`,
  46  |         kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true,
  47  |         intent: "STUDENT",
  48  |       },
  49  |     });
> 50  |     expect(response.status()).toBe(201);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  51  |   } else {
  52  |     expect(response.status()).toBe(200);
  53  |   }
  54  |   const body = await response.json() as { accessToken: string; user: { id: string } };
  55  |   const refreshCookies = (await request.storageState()).cookies.filter(
  56  |     (cookie) => cookie.name === "mentor_web_refresh",
  57  |   );
  58  |   expect(refreshCookies).toHaveLength(1);
  59  |   return { email, id: body.user.id, displayName, token: body.accessToken, refreshCookies };
  60  | }
  61  | 
  62  | async function setFlag(request: APIRequestContext, key: string, value: boolean) {
  63  |   const response = await request.patch(`${api}/admin/config/${key}`, {
  64  |     headers: { Authorization: `Bearer ${adminToken}` }, data: { value },
  65  |   });
  66  |   expect(response.status()).toBe(200);
  67  | }
  68  | 
  69  | async function browserLogin(context: BrowserContext, account: Account) {
  70  |   await context.addCookies(account.refreshCookies);
  71  | }
  72  | 
  73  | async function acknowledgeJourneyLevels(context: BrowserContext, account: Account) {
  74  |   const headers = { Authorization: `Bearer ${account.token}` };
  75  |   const pending = await context.request.get(`${api}/community/journey-levels/unseen`, { headers });
  76  |   expect(pending.status()).toBe(200);
  77  |   for (const { id } of (await pending.json() as { celebrations: Array<{ id: string }> }).celebrations) {
  78  |     const acknowledged = await context.request.post(`${api}/community/journey-levels/celebrated`, {
  79  |       headers, data: { celebrationId: id },
  80  |     });
  81  |     expect(acknowledged.status()).toBe(204);
  82  |   }
  83  | }
  84  | 
  85  | test.beforeAll(async ({ request }) => {
  86  |   for (const label of ["admin", "coach", "mobile"]) {
  87  |     accounts[label] = await ensureAccount(request, label);
  88  |   }
  89  |   const profile = await request.patch(`${api}/users/me`, {
  90  |     headers: { Authorization: `Bearer ${accounts.mobile!.token}` },
  91  |     data: { examType: "KPSS", examVariant: "LISANS" },
  92  |   });
  93  |   expect(profile.status()).toBe(200);
  94  |   serviceSql(`
  95  |     update users set roles=array_append(roles,'SUPER_ADMIN')
  96  |       where id='${accounts.admin!.id}' and array_position(roles,'SUPER_ADMIN') is null;
  97  |     update users set roles=array_append(roles,'COACH'), email_verified_at=now()
  98  |       where id='${accounts.coach!.id}' and array_position(roles,'COACH') is null;
  99  |     update users set email_verified_at=now() where id='${accounts.coach!.id}';
  100 |     insert into mentorship_coach_applications (user_id,status,headline,bio)
  101 |       values ('${accounts.coach!.id}','ACTIVE','QA coach','Synthetic Stage 4 test profile')
  102 |       on conflict (user_id) do update set status='ACTIVE';
  103 |   `);
  104 |   const login = await request.post(`${api}/auth/admin/login`, {
  105 |     data: { email: accounts.admin!.email, password },
  106 |   });
  107 |   expect(login.status()).toBe(200);
  108 |   adminToken = (await login.json() as { accessToken: string }).accessToken;
  109 | 
  110 |   const config = await request.get(`${api}/admin/config`, {
  111 |     headers: { Authorization: `Bearer ${adminToken}` },
  112 |   });
  113 |   expect(config.status()).toBe(200);
  114 |   const entries = await config.json() as Array<{ key: string; value: unknown }>;
  115 |   for (const key of flagKeys) {
  116 |     const entry = entries.find((item) => item.key === key);
  117 |     expect(entry?.value).toEqual(expect.any(Boolean));
  118 |     initialFlags[key] = entry!.value as boolean;
  119 |   }
  120 |   await setFlag(request, "forum.enabled", true);
  121 |   await setFlag(request, "mentorship.enabled", true);
  122 |   // Fake providers and disposable accounts in mentor_test only; restore the production-off default.
  123 |   await setFlag(request, "mentorship.seats.sponsorship_enabled", true);
  124 | });
  125 | 
  126 | test.afterAll(async ({ request }) => {
  127 |   if (accounts.mobile) {
  128 |     await request.delete(`${api}/mentorship/my-coach`, {
  129 |       headers: { Authorization: `Bearer ${accounts.mobile.token}` },
  130 |     });
  131 |   }
  132 |   if (adminToken) {
  133 |     for (const key of [...flagKeys].reverse()) {
  134 |       if (key in initialFlags) await setFlag(request, key, initialFlags[key]!);
  135 |     }
  136 |   }
  137 | });
  138 | 
  139 | test("C01: real community hub loads in TR and EN", async ({ page, context, request }, testInfo) => {
  140 |   const student = accounts.mobile!;
  141 |   await browserLogin(context, student);
  142 |   await acknowledgeJourneyLevels(context, student);
  143 |   const hub = await request.get(`${api}/forum/hub`, {
  144 |     headers: { Authorization: `Bearer ${student.token}` },
  145 |   });
  146 |   expect(hub.status()).toBe(200);
  147 |   await page.goto("/topluluk");
  148 |   await expect(page).toHaveURL(/\/topluluk$/);
  149 |   await expect(page.getByRole("region", { name: "Öne çıkan gönderi" })).toBeVisible();
  150 |   await page.screenshot({ path: `../../docs/qa/evidence/${evidenceDate}-stage4-community-${testInfo.project.name}.png` });
```