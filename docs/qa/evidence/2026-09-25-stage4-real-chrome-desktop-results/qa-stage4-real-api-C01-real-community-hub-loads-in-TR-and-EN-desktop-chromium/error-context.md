# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qa-stage4-real-api.spec.ts >> C01: real community hub loads in TR and EN
- Location: e2e\qa-stage4-real-api.spec.ts:138:5

# Error details

```
Error: Command failed: docker exec mentor-postgres psql -v ON_ERROR_STOP=1 -U mentor -d mentor_test -c begin; select set_config('app.role','SERVICE',true); 
    update users set roles=array_append(roles,'SUPER_ADMIN')
      where id='51f778a2-94e4-4b69-b2e1-0b7e8825b54b' and array_position(roles,'SUPER_ADMIN') is null;
    update users set roles=array_append(roles,'COACH'), email_verified_at=now()
      where id='d9fb6ce3-95f8-417c-a1d5-e39534982b29' and array_position(roles,'COACH') is null;
    update users set email_verified_at=now() where id='d9fb6ce3-95f8-417c-a1d5-e39534982b29';
    insert into mentorship_coach_applications (user_id,status,headline,bio)
      values ('d9fb6ce3-95f8-417c-a1d5-e39534982b29','ACTIVE','QA coach','Synthetic Stage 4 test profile')
      on conflict (user_id) do update set status='ACTIVE';
   commit;
error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/containers/mentor-postgres/json": open //./pipe/dockerDesktopLinuxEngine: Access is denied.

```

# Test source

```ts
  1   | import { execFileSync } from "node:child_process";
  2   | import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
  3   | 
  4   | const api = process.env.QA_STAGE4_API_URL;
  5   | const runId = process.env.QA_STAGE4_RUN_ID ?? "";
  6   | test.skip(api !== "http://localhost:3001/v1" || !/^[a-z0-9]{8}$/.test(runId),
  7   |   "Requires the isolated Stage 4 API and a short run ID.");
  8   | test.describe.configure({ mode: "serial" });
  9   | test.setTimeout(120_000);
  10  | 
  11  | const adminUrl = "http://localhost:3203";
  12  | const password = "MentorQa!2026";
  13  | type Account = {
  14  |   email: string;
  15  |   id: string;
  16  |   displayName: string;
  17  |   token: string;
  18  |   refreshCookies: Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"];
  19  | };
  20  | const accounts: Record<string, Account> = {};
  21  | const initialFlags: Record<string, boolean> = {};
  22  | const flagKeys = ["forum.enabled", "mentorship.enabled", "mentorship.seats.sponsorship_enabled"] as const;
  23  | let adminToken = "";
  24  | 
  25  | function serviceSql(sql: string) {
> 26  |   execFileSync("docker", [
      |               ^ Error: Command failed: docker exec mentor-postgres psql -v ON_ERROR_STOP=1 -U mentor -d mentor_test -c begin; select set_config('app.role','SERVICE',true); 
  27  |     "exec", "mentor-postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "mentor",
  28  |     "-d", "mentor_test", "-c", `begin; select set_config('app.role','SERVICE',true); ${sql} commit;`,
  29  |   ]);
  30  | }
  31  | 
  32  | async function ensureAccount(request: APIRequestContext, label: string): Promise<Account> {
  33  |   const email = `qa-stage4-${runId}-${label}@example.test`;
  34  |   const displayName = `QA Stage Four ${label}`;
  35  |   let response = await request.post(`${api}/auth/login`, { data: { email, password } });
  36  |   if (response.status() === 429) {
  37  |     // Previous QA runs share the local signup/login throttle; wait for its minute window once.
  38  |     await new Promise((resolve) => setTimeout(resolve, 60_000));
  39  |     response = await request.post(`${api}/auth/login`, { data: { email, password } });
  40  |   }
  41  |   if (response.status() === 401) {
  42  |     response = await request.post(`${api}/auth/signup`, {
  43  |       data: {
  44  |         email, password, displayName, username: `qa4_${runId}_${label}`,
  45  |         kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true,
  46  |         intent: "STUDENT",
  47  |       },
  48  |     });
  49  |     expect(response.status()).toBe(201);
  50  |   } else {
  51  |     expect(response.status()).toBe(200);
  52  |   }
  53  |   const body = await response.json() as { accessToken: string; user: { id: string } };
  54  |   const refreshCookies = (await request.storageState()).cookies.filter(
  55  |     (cookie) => cookie.name === "mentor_web_refresh",
  56  |   );
  57  |   expect(refreshCookies).toHaveLength(1);
  58  |   return { email, id: body.user.id, displayName, token: body.accessToken, refreshCookies };
  59  | }
  60  | 
  61  | async function setFlag(request: APIRequestContext, key: string, value: boolean) {
  62  |   const response = await request.patch(`${api}/admin/config/${key}`, {
  63  |     headers: { Authorization: `Bearer ${adminToken}` }, data: { value },
  64  |   });
  65  |   expect(response.status()).toBe(200);
  66  | }
  67  | 
  68  | async function browserLogin(context: BrowserContext, account: Account) {
  69  |   await context.addCookies(account.refreshCookies);
  70  | }
  71  | 
  72  | async function acknowledgeJourneyLevels(context: BrowserContext, account: Account) {
  73  |   const headers = { Authorization: `Bearer ${account.token}` };
  74  |   const pending = await context.request.get(`${api}/community/journey-levels/unseen`, { headers });
  75  |   expect(pending.status()).toBe(200);
  76  |   for (const { id } of (await pending.json() as { celebrations: Array<{ id: string }> }).celebrations) {
  77  |     const acknowledged = await context.request.post(`${api}/community/journey-levels/celebrated`, {
  78  |       headers, data: { celebrationId: id },
  79  |     });
  80  |     expect(acknowledged.status()).toBe(204);
  81  |   }
  82  | }
  83  | 
  84  | test.beforeAll(async ({ request }) => {
  85  |   for (const label of ["admin", "coach", "mobile"]) {
  86  |     accounts[label] = await ensureAccount(request, label);
  87  |   }
  88  |   const profile = await request.patch(`${api}/users/me`, {
  89  |     headers: { Authorization: `Bearer ${accounts.mobile!.token}` },
  90  |     data: { examType: "KPSS", examVariant: "LISANS" },
  91  |   });
  92  |   expect(profile.status()).toBe(200);
  93  |   serviceSql(`
  94  |     update users set roles=array_append(roles,'SUPER_ADMIN')
  95  |       where id='${accounts.admin!.id}' and array_position(roles,'SUPER_ADMIN') is null;
  96  |     update users set roles=array_append(roles,'COACH'), email_verified_at=now()
  97  |       where id='${accounts.coach!.id}' and array_position(roles,'COACH') is null;
  98  |     update users set email_verified_at=now() where id='${accounts.coach!.id}';
  99  |     insert into mentorship_coach_applications (user_id,status,headline,bio)
  100 |       values ('${accounts.coach!.id}','ACTIVE','QA coach','Synthetic Stage 4 test profile')
  101 |       on conflict (user_id) do update set status='ACTIVE';
  102 |   `);
  103 |   const login = await request.post(`${api}/auth/admin/login`, {
  104 |     data: { email: accounts.admin!.email, password },
  105 |   });
  106 |   expect(login.status()).toBe(200);
  107 |   adminToken = (await login.json() as { accessToken: string }).accessToken;
  108 | 
  109 |   const config = await request.get(`${api}/admin/config`, {
  110 |     headers: { Authorization: `Bearer ${adminToken}` },
  111 |   });
  112 |   expect(config.status()).toBe(200);
  113 |   const entries = await config.json() as Array<{ key: string; value: unknown }>;
  114 |   for (const key of flagKeys) {
  115 |     const entry = entries.find((item) => item.key === key);
  116 |     expect(entry?.value).toEqual(expect.any(Boolean));
  117 |     initialFlags[key] = entry!.value as boolean;
  118 |   }
  119 |   await setFlag(request, "forum.enabled", true);
  120 |   await setFlag(request, "mentorship.enabled", true);
  121 |   // Fake providers and disposable accounts in mentor_test only; restore the production-off default.
  122 |   await setFlag(request, "mentorship.seats.sponsorship_enabled", true);
  123 | });
  124 | 
  125 | test.afterAll(async ({ request }) => {
  126 |   if (accounts.mobile) {
```