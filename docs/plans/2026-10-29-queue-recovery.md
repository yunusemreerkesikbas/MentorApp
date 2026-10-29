# Notification retry and interrupted-job preparation

Execute inline with the existing checkout/current branch. Owner direction, 2026-10-29:
quarantine interrupted jobs with an uncertain outcome; do not blindly repeat side effects.

## Design

Use the current Postgres jobs table, repositories, ports and runner. Add a per-user/day
inbox dedupe key through the existing notification unique index. Claim one job immediately
before execution, up to the existing bounded batch size, so unstarted jobs remain pending.

Keep active RUNNING rows fresh with a heartbeat derived from a centrally configured timeout
(default 900 seconds). Check for abandoned rows at most once per timeout per API instance;
atomically move only expired RUNNING rows to DEAD with a static manual-review reason and
payload-free Sentry evidence. No automatic replay or new status/schema is needed. Use the
existing attempt count as a fence on heartbeat/completion/failure/dead transitions so an old
execution cannot overwrite a quarantined or subsequently claimed row.

Alternatives: blindly resetting RUNNING to PENDING can duplicate mail/charges; a new queue
system is unnecessary. Database session advisory locks do not fit Neon's transaction pooler.
The selected heartbeat/quarantine path bounds ambiguity without introducing Redis or a
long transaction across an external provider call.

## Constraints and review focus

- No live changes, scheduler, real email/SMS/AI call, new dependency or schema migration.
- Preserve existing retries for explicit handler failures and all auth send-time checks.
- Clock comparisons and heartbeat timestamps use Postgres time. Local timers only decide
  when to request a refresh; they do not decide ownership or rewrite quarantined state.
- A heartbeat is not proof that an external side effect did/did not happen. Manual review
  must inspect evidence before a new job is created. Do not promise exactly-once delivery.
- Keep PII/tokens out of new diagnostics. Keep source/provider release gates open.

## Task 1: Daily inbox idempotency

- [x] Reproduce duplicate rows using real notification services/repository and a fresh local
  test database, with external delivery disabled. Verify same-day/concurrent calls and next day.
- [x] Add the existing day key to createFromTemplate; preserve channel preferences and copy.
- [x] Run focused daily/notification tests and the PostgreSQL regression.

## Task 2: Interrupted jobs without blind replay

- [x] Add real Postgres regressions for stranded RUNNING, old-worker completion/failure,
  active work and pending jobs that have not started. Watch the current implementation fail.
- [x] Add bounded atomic quarantine and attempt-fenced updates; claim one job at a time.
- [x] Add/verify heartbeat lifecycle, recovery throttling and failure/retry unit coverage.
- [x] Run focused suites, API typecheck/build/lint and independent scoped review.
- [x] Update notifications/deployment evidence and execution ledger. No scheduler activation
  until source review and separate live rehearsal/monitoring acceptance.
