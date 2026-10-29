# Free hosting: external migrations and maintenance gates

2026-10-29. Source preparation only, in the original checkout on `feature/APP-121`.
No live SQL, provisioning, deployment, credential upload, mail or billing change.

## External migration boundary

The API runtime no longer requires the migration-owner connection. Its restricted
`DATABASE_URL` and production role inspection are unchanged. Other production locks,
including edge, Access, Turnstile, real providers and Resend, remain enforced.

`pnpm --filter @mentor/api db:migrate` now uses `drizzle.migrate.config.ts`. With
`NODE_ENV=production` this config requires an explicit `DATABASE_MIGRATION_URL` and never
falls back to the runtime connection. It rejects invalid/non-PostgreSQL URLs, Neon pooler
hostnames (including case, trailing-dot and percent-encoded variants), and `host`/`hostaddr`
query overrides. Malformed hostname encoding also fails with a redacted error.
Errors omit connection values. The installed `pg` client constructor confirmed that a
query-string `host` can override the URL authority; this was tested without connecting.

Local/test migrations retain the documented `DATABASE_URL` fallback. Offline schema
generation still uses `drizzle.config.ts` without requiring migration credentials.
The optional paid Render pre-deploy command still works through the same package script;
its existing service environment is unchanged. This change does not itself isolate a
credential already supplied to that optional service.

### Attended Free rehearsal procedure

1. Select a reviewed commit with full CI. Use a separate synthetic-data database with
   restricted runtime and direct migration-owner roles; preserve archived staging data.
2. Create/verify a recovery point and confirm the intended target database/region privately.
   Inject `NODE_ENV=production` and `DATABASE_MIGRATION_URL` into the trusted operator
   process from protected storage. Do not paste a connection value into chat, documentation,
   shell history or public workflow inputs.
3. From the repository root, run `pnpm --filter @mentor/api db:migrate`. Record commit,
   migration identifiers and exit status, without recording credentials. A failed migration
   stops deployment; do not hide it, seed demo users or automatically retry a partial failure.
4. End that operator process. Configure the Free API with only the restricted runtime
   connection; omit `DATABASE_MIGRATION_URL`. Do not put the migration command in API
   build/start/wake-up commands. Require the existing role inspection and readiness check.
5. Check schema/data recovery and backward compatibility separately. Application rollback
   does not undo a migration. No live migration/recovery was performed in this source step.

## Maintenance: a Free candidate, not activated

The GitHub connector reports `yunusemreerkesikbas/MentorApp` as **public**, default branch
`master`. Standard GitHub-hosted runners in public repositories are currently free. That
makes a small scheduled HTTP caller a candidate without adding a paid Render cron.
Do not change repository visibility or unrelated account budgets to use it. If visibility
changes, reevaluate private-runner billing and a verified stop control before activation.

GitHub schedules can be delayed/dropped and public schedules disable after 60 days without
repository activity. A schedule is not an availability guarantee. It must use bounded runs,
no build/cache/artifact step, approved target/secret, and missed-run visibility. Do not add
minute-by-minute requests that keep Render/Neon awake and consume their free allowances.

Source review found two prerequisites, subsequently addressed in source by the
[queue preparation](2026-10-29-queue-recovery.md); live restart/monitoring acceptance remains open:

- `DailyReminderService` previously created its in-app row without a dedupe key, although email/push
  have separate dedupe paths. `UserNotificationRepository.create` relies on the partial
  `(user_id, dedupe_key)` unique index, which excludes null keys. Repeating the daily trigger
  could therefore create duplicate inbox rows. It now supplies the day key through the
  existing unique index; this does not make all dispatch side effects atomic.
- `JobRepository.claimBatch` selects only `PENDING` jobs and persists `RUNNING` before
  invoking a handler. Previously there was no stale-RUNNING recovery. Active work now has
  a heartbeat and expired executions are quarantined as DEAD without replay. The owner's
  selected manual-review policy accounts for side effects that may already have happened.

The fixes passed local PostgreSQL regressions; no real lost message or live restart was
observed. No automatic scheduler or live job-state repair was enabled. The existing notebook
endpoint is also absent from the optional paid Blueprint's three daily triggers.

An attended rehearsal can inspect each endpoint once, with synthetic data and delivery
providers disabled/mocked unless separately authorized. Preserve cron/origin guards. Wait
for actual sleep, call readiness with a finite deadline, then make one authenticated POST
and require the expected JSON counters plus persisted state. A wake-up page or a timeout
is not success. Inspect state before any repeat; pending catch-up is distinct from orphan
recovery, and current-day reminder logic does not backfill missed days.

## Verification and limits

- Runtime regression first failed because the migration variable was required; it now passes.
- Case/trailing-dot, host-override and encoding regressions each failed before their fixes.
- **129/129 focused tests passed:** environment, migration config/URL, runtime role safety,
  auth-origin, queue runner and existing daily reminders. Tests use fixture URLs; no provider
  or database call. Existing Vite deprecation and intentional runner failure-fixture logs remain.
- Final post-review API typecheck, dedicated migration-config typecheck, touched-file lint,
  optional-paid deployment checker/typecheck and tracked-file diff checks passed.
- The real installed Drizzle CLI rejected a missing production migration URL with exit 1,
  before any database connection, without printing the fixture credential.
- Independent review identified query-host/encoded-host issues; fixes and regressions are
  included, and final focused re-review found no remaining concrete parser issue.
  Full workspace CI, public-host cold starts, recovery and mailbox acceptance remain open.

Sources: [Render deploy steps](https://render.com/docs/deploys#pre-deploy-command),
[Render Free](https://render.com/docs/free),
[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
[scheduled workflow limits](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule),
[budget stop controls](https://docs.github.com/en/billing/how-tos/set-up-budgets).
