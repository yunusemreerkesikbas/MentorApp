# Free Render migration preparation

> Execute inline with `superpowers:executing-plans`; existing checkout/current branch only.

**Goal:** permit an external production migration step without requiring the migration-owner
credential in the API runtime. Keep production migration validation and runtime role safety.

**Spec:** [approved free-first plan](2026-10-28-free-first-launch.md),
[rehearsal prerequisites](../qa/2026-10-28-free-first-launch.md#free-hosting-rehearsal-preparation).

**Architecture:** a dedicated Drizzle migration config validates the migration connection.
The API continues to use only `DATABASE_URL` and its existing role inspection. No schema,
provider, queue architecture, dependency, cloud setting or deployment changes.

## Decision

Keep privileged credentials in the API runtime: least code, unnecessary privilege exposure.
Run migrations at API startup: rejects the Free cold-start and role-separation requirements.
**Selected:** external attended migration with a dedicated validated config, followed by the
restricted API runtime. This also works with the retained optional paid pre-deploy command.
Existing schema generation and local migration commands remain usable.

## Constraints

- Preserve production edge, Access, Turnstile, RLS and provider checks.
- Production migrations require an explicit PostgreSQL `DATABASE_MIGRATION_URL`; never fall
  back to the runtime credential. Reject Neon pooler hosts and suppress values in errors.
- Local/test migrations may use the existing explicit `DATABASE_URL` fallback.
- No live SQL, secrets transfer, archived staging mutation, mail or paid resource activation.
- Full exact-commit CI and independent review remain release gates.

## Task 1: Separate migration and runtime environment boundaries

Files: `apps/api/drizzle.migrate.config.ts`,
`apps/api/package.json`, `apps/api/src/database/migration-database-url{,.spec}.ts`,
`apps/api/src/config/env.validation{,.spec}.ts`, `.env.example` and deployment/feature docs.
Reuse `apps/api/drizzle.config.ts` unchanged for schema/output settings and offline generation.

Interface: `getMigrationDatabaseUrl(env): string` consumes only NODE_ENV, DATABASE_URL and
DATABASE_MIGRATION_URL. `db:migrate` consumes its result through the dedicated config.

- [x] Add real config-loader tests proving production runtime starts without the migration
  variable while migration config rejects an absent variable or Neon pooler connection.
- [x] Watch the changed runtime test fail before editing production code. Test migration URL
  rejection and error redaction, explicit production selection and the local fallback.
- [x] Implement the helper/config and point only `db:migrate` at the dedicated config.
- [x] Run focused environment, role-safety and migration config tests, API typecheck, touched
  lint and the existing optional-paid deployment checker. No live migration in this step.
- [x] Update operator usage, remaining gates, feature timeline and execution ledger.

## Task 2: Record the unattended maintenance decision boundary

- [x] Review existing cron endpoints, guards, date dedupe and persisted queue catch-up.
- [x] Verify current free scheduler limits and stop semantics before selecting or activating
  one. Manual rehearsal calls are not proof of unattended operation or missed-day recovery.
- [x] Record a bounded attended rehearsal procedure and any blocker requiring a separate
  owner decision; do not silently activate a paid Render cron or metered scheduler.

## Review focus

- The dedicated Drizzle config must actually enforce validation, not just its pure helper.
- Runtime role inspection must still reject owner/privileged roles without migration env.
- Invalid/missing/pooled URLs must fail without exposing a credential or falling back in prod.
- Local CLI generation and migrations must retain their existing developer behavior.
- A sleeping API or lost scheduler run must not be described as successful maintenance.
