# Daily inbox dedupe and interrupted-job quarantine

2026-10-29. Original checkout/current `feature/APP-121` branch. Owner explicitly selected
manual review of executions with an uncertain outcome, without blind replay.

## Behavior

- Daily inbox reminders now pass `daily-reminder:{UTC-day}` into the existing per-user
  notification unique index. Sequential retries and simultaneous triggers create one row
  and one realtime event; the following day can create a new reminder. Email/push preferences
  and their existing delivery guards remain unchanged. This is not a claim of exactly-once
  delivery across all channels or partially failed dispatches.
- The runner claims one pending job immediately before executing it, rather than reserving
  an entire batch as RUNNING. Remaining jobs stay PENDING during a slow or interrupted handler.
  Calls retain the existing bounded batch budget; quarantined rows count toward processed/dead.
- `notifications.jobs.running_timeout_seconds` defaults to **900 seconds** (allowed 60–86400).
  While executing a job, the runner refreshes its heartbeat every one-third of the timeout.
  Heartbeats do not overlap and stop after execution/failure; no heartbeat runs for idle jobs.
  Timestamp/expiry comparisons use PostgreSQL time, within ordinary short transactions.
  No queue-claim transaction remains open while invoking a handler.
- On an active runner, an expired RUNNING row is atomically moved to **DEAD**, with
  `Execution interrupted; outcome unknown; manual review required.` No payload is replayed.
  Recovery scans are throttled to the timeout interval per API instance. Full pages can drain
  on successive bounded calls; a large backlog may consume successive batch budgets.
- Heartbeat/completion/failure/dead writes require both RUNNING status and the same attempt
  number. An old execution cannot resurrect quarantine or rewrite a newer attempt.
- If the handler succeeds but persisting completion fails, the runner leaves the execution
  uncertain and raises a static error. It does not schedule that successful side effect again.
  Ordinary handler-thrown failures retain their existing retry/backoff/max-attempt behavior;
  provider timeout ambiguity and provider-side idempotency are separate concerns.

## Operator use and limits

Do not reset all DEAD/RUNNING rows to PENDING. Quarantine means the side effect may already
have happened. Review the job ID/name/attempts/static reason, provider/domain evidence and
current state privately before invoking a feature-specific fresh action. Do not copy payloads,
auth links, recipient details or secrets into monitoring/comments. For expired auth mail,
request a fresh verification/reset action; do not resend a stored expired link.

Quarantined rows and discarded stale-owner results emit Sentry errors tagged only with job
ID/name. Heartbeat failures log static metadata without raw errors or payloads. Actual Sentry
configuration/receipt is still a live release gate. A sleeping/quota-suspended API cannot scan
or alert until it runs again. The timeout is not a completion deadline or delivery guarantee.

This adds no schema, new dependency, Redis, worker service or paid scheduler. One-at-a-time
claiming adds short transactions per executed job; heartbeat work happens only during long
executions. Existing idle polling/readiness still keep Neon active while the API is awake;
this change does not fix or bypass the Free compute quota.

## Test scope

Tests use a new loopback-only PostgreSQL database,
`mentor_queue_1793269807366_test`, created for this task. The existing `mentor-postgres`
container was initially stopped and was started without deleting/replacing its volume.
No live/Neon database, real email, SMS, AI, payment or scheduler was used.

- Real PostgreSQL daily regressions first produced duplicate rows for retries/races and three
  rows across two days. All three pass after adding the existing dedupe key.
- PostgreSQL regressions first showed late completion overwriting DEAD, an old failure
  rewriting a newer attempt, and unstarted jobs being marked RUNNING. The completed suite
  also covers stale quarantine without replay, fresh/heartbeating work, concurrent recovery,
  heartbeat fencing and ordinary failure backoff/max attempts.
- The real jobs UPDATE trigger always refreshes `updated_at`. Expired fixtures therefore use
  INSERT with an old timestamp; no trigger or production guard was disabled for the test.
- Timer/state tests cover a live slow handler, heartbeat failures/cleanup, recovery cooldown,
  full-page draining and completion-write failure after a successful side effect. The latter
  first resolved as a retry and now rejects without putting the job back into PENDING.

Final commands/results and the independent scoped review are retained in the ignored
`.artifacts/deployment/free-first/queue-progress.md` execution ledger. These checks do not
establish Render cold-start behavior, actual monitoring, live mailbox placement or full CI.

Verified results: **192/192** notification/config unit tests and **17/17** isolated PostgreSQL/
Nest HTTP/role tests passed. API build, API typecheck and touched-file lint passed. Independent
scoped review found no blocking P1/P2 issue; its cooldown/full-page coverage suggestion was
added and passed. Expected failure-fixture logs and the existing Vite CJS warning remain.

Related: `daily-reminder.service.ts`, `job-runner.service.ts`, `job.repository.ts`,
`config.catalog.ts`, notification unit tests and the two new PostgreSQL regression files.
