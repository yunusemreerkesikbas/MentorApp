# Core-trial CI and Free hosting preparation

Date: 2026-10-30, Europe/Istanbul. This continues the approved closed-admin,
AI-off, core-tools trial. Hosting is still a rehearsal; no public admission or production
deployment is established by this record.

## Exact candidate and CI

- Candidate: `035f92171b81d47fc7d93763eacdd0cfb773db27`, branch
  `feat/core-trial-release-20261030`, based on `master` at `5f4d8f1d477967f1e44c4093fb4a64b3272f78ef`.
- The two commits include the reviewed server/web boundary and explicit browser profiles.
  The 2,516 executable/test files match the accepted local source fingerprint
  `58befdd209193a8dc05d5b7a85883e3e79650170df70a37cbad68fee5018307e`.
  The owner-approved Impeccable update is outside this release candidate.
- A temporary Git index preserved the original `feature/APP-123` checkout, its HEAD and
  existing working changes. Only the new candidate branch was pushed; no PR, merge,
  force push, default-branch or protection change was made.
- [Full Linux CI 41049717397](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/41049717397)
  **passed on that exact SHA**, completed at 12:28:35 UTC / 15:28:35 Istanbul.

| Check | Result |
| --- | --- |
| Production dependency audit | Passed at the existing high/critical policy threshold |
| Deployment configuration and secret scan | Passed; no detected leaks |
| Workspace lint, typecheck and builds | Passed |
| Web performance budgets | Passed |
| API tests | 3,830 passed in 400 files |
| Web tests | 1,099 passed in 166 files, plus Node script checks |
| Ordinary browser suite | 1,276 passed, 126 skipped |
| Account-security/CAPTCHA browser suite | 90 passed |
| Closed core-trial browser suite | 20 passed |

The ordinary suite retains its configured viewport/feature/opt-in skips, including the
separate `QA_REAL_API_URL` smoke cases. Hosted credentials, real provider delivery and
public-origin behavior were not exercised by this CI. Local browser/HTTP evidence remains
in [the boundary verification](2026-10-30-core-trial-social-boundary-verification.md).

## Render account and draft

Read the signed-in **Puhukoc** workspace without changing billing or security settings:
Hobby, no card, no pending charges, no services or past invoices, and zero recorded use.
Its displayed shared allowances are 750 Free instance hours, 500 pipeline minutes,
5 GB outbound bandwidth and two custom domains. The Starter pipeline's additional
monthly spend limit remains **USD 0**; no limit was raised.

The existing GitHub integration already lists MentorApp. No new repository access was
granted. The new-service form initially selected paid USD 7 compute, `master` and Oregon.
An **unsubmitted** API draft now selects:

| Field | Draft value |
| --- | --- |
| Name | `puhu-core-trial-api` |
| Source | `yunusemreerkesikbas/MentorApp` |
| Branch | `feat/core-trial-release-20261030` |
| Runtime / region | Node / Frankfurt (EU Central) |
| Compute | Free, USD 0, 0.1 CPU, 512 MB |
| Root directory | Repository root |
| Build | `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm exec turbo run build --filter=@mentor/api` |
| Start | `pnpm --filter @mentor/api start:prod` |
| Health path | `/v1/health/ready` |
| Auto-deploy | Off |
| Pre-deploy | Unavailable on Free; left empty |

No secret was entered in the form and **Deploy web service was not submitted**.
The optional paid `render.yaml` was not applied. The web counterpart will need its own Free
service, `@mentor/web` build/start, `/tr` health path and exact public build-time settings;
it has not been created. Actual generated hostnames must be used, never inferred.

Free services sleep after idle periods and share the workspace hours. Exhausted hours or
bandwidth without a payment method can suspend service; the USD 0 pipeline limit stops
additional builds, not application use. Preserve these controls and measure actual sleep,
wake and maintenance. Render describes Free as a testing/preview tier, rather than a
production availability guarantee. Sources: [Free limits](https://render.com/docs/free),
[deploy controls](https://render.com/docs/deploys), [health checks](https://render.com/docs/health-checks).
The readiness probe and queue's regular DB work must be included in Neon consumption measurements.

## Isolated Neon database

The connected organization reports plan `free`. Existing project `puhu-s1`
(`nameless-surf-42172578`) and its archived `staging` branch were preserved without SQL,
activation or credential reuse.

Created **`puhu-core-trial`**, project `falling-bar-88067595`, Frankfurt
`aws-eu-central-1`, PostgreSQL 16, default branch `br-green-wildflower-b922r58d`,
endpoint `ep-wandering-wave-b9q3sjwf`. Compute minimum/maximum is 0.25 CU, one endpoint;
no paid upgrade, autoscaling increase or additional backend primitive was enabled.
A separate empty baseline branch `br-hidden-lab-b9e2hjpy`
(`before-core-trial-migrations-20261030`, parent LSN `0/19691F0`) has **no compute**.
It preserves the blank pre-migration state; it is not evidence of a tested restore.

The attended local operator process verified the exact new host/database/owner and an
empty public schema, checked 260 migration/config files against the successful CI commit,
then invoked the existing production `drizzle-kit migrate --config=drizzle.migrate.config.ts`.
**All 133 journaled migrations applied, exit 0.** Existing migration files were not changed.
The original staging environment and local fixtures were not used as migration input.

Created `puhu_trial_runtime` with no superuser, BYPASSRLS, CREATEROLE, CREATEDB, ownership
or privileged membership. It has public-schema usage, table DML and sequence usage only;
schema creation is denied. The application's actual production role inspector passed over
the pooled connection. The direct migration owner remains outside runtime configuration.

Persisted and reread 21 catalog-validated settings through SERVICE context: the runbook's
AI/social/forum/rooms/economy/human-coaching/advertising/purchase closures, personal
achievements and public signup on, pilot admission off, AI cap 100 cents and console mail off.
No admin frontend or API service has started against this database.

A subsequent transaction used the real restricted role and two synthetic `example.invalid`
users. Own-row read passed; cross-user read/update and context-free reads were denied.
The transaction was rolled back and SERVICE context verified **zero users and zero jobs**.
TLS certificate verification passed with explicit `sslmode=verify-full`.
This is a focused user-table proof; it does not replace the broader CI RLS suites or hosted smoke.

Two ignored local files have explicit current-Windows-user-only ACLs: the operator-only
`.env.core-trial-rehearsal.local` contains the direct owner connection; the incomplete
`.env.core-trial-runtime.local` contains the restricted connection and newly generated,
independent JWT/auth-rate/edge/cron and VAPID settings. **Never upload the operator file.**
No secret value appears in this record or CI. No provider credential was copied from staging.

Free limits and the fixed five-minute idle policy are documented in
[Neon plans](https://neon.com/docs/introduction/plans) and
[scale to zero](https://neon.com/docs/introduction/scale-to-zero).
The API's raw `suspend_timeout_seconds: 0` alone does not establish observed sleep behavior.
After the last SQL process closed at 17:18:04 UTC, a management-only read at 17:23:19 UTC
reported both the endpoint and its sole compute **idle**. The blank recovery branch also
has no compute. No SQL/HTTP keep-alive was used while waiting. This verifies idle behavior
for the unhosted database; the hosted API's queue and health checks still need measurement.

## Next gates

1. Resolve the AI-off startup configuration mismatch rather than request an unused Gemini
   credential. The owner reiterated that photo classification must stay closed. A read-only
   restricted-role check at 20:44:59 UTC confirmed persisted `ai.enabled=false` and the
   100-cent cap in the rehearsal DB. Source tracing confirms photo access, classification
   and the provider wrapper refuse before any vision call; text/stream/embedding are also
   stopped at their shared wrapper. The 13 kill-switch, two vision-wrapper and 70 environment
   validation tests passed again (85 total), followed by eight photo access/classification
   tests: **93/93 passed**, without contacting an AI provider. Gemini is
   required by current validation only when an explicitly selected text/vision provider is
   Gemini; the retained optional paid Blueprint selects that vision provider. The database
   kill-switch is evaluated later and cannot suppress this startup check. The existing code
   therefore needed a deliberate credential-free closed-AI startup configuration; do
   not simply remove validation for enabled real providers or substitute dummy keys. No
   runtime behavior was changed by that investigation. The subsequently approved paired-disabled
   mode is implemented and locally verified in the [2026-10-31 record](2026-10-31-disabled-ai-startup-verification.md).
   Require its new reviewed exact-commit CI before deploying it; do not obtain unused AI keys.
   Local acceptance Resend/Turnstile/Sentry
   values and existing developer OpenAI/R2 values are not blanket production-upload approval.
2. Finish destination-specific provider credentials, EU media permissions/domain/CORS, origin
   header protection and exact HTTPS web/API/Turnstile settings before submitting services.
   The runtime file is intentionally incomplete; do not upload it as a complete configuration.
3. Rehearse exact-commit startup, real cold-start auth mail/CAPTCHA, private media and scrubbed
   monitoring; verify sleep/quotas, maintenance catch-up and failure handling.
4. Verify current editorial dates/content, restore, a compatible closed-mode rollback and
   operator/support procedures. R2 aggregate cost containment remains separate from per-user quota.
5. Obtain publication approval only after the above live evidence. No production DNS change,
   merge, real email, AI call, scheduler activation, card addition or paid resource occurred here.

Ignored evidence: `.artifacts/deployment/ci-candidate-20261030/` contains the candidate
manifest, full CI result/log, secret scan, guarded migration operator script/log/result,
RLS verification/result and Render draft screenshot. Operator helpers are one-shot records;
inspect current state before any repeat. Do not run local/CI database fixture scripts remotely.
