# Staging bootstrap evidence

Date: 2026-10-13. Scope: isolated `puhu-s1` only; no production migration or DNS changes.

- Neon Free project `nameless-surf-42172578`, branch `br-orange-truth-b9qhwncd`, Frankfurt,
  Postgres 16, fixed 0.25 CU, transaction pooler enabled. Owner/runtime credentials are separate
  and stored in ignored `.env.staging`; TLS uses `verify-full`.
- With explicit stage-only approval, installed pgvector, created a runtime login without ownership,
  superuser, BYPASSRLS, CREATEROLE or privileged memberships, then applied 126 existing migrations.
- The finalizer verified the actual pooled runtime login against the production startup inspector
  and read back `ai.enabled=false`, `dev.email.console_enabled=true`.
- Runtime inspection initially failed with PostgreSQL syntax error `42601`: unquoted table alias
  `current_role` is reserved. A real PostgreSQL regression test reproduced the failure before
  replacing only that alias with `inspected_role`. The regression and 11 existing unit tests passed.
  Reference: [PostgreSQL reserved keywords](https://www.postgresql.org/docs/16/sql-keywords-appendix.html).
- Config registry/email routing tests: 15 passed, including console email on staging with
  `NODE_ENV=production`. The existing production lock remains enforced.
- Stage setup scripts: targeted TypeScript and ESLint checks passed. `pnpm check:deployment`
  passed for production/full-stage/minimum-cost profiles. `git diff --check` passed.
- Full workspace lint and typecheck passed; lint includes warnings in unrelated existing code.
  A stale Next route validator from concurrent page relocation was regenerated with `next typegen`
  before the successful typecheck. API/shared dependencies rebuilt successfully (4 tasks).
  Earlier web/admin builds and 102 targeted tests are recorded in
  [source preparation evidence](./2026-10-12-deployment-preparation.md).
- Render dashboard confirms Hobby, no card, no pending charges, 0/2 included domains used,
  750 Free instance-hours, 5 GB bandwidth and 500 pipeline minutes. Selected stage profile has
  only web/API Free services, no stage admin and no external cron.
- Render GitHub App connection completed after explicit owner approval and reauthentication,
  scoped to `MentorApp`. Render visibly lists the connected repository.
- Suspended the unused Neon endpoint after verification and confirmed `current_state=idle`.
  Its actual suspend interval is zero; do not assume automatic idle shutdown. Wake deliberately
  when proceeding with deployment and suspend during pauses to preserve the Free allowance.

Full remote CI/audit/secret scan/browser suite and deployed DNS/TLS/Access/Turnstile/R2/provider
smoke evidence remain outstanding. No application service is live yet; this is not release readiness.

Procedure: [deployment runbook](../core/deployment.md) and
[selected cost profile](../core/staging-cost-options.md).
