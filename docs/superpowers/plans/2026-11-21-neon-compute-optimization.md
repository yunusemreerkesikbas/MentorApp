# Neon Compute Optimization Plan

**Goal** Keep the pilot within Neon Free while preserving timely authentication emails and durable job processing.

**Decision** Stay on the Free plan and accept a possible pilot interruption this billing period. Work against the existing NestJS API, `JobQueuePort`, Postgres `jobs` table and Render service. The plan covers validation and a separate production rollout. No plan purchase or production change is included in planning.

## Baseline and targets

On 2026-11-21, Neon reported 81.7 of 100 CU-hours used. The production database was fixed at 0.25 CU and had stayed awake since 2026-11-14 Türkiye time. At 0.25 CU the current pace is 6 CU-hours per day. With about 18.3 CU-hours left at measurement time, continuous operation would reach the cap around November 24–25 Türkiye time. The next period starts December 1 at 03:00 Türkiye time. If Neon suspends compute before rollout, use the isolated test environment to complete validation and schedule the production cutover after the reset.

The Render API probe calls `/v1/health/ready` about every five seconds, and `DbHealthIndicator` issues `SELECT 1`. The queue scans Postgres every 10 seconds with the current defaults. Either cadence prevents an otherwise quiet database from suspending after five minutes. At 0.25 CU the 100 CU-hour quota covers 400 active hours. Set a working target of **90 CU-hours per 31 days**, equivalent to 360 active hours or about 11.6 active hours per day. The 10 CU-hour reserve leaves room for longer pilot sessions and maintenance.

- [Live Neon project](https://console.neon.tech/app/projects/falling-bar-88067595)
- [Live Render health configuration](https://dashboard.render.com/web/srv-dbnfdclg1s2s73cic66g/settings#health-checks)
- [Neon plans](https://neon.com/docs/introduction/plans) and [Render health checks](https://render.com/docs/health-checks)
- [Measured pilot baseline](../../qa/2026-10-13-pilot-cost-profile.md)

## Approach

Use `/v1/health` for Render's frequent process probe on the pilot. Keep `/v1/health/ready` for CI, deployment smoke checks and incident triage. The existing database role check must still complete before the API starts serving. When an already-running API loses the database, the process probe can stay green. Observe database connection errors and real request failures through existing monitoring instead of putting a frequent database ping back into the health path.

Replace periodic idle queue scans on the pilot with a wake after successful enqueue and a single timer for the earliest due job. Keep the database as the source of truth for run times and retries. A 30-minute reconciliation sweep is a proposed recovery limit for a missed wake, not the normal delivery path. If each sweep wakes a suspended database for five minutes and runs briefly, it adds about one CU-hour per day on a single instance. Include that cost in the measured budget.

The existing five-minute cron alone would miss the 180-second verification-link lifetime. Moving post-commit dispatch into the HTTP request would tie response time to the email provider and could change the password-reset response behavior. The process can wake the existing worker without doing either.

## Implementation and verification

### 1. Validate the health checks and preserve the outage signal

- [ ] Add a regression using the existing health E2E fixtures. Repeated `/v1/health` requests perform zero DB pings. `/v1/health/ready` returns `200` with Postgres available and `503` when it is unreachable. Check that `/v1/health` still responds when a running API loses Postgres and that an unhealthy database at startup still prevents a new instance from serving.
- [ ] Verify the isolated API's existing error monitoring reports one simulated failed database-dependent request without logging credentials, tokens or request data. Record the deployment and incident checks in `docs/core/deployment.md`.
- [ ] Keep Blueprint behavior for deployments that still use periodic queue scans. Apply `/v1/health` as a **pilot-only Render setting** during the approved rollout in Task 4. Verify GitHub's bounded maintenance readiness check and CI readiness checks still use `/v1/health/ready`.

### 2. Wake the worker after the job commits

- [ ] Add one pilot opt-in to the existing config registry, with current polling as the default. Keep the switch reversible via the audited configuration path and document whether activating it requires an API restart. Share the existing `JobRunnerService` and `processBatch()` across both modes.
- [ ] In on-demand mode, wake the runner after a standalone `PostgresJobQueueAdapter.enqueue` has committed. A caller passing `transaction` must wake the runner after its enclosing transaction resolves successfully. Cover the auth email token/outbox and payment reward/refund outbox callers. Keep transaction ownership with the current services and preserve `JobQueuePort` as the module boundary. Redispatch work outside the HTTP response and report wake errors through the existing job diagnostics.
- [ ] Test ordinary enqueue, commit followed by wake, rollback without a wake or visible job, and a new enqueue arriving as a batch finishes. Coalesce concurrent wake signals without dropping the final one. Reuse `FOR UPDATE SKIP LOCKED`, delivery claims, heartbeats and stale-execution quarantine. Verify a manual `process-jobs` call racing the automatic worker cannot double-send.

### 3. Preserve retries, scheduled work and restart recovery

- [ ] In on-demand mode, read the earliest runnable or future `PENDING` job via the existing `(status, run_at)` index. Run a bounded batch when due and rearm the single timer from durable state. Rearm for persisted retry times produced by either the automatic worker or the manual `process-jobs` endpoint. Drain a full batch in bounded passes. While no work is pending, leave only the proposed 30-minute reconciliation sweep. Avoid tight retries when Postgres is unreachable and release timers on shutdown.
- [ ] Recover persisted pending jobs on bootstrap after handlers have registered. Test a process restart after commit and before dispatch, a deploy with overlapping old and new instances, missed wake recovery, a provider failure and retry, and next-day reminder delivery. Preserve `DEAD` handling for interrupted work whose provider outcome is unknown.
- [ ] Verify signup, verification resend and password reset end to end on both a warm and a resumed database. Preserve the same reset response for known and unknown accounts. Aim for **p95 enqueue-to-provider-acceptance at or below 30 seconds** in a representative mix of pilot work, with the existing 180-second verification TTL. Include a real inbox smoke test. Stop the rollout if deploy or restart tests can routinely recover verification mail only after the link expires.

### 4. Roll out and measure

- [ ] Rehearse both switches on isolated Postgres and, where available, an approved Free Neon test database. Keep the normal pilot entry points, daily GitHub maintenance and existing orphan-cleanup jobs exercised. Check the quiet database reaches `idle` using Neon management status only. Then open the signup/login flow and record the time to the first real database response.
- [ ] After production approval, deploy the verified queue change with the existing mode selected, confirm `/v1/health/ready` and a real auth smoke, then enable on-demand processing and switch the pilot's Render probe. Check both health paths, login and one controlled email. Record the exact release and prior health path and queue mode for rollback.
- [ ] Check the first 24 hours of Neon CU-hours and review seven days before declaring the cost target met. Target a seven-day average of **at most 2.9 CU-hours/day** and repeated idle periods. Track DB-dependent errors, time to first response after wake, queued-email delay, overdue jobs and duplicates. If compute stays active, inspect actual traffic and scheduler wakeups before changing other query paths.
- [ ] If critical emails regress or overdue work accumulates, restore the previous queue mode and resume the existing internal `process-jobs` recovery path as appropriate. If process probes pass during a database failure without the agreed alert reaching operators, restore the previous Render health path. Recalculate the quota runway after rollback. Restoring either legacy cadence can bring consumption back near 6 CU-hours/day.

## Files and checks

- Health and operations use `apps/api/src/health/`, `apps/api/test/health*.e2e-spec.ts` and `docs/core/deployment.md`.
- Queue changes are owned by Notifications and touch `job-runner.service.ts`, `job.repository.ts`, `postgres-job-queue.adapter.ts`, the shared queue port and the config catalog. Coordinate the post-commit changes with Identity's `auth.service.ts` and Payments' outbox producer and transaction owners. Use the existing auth, job interruption, heartbeat and payment tests as the regression base.
- Run scoped tests with `pnpm --filter @mentor/api test:unit <test-name-filters>` and `pnpm --filter @mentor/api test <e2e-file-filters>` against the local test database. This change touches auth and payments, so require the repository's full CI before production release. Append the shipped behavior and usage to `docs/features/notifications.md` and record the pilot probe in the deployment runbook.
