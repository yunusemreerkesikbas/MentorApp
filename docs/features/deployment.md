# Deployment

Cross-cutting platform capability. The operational source of truth is
[the deployment runbook](../core/deployment.md); existing security requirements remain in
[the release checklist](../core/security-release-checklist.md).

## Usage

Run `pnpm check:deployment` before applying `render.yaml` (production) or
`render.staging.yaml` (full staging), or the mutually exclusive
`render.staging-low-cost.yaml` (minimum-cost staging). Complete the environment-specific provider setup and full CI
before releasing. Local checks do not confirm that the hosts are live.

## Geliştirmeler (timeline)

- **2026-10-13 · CI scan triage.** The first PR run misclassified the literal environment-key
  name `R2_PRIVATE_BUCKET` in three new deployment definitions as `generic-api-key`. Added only
  their exact historical fingerprints to `.gitleaksignore`; no file, directory, rule or future
  commit is excluded. No credential value was present. Keep secret scan and full CI mandatory.
  Related: `.gitleaksignore`, PR #156, `scripts/check-deployment.mts`, stage Render definitions.

- **2026-10-13 · Free stage bootstrap and real database verification.** Reduced the selected
  stage to two Free services/two custom domains; the admin hostname is reserved, with no admin
  deployment or DNS record. Verified Render Hobby/no-card and its unused domain allowance.
  With explicit stage-only approval, created the restricted runtime role and applied 126 existing
  migrations. Bootstrap uses `ai.enabled=false` and `dev.email.console_enabled=true`; emails
  stay in restricted stage logs and AI calls stay disabled. Fixed the production role inspector's
  SQL alias because `current_role` is reserved in PostgreSQL; reproduced the failure with a real
  database regression test before correcting it. All 12 role tests and the actual Neon runtime
  inspection passed. Usage: one-time `prepare-staging-database.ts` refuses existing roles;
  `finalize-staging-database.ts` reapplies the two approved flags and verifies the runtime role.
  Both bind to the recorded stage target and read only ignored `.env.staging`; never run against
  production. No Render deploy or DNS change yet. Related: `render.staging-low-cost.yaml`,
  `apps/api/scripts/*staging-database.ts`, `apps/api/src/database/database-role-safety.ts`,
  `apps/api/test/database-role-safety.e2e-spec.ts`,
  [staging-cost-options.md](../core/staging-cost-options.md).

- **Lower-cost staging evaluation (follow-up).** Prepared `render.staging-low-cost.yaml` as a
  mutually exclusive on-demand alternative: three Free services, no external cron and manual
  migrations/deploys. The existing API job poller delivers user-triggered emails while awake;
  daily scheduler flows need manual stage invocation. Documented shared Render Free hours,
  custom-domain charges and Neon's always-on compute exposure. Created the isolated `puhu-s1`
  Neon project on the confirmed Free account in Frankfurt with fixed 0.25 CU; no application
  migrations/runtime role or paid Render provisioning were performed. Usage/gotchas and exact
  provisioning state: [staging-cost-options.md](../core/staging-cost-options.md). Related:
  `render.staging-low-cost.yaml`, `scripts/check-deployment.mts`, `docs/core/deployment.md`.

- **2026-10-12 · Stage/prod domain preparation.** Wired `puhukoc.com` / `s1.puhukoc.com`,
  first-level API/admin/media hostnames, isolated stage service references and EU bucket names.
  Build commands now include workspace dependencies and build tooling; hosted web/admin consume
  Render's port. Production deployments are manual; staging follows passing checks on `master`.
  Staging blocks indexing and publishes no sitemap; admin is noindex in either environment.
  API Sentry tags incidents by deployment environment. Updated the transactional sender domain
  and VAPID subject; the product owner's existing legal/support email remains unchanged.
  Usage: run the configuration check, then follow the DNS/TLS/Access/R2/Postmark/Neon runbook.
  Gotchas: no external infrastructure was provisioned; secrets, certificates, sender verification,
  verification of direct frontend origin closure and full release evidence remain required. Changing `NEXT_PUBLIC_*`
  values or build-time headers requires a new build; Turbo includes these inputs in its cache key.
  Related: `render{,.staging}.yaml`, `scripts/check-deployment.mts`, `.env.example`, `turbo.json`,
  `.github/workflows/ci.yml`, web metadata/security headers, admin Next config/start scripts,
  API instrumentation/email/push adapters, `docs/core/deployment.md`.
  Verification: [102 targeted tests, app/shared builds and compiled stage metadata](../qa/2026-10-12-deployment-preparation.md)
  passed; full CI and real-provider release gates remain outstanding.
