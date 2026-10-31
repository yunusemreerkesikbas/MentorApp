# Deployment

Cross-cutting platform capability. Operational guidance:
[production deployment](../core/deployment.md),
[security release checklist](../core/security-release-checklist.md),
[deferred staging inventory](../core/deferred-staging.md).

## Usage

Run `pnpm check:deployment` to validate `render.yaml` before separately authorized production
setup. Require full CI and live provider acceptance before publication. Permanent staging is
optional; source checks do not prove that production services or domains are live.

## Geliştirmeler (timeline)

- **2026-10-31 · Independent readiness checkpoint.** Refreshed public DNS without changes:
  Cloudflare delegation/mail records exist, while root/API routing is still absent. Pinned the
  private local profile to `STORAGE_PROVIDER=r2` with bounded mode; credentials and verified
  gateway origin remain pending, AI stays disabled. Usage: follow the
  [current verification/action package](../qa/2026-10-31-bounded-trial-storage-verification.md).
  Recovery now explicitly keeps admission/media closed after a database restore until lifetime
  usage is reconciled against later object/provider evidence. Gotchas: no secrets were uploaded,
  no full CI was started, and the owner's final-candidate hold remains in force. Related:
  `docs/core/storage-r2.md` and the ignored local preparation/evidence files.

- **2026-10-31 · Bounded media implementation.** Storage accounting now guards all trial raw
  operations with a sealed scope, manifest and durable reservations. The owner also approved
  a 1 GiB lifetime payload-transfer counter in addition to 500 MiB / 10000 Class A / 100000
  Class B. Nullable historical transfer facts fail closed instead of inventing zero usage.
  Migrations 0133–0135 were generated and applied only to guarded loopback test databases.
  The initialization CLI checks the exact DB role/host and account/bucket scope, precharges
  two empty-bucket probes and requires attended recovery after uncertainty. Gateway grants
  use the actual session; core DTOs and study actions survive photo refusal. Usage/rollback:
  [storage runbook](../core/storage-r2.md#bounded-trial-profile-2026-10-31).
  Gotchas: payload accounting is not the whole Render workspace's traffic; no provider resource,
  credential upload, remote migration, DNS, billing or new staging setup was performed.
  Exact candidate CI and hosted acceptance remain separate gates.

- **2026-10-31 · Aggregate trial-storage design review.** Read-only Cloudflare inspection
  confirmed USD 0 observed/projected R2 usage, separate empty EU staging buckets and no
  production bucket pair. The existing USD 10 notification is not a spending stop. The owner
  retained uploads, selected the existing API as a media gateway, and approved trial-wide
  limits of 500 MiB, 10,000 Class A and 100,000 Class B attempts without automatic refill.
  Usage: review the [approved design](../plans/2026-10-31-bounded-trial-storage-design.md) and
  [implementation plan](../superpowers/plans/2026-10-31-bounded-trial-storage.md) before code.
  All design sections and the written inline implementation plan are approved. Extra staging cost or
  staging-specific development is declined. Use the selected single Free trial environment
  for provider acceptance before admission. Source work started with the durable allowance/manifest,
  conservative settlement and SERVICE-only RLS. Three config and ten real local PostgreSQL cases
  pass, including simultaneous final-slot claims and a PUT finishing after cleanup; API typecheck
  and touched-file lint pass. Prior migrations remain unchanged; 0133 was generated/applied only
  locally. The guarded raw port now reserves every operation, pins one SDK attempt, and refuses
  scope changes/direct-mode rollback on a sealed database. The attended initialization CLI requires
  an exact runtime database/bucket target, retains two precharged probes and marks only confirmed
  empty buckets ready. Migration 0134 adds attempt IDs without editing 0133. Run the CLI only after
  separately approved provider setup. Gotchas: gateway/UI enforcement is still in progress; no live bucket, token,
  DNS, billing or credential upload was performed. Related: `schema-storage-budget.ts`,
  `storage-budget.repository.ts`, `test/storage-budget.e2e-spec.ts`.

- **2026-10-31 · Paired-disabled AI trial startup.** The selected trial now has an explicit
  credential-free AI mode, preserving real-provider validation and all other production locks.
  The registry cannot reopen AI in this deployment, and the existing availability endpoint
  reports it closed. Updated the environment example/runbook; the optional paid Blueprint is
  unchanged. Usage: set both AI provider fields to `disabled` and omit their keys.
  Related: [approved design](../plans/2026-10-30-disabled-ai-startup-design.md) and
  [verification](../qa/2026-10-31-disabled-ai-startup-verification.md). Candidate `1513a5bb`
  passed full CI 41131102949 (3,875 API, 1,099 web, 1,386 browser passes). Gotcha: hosted
  acceptance remains necessary before publication; this CI does not certify future storage code.

- **2026-10-30 · AI-off credential requirement investigated.** Read-only verification of the
  dedicated rehearsal DB confirmed `ai.enabled=false`. Photo classification and shared AI
  wrappers reject before provider calls; focused environment/provider/photo suites passed 93/93.
  Corrected the hosting checklist: an unused Gemini key is not a product requirement for
  this closed trial. The remaining mismatch is startup validation of a selected Gemini
  provider before DB flags load. Usage/gotchas: see the updated
  [hosting record](../qa/2026-10-30-core-trial-ci-and-hosting.md); credential-free closed-mode
  startup is not implemented yet. No flag, AI provider, credential or deployment was changed.

- **2026-10-30 · Exact-commit full CI and isolated Free database preparation.** Candidate
  `035f9217` on `feat/core-trial-release-20261030` passed the complete Linux pipeline,
  ordinary/security/core browsers and web budgets. Preserved the original checkout/index.
  Verified Render Hobby/no-card/zero-spend settings and prepared an unsubmitted Free API form.
  Created a separate EU Neon Free rehearsal project, a no-compute blank recovery branch,
  applied all 133 existing migrations and verified its restricted runtime role, 21 closed-profile
  settings and rolled-back user isolation. Usage and exact evidence:
  [CI and hosting record](../qa/2026-10-30-core-trial-ci-and-hosting.md).
  Gotchas: runtime configuration remains incomplete, Gemini is missing, restore/hosted
  acceptance is pending, and no service, public DNS or paid setup was activated. Direct owner
  credentials remain in an ignored operator-only file, outside the separate runtime file.

- **2026-10-30 · Explicit core-trial boundary and browser profiles.** Deployment instructions
  now list independent social/forum/room/economy/coaching/AI/purchase closures and preserve own
  achievements. Browser CI explicitly seeds its ordinary enabled fixture, then restarts the
  owned API for the separate closed profile. Usage: follow `docs/core/deployment.md`; the guarded
  profile script only accepts loopback `_test` databases outside production. Gotcha: registry
  overrides require restart and document reload; no live database, DNS or provider was changed.
  Related: browser fixture script/tests, CI workflow, core-trial Playwright config/spec.

- **2026-10-30 · Web handoff and current release checks.** Resumed web verification after the
  owner confirmed the design work was finished. Corrected overlay auth scope, paginated
  notebook quota display and the quota button's touch height; synchronized stale browser
  fixtures with current checkout copy, disclosure and server refresh behavior. Recorded
  current quality/unit/build/budget/dependency checks and a new social-boundary gap in the
  selected core-only profile. Usage and exact verification status:
  [web release verification](../qa/2026-10-30-web-release-verification.md).
  Gotchas: local browser checks use fake providers and the ordinary test profile, not hosted
  production acceptance. The owner also approved the project Impeccable update to 4.8.0;
  product instructions, design context and dependency manifests were unchanged by that update.
  No deployment, cloud account setting, DNS, billing, commit or push was performed.

- **2026-10-29 · Core-trial release verification and backend quota corrections.** Recorded
  local builds, quality/dependency/secret checks and the limitations of interrupted broad
  API/browser runs. Fixed quota races, nested policy/taxonomy pool reads and growing page
  grandfathering; final focused API regressions and source hashes are in the
  [verification report](../qa/2026-10-29-core-trial-release-verification.md).
  Usage: continue full web/security/CI checks after the owner's ongoing UI handoff.
  Gotchas: no deployment, provider/DNS/billing change or full-workspace green claim;
  aggregate upload spending and hosted acceptance remain separate gates. Historical Google
  sample-key provenance was traced to the original public template sources without key
  testing, history rewrites or new secret-scan exclusions.

- **2026-10-29 · Closed-admin mode implemented locally.** Added `ADMIN_ACCESS_MODE` with
  preserved `cloudflare` default and explicit `disabled` mode denying admin API/auth before
  handlers, identity lookup or Access verification. Only issuer/audience requirements are
  conditional; edge, origins, Turnstile, DB-role and provider requirements remain. Usage and
  no-admin support/rollback limits: [deployment profile](../core/deployment.md#closed-admin-core-only-free-trial).
  RED reproduced the missing mode; 161/161 focused validation/guard/local-HTTP tests passed,
  with API typecheck and owned-file lint. AI provider tests passed 30/30 separately. Related:
  `env.validation.ts`, `env-production-locks.ts`, `cloudflare-access.guard.ts`, three boundary
  test files, `.env.example`. No live setting, secret, deployment, billing or owner quota edit.
  Independent review found no blocking issue; final evidence and deferred release gates:
  [implementation record](../qa/2026-10-29-closed-trial-implementation.md).

- **2026-10-29 · Core-only trial scope confirmed.** The owner confirmed forum and human
  coaching stay closed alongside admin, AI, payments, SMS and ads. Plan, focus sessions,
  analysis, notebooks and account flows remain in scope. Updated the
  [design](../plans/2026-10-29-admin-closed-pilot-design.md) and split local implementation
  into independent [admin](../superpowers/plans/2026-10-29-admin-closed-trial.md) and
  [AI-off](../superpowers/plans/2026-10-29-ai-provider-kill-switch.md) plans. Usage: review
  the plans before implementation. Gotchas: coach signup has its own separate flag;
  no runtime behavior, live flag or deployment changed in this planning step.

- **2026-10-29 · Current launch review and selected closed-admin direction.** Rechecked public
  DNS, Render, Neon, Resend, Turnstile, Access onboarding, R2 and Sentry without changing
  provider settings. Current HEAD CI run 577 fails API job-interruption tests; its secret scan
  and web budgets passed. The owner selected a small-user Free trial and requested an
  admin-closed design. The detailed design is proposed, not implemented or release-approved.
  Usage: follow the [current review](../qa/2026-10-29-launch-readiness-review.md) and
  [design](../plans/2026-10-29-admin-closed-pilot-design.md). Gotchas: AI-off does not gate the
  inspected embedding path, default exam dates are stale, and storage/cold-start/recovery
  acceptance remains open. No owner source edit, credential, deployment or billing change.

- **2026-10-29 · Local platform release preflight.** Dependency audit has no critical/high
  findings at the existing policy threshold; optional-paid deployment checks, platform
  lint/typecheck and API/admin builds passed at their execution time. Public DNS is still
  unbound. Added sleeping Render Free `robots.txt`/SEO acceptance to the checklist. The broad
  API run hit its operator time limit and source changed during owner quota/landing work,
  so full CI is not claimed. Its queue fixture isolation issue was reproduced and corrected
  only in the guarded e2e setup. Usage and remaining gates:
  [platform preflight](../qa/2026-10-29-platform-release-preflight.md). No cloud/billing change.

- **2026-10-29 · Approved Sentry error-only acceptance.** Created EU `puhu-api` after explicit
  approval, kept its ingestion connection in the ignored local acceptance env, and verified
  one synthetic event as PUHU-API-1 (HTTP 200; Events 1 / Users 0). No billing/repo/AI/production
  connection was enabled. Explicitly disabled SDK logs, which bypass the event scrubber;
  a real-SDK offline regression reproduced the previous leak path. Also omit sanitized
  empty stack traces after the accepted event exposed a processing warning. Usage/gotchas:
  [preflight record](../qa/2026-10-29-storage-monitoring-preflight.md); the empty-frame fix
  is verified locally, with no second live event. Related: `instrument{,.spec}.ts`,
  `sentry-scrubber{,.spec}.ts`. Production wiring and full CI remain separate gates.

- **2026-10-29 · Upload scope and Sentry account verification.** The owner retained first-release
  uploads and owns the pre-launch notebook quota; no quota or upload-disable mode was added.
  Sentry PuhuKoc is in the EU, with an automatic Business trial and no payment method.
  Official docs confirm fallback to Developer without upgrading. An error-only `puhu-api`
  draft awaits approval for creation, ignored local connection storage and one synthetic
  event; no project, credential, billing or telemetry change has been made. Usage/gotchas:
  [preflight record](../qa/2026-10-29-storage-monitoring-preflight.md). R2 has no verified
  invoice stop; a per-user image count alone does not close that gate.

- **2026-10-29 · Storage spending and safe queue-error context.** Read-only R2/Billing
  inspection confirmed zero observed billable R2 cost and an unchanged existing USD 10
  notification, with no verified billing stop. Upload deferral versus first-release image
  support is an owner scope decision; no feature was disabled. Sentry needs account login.
  Its privacy boundary now preserves only a job UUID and allowlisted notification job name,
  keeping payloads/PII excluded so quarantine can be investigated. Usage and gotchas:
  [preflight record](../qa/2026-10-29-storage-monitoring-preflight.md). Related:
  `sentry-scrubber{,.spec}.ts`. No live setting, DSN or telemetry send.

- **2026-10-29 · R2 names versus public domain.** Clarified that existing `mentor-*` buckets
  are dev/test, retained `puhu-s1-*` buckets are staging, and planned EU production uses
  `puhu-prod-*` with `media.puhukoc.com` only on the public bucket. Corrected the production
  naming example, marked CORS placeholders as dev-only and separated budget alerts from
  spending stops. Use [storage-r2.md](../core/storage-r2.md) with the deployment profile;
  no live bucket, object, token, DNS or CORS setting was changed.

- **2026-10-29 · External production migrations for Free hosting.** `db:migrate` now uses a
  dedicated config requiring an explicit direct owner URL in production, rejecting Neon
  poolers/query host overrides without logging values. The API no longer requires this
  credential; restricted runtime-role and other production checks remain. Local fallback
  and offline generation remain available. Use the
  [attended procedure](../qa/2026-10-29-free-hosting-preparation.md) before a separately
  authorized deployment. No live migration, credential upload or scheduler activation.
  Related: `drizzle.migrate.config.ts`, `migration-database-url{,.spec}.ts`, API package
  script, `env.validation{,.spec}.ts`, `.env.example`, `docs/core/deployment.md`.

- **2026-10-13 · Production scope and deferred staging.** Narrowed PR #156 to owned production
  preparation. Removed staging Blueprints/bootstrap scripts/indexing changes and incomplete
  admin-disable/external-migration tests; existing production security remains unchanged.
  Kept `puhukoc.com` and first-level API/admin/media domains, manual deploys, dependency-aware
  Render builds, hosted ports and admin noindex. CI builds web with the production canonical
  domain while app tests keep local/CI DB and provider fixtures. Usage: run the production
  configuration check and follow the runbook. Gotchas: provider keys, Postmark verification,
  Access billing terms, DNS/TLS, budget and live smoke remain separate gates. Keep
  `info@mentor.com`. Related: `render.yaml`, `scripts/check-deployment.mts`,
  `.github/workflows/ci.yml`, `.env.example`, web production indexing test, admin Next config,
  app start scripts and `docs/core/deployment.md`. Staging is recoverable at `376a70e8` plus the
  ignored local patch; external resources were preserved. See the inventory for idle compute.
  Fixed the existing plan browser fixture's UTC/local weekday mismatch by deriving its suggested
  weekdays from the same Istanbul day as the application; no product behavior changed.
  Related: `apps/web/e2e/plan.spec.ts`.
  Verification: [production preparation evidence](../qa/2026-10-13-production-preparation.md).

- **2026-10-13 · PostgreSQL runtime-role regression.** Retained the role inspector fix:
  `current_role` is reserved SQL syntax, so the query uses `inspected_role`. A real PostgreSQL
  regression executes the query and rejects the database owner; unit tests cover privilege,
  inheritance and ownership rejection plus a restricted role. No schema change. Related:
  `apps/api/src/database/database-role-safety.ts`, `apps/api/test/database-role-safety.e2e-spec.ts`.

- **2026-10-13 · Historical secret-scan triage.** Three literal `R2_PRIVATE_BUCKET` variable
  names were mistaken for credentials in commit `3a6c87d8`. Only their exact historical
  fingerprints remain in `.gitleaksignore`; no file/rule/future-commit exclusion was added.
  Secret scanning remains mandatory despite subsequent removal of staging definitions.

- **2026-10-12/13 · Earlier staging preparation (deferred).** Historical Blueprints, free-hosting
  evaluation and approved Neon bootstrap remain at `376a70e8`. They do not describe the current
  production PR surface. Resources and incomplete work are recorded in
  [deferred-staging.md](../core/deferred-staging.md); no live staging was deployed.
