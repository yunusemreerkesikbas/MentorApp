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
