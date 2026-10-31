# Invited pilot cost and queue profile

Historical evidence, 2026-10-13. The earlier proposal used 20–50 invited users,
Postmark Free (100 emails/month), and in-app/push daily reminders.
This is source preparation and a proposed allocation, not provisioning or a billing guarantee.

> Superseded on 2026-10-28: evaluate suitable free plans first; consider the cheapest paid
> alternative only with measured need and verified spending controls. Public signup is intended,
> invited mode remains off, initial expected usage is at most eight people, and email uses
> Resend. The paid always-on allocation below is a historical alternative, not the selected
> launch profile. See [current evidence](2026-10-28-free-first-launch.md).

## Account evidence

- Render's Puhukoc workspace is Hobby, with no services, card, pending charges or credit.
  Its Billing page showed 5 GB outbound traffic, 500 build minutes, two custom domains and
  750 free-instance hours included. Limits are workspace-wide. No plan was changed.
- Neon organization metadata confirmed Free. The retained `puhu-s1` staging project is in
  Frankfurt, with one 0.25 CU compute currently idle/suspended, and approximately 36 MiB
  logical data. Only management metadata was read; no SQL connection woke that compute.
- The owner confirmed Postmark Free. Its public terms provide 100 messages/month and no
  overage on Free; account sending approval, domain verification and actual used quota still
  require release acceptance. No account login or provider email was performed.
- R2/Cloudflare allowance is shared with retained resources and any other account workloads;
  verify actual aggregate usage before allocating its free tier. Keep staging credentials separate.

## Local measurement

Baseline source: `970ee73296aea87da90eea5445067410ecc487ae`. Queue/health logic matches
the production-preparation base. Windows, Node 22.14.0, existing Docker PostgreSQL/pgvector,
new isolated `mentor_pilot_cost_test` database with the repository's migrations. No Neon query,
real email, AI, push or paid provider call. Use `JobRepository`, `JobRunnerService`,
`PostgresJobQueueAdapter` and `DbHealthIndicator` from the compiled API, not rewritten SQL.

After warming the connection, instrument the real pg clients' query calls, run each timer
scenario for 31 seconds, then stop timers. Classify SQL without logging parameters/PII.

| Scenario | Measured statements | Result |
|---|---:|---|
| No periodic work | 0 | Local idle reference |
| Empty queue, existing 10-second poll | 12 | Three polls, each BEGIN + service context + claim SELECT + COMMIT |
| Poll + a simulated DB readiness probe every 5 seconds | 18 | Same 12 statements plus six SELECT 1 calls |
| Existing liveness method only, every 5 seconds | 0 | Process liveness does not query Postgres |

Five immediate drain samples per cohort, with a fake in-process handler:

| Jobs | Drain samples (ms) | Median | SQL statements per drain |
|---|---|---:|---:|
| 20 | 117.782, 112.663, 128.844, 113.010, 176.503 | 117.782 ms | 85 |
| 50 | 413.546, 338.600, 266.574, 310.353, 264.950 | 310.353 ms | 210 |

The compiled full AppModule application context started in 6.157 seconds, with 207.70 MiB
RSS and 120.30 MiB used heap. Under its real default poller, a 50-job fake-handler burst
delivered its first job 9.756 seconds and its last job 19.859 seconds after enqueue finished.
This excludes HTTP middleware, real provider latency, RLS-constrained production roles,
Render/Neon hardware and network differences. It is not an end-user p95 or a capacity promise.

Local scratch scripts/results are retained under the registration worktree's ignored
`.artifacts/deployment/pilot/`: `measure-cost.mts`, `cost-measurement.json`,
`measure-api-burst.mts`, `cost-api-burst.json`. Each script refuses a non-local target.
Reproduction needs a fresh isolated test DB for the empty-queue run. Scratch tooling is not
part of the deployed application or the repository's test fixtures.

## Consequences for free compute and delivery

The empty poll extrapolates to 8,640 transactions / 34,560 SQL statements per day per API
instance. More importantly, it prevents a five-minute inactive window. Render also probes
the Blueprint's `/v1/health/ready` every few seconds, which independently queries Postgres.
Increasing the queue interval alone therefore cannot make this deployment scale to zero.
[Render probes](https://render.com/docs/health-checks),
[Neon scale to zero](https://neon.com/docs/introduction/scale-to-zero).

At 0.25 CU continuously active, a 30/31-day month consumes 180/186 CU-hours. Neon Free's
100 CU-hours cover 400 active hours, approximately 16.7 continuously active days, not a
full month. A small invitation list does not change this billing floor.
[Current Neon limits](https://neon.com/blog/neon-free-plan-1-gb-per-project).

Keep the existing 10-second polling, DB readiness, service/RLS context and six-hour forum/
coaching orphan sweeps. Liveness-only hosting probes or an event-driven queue wake-up are
separate architecture/reliability decisions, not incidental price optimizations. The current
verification token lasts 180 seconds and expired tokens are suppressed by the send-time
guard. The five-minute Render process-jobs cron cannot be the only verification-mail runner.

Daily email can consume up to 600/1,500 messages for 20/50 users over 30 days. The approved
reminder-email flag removes that optional channel without changing inbox/push or auth mail.
It does not impose a global quota: 50 signup emails leave at most 50 of the free allowance
for retries/reset/preflight/other sends. Start with 20 invitees, monitor the actual shared
quota, and widen only with headroom. Free-plan exhaustion stops delivery; it is not a paid
fallback. Coach/payment/other email sources need separate scope review before activation.
[Postmark limits and pricing](https://postmarkapp.com/pricing).

## Monthly allocation proposals

Use the existing Render/Neon stack. Web and API stay paid/always on to avoid free-service
sleep/cold starts. Do not introduce a second backend, Redis or a new hosting provider.
Neon paid plans apply to the organization: upgrading the current organization would also
meter retained staging storage/history even while its compute is suspended. Include that
usage in the allocation; do not silently upgrade it or create another organization.

| Item | Existing full Blueprint | Lean profile proposal |
|---|---:|---:|
| Render web/API/admin compute | USD 21 | USD 14 (web/API); admin UI publication deferred |
| Render cron floor | USD 4 (four services) | USD 3 (three existing maintenance/reminder triggers) |
| Extra Render domains | Verify at setup, budget up to USD 0.50 | Verify apex/www counting, budget up to USD 0.25 |
| Neon 0.25 CU continuously active | USD 19.08–19.72 | Same; reserve USD 21 for compute/storage/history |
| Postmark Free | USD 0 within the 100-message quota | Same, daily reminder email off |
| R2 / Cloudflare / monitoring | Within verified free allowances; otherwise metered | Same; confirm shared usage |
| AI during initial acceptance | Scope/cap pending | USD 0 until separately agreed |

The USD 0 AI row is an allocation, not a config value: the current default
`ai.budget.monthly_cap_usd_cents=0` means **no cap**. Keep `ai.enabled=false` during initial
acceptance; agree entitlements and a finite positive application/provider allocation before
enabling AI. No AI flag/cap was applied by this task. The Neon estimate assumes a single
production compute with min=max 0.25 CU; raising its ceiling requires a new cost/load profile.

The historical lean profile estimated approximately USD 37–38 before tax/usage extras.
It is an optional always-on paid alternative, not a spending target or an approved allocation.
Any future proposal must separately identify fixed fees, tax, variable charges, shared-account
usage and enforceable consumption limits. Provider alerts and max-CU sizing alone do not cap
the total invoice. Do not select this profile until free-plan acceptance demonstrates a need.

The proposal removes only the redundant Render process-jobs service; the API's existing
poller and secret-authenticated manual endpoint remain. Keep daily reminders (including auth
data purges), subscription expiration and the separate mentorship digest trigger, even if a
feature is currently gated. The original Blueprint is unchanged until the owner selects a
concrete release profile. Do not delete or suspend any existing resource to implement it.

Pricing checked 2026-10-13:
[Render compute example](https://render.com/articles/production-rails-hosting-guide),
[cron minimum](https://render.com/docs/cronjobs),
[domains](https://render.com/docs/custom-domains),
[workspace usage pricing](https://render.com/docs/new-workspace-plans),
[current Neon pricing](https://neon.com/pricing),
[R2 allowance](https://developers.cloudflare.com/r2/pricing/).
Neon's current pricing resource states no paid monthly minimum, USD 0.106/CU-hour,
USD 0.35/GB-month storage and USD 0.20/GB-month restore history; older posts differ.

## Release checkpoints

- Select the deployment profile before changing the Blueprint. Approve actual paid resources
  and billing separately; manual deploy flags do not prevent an initial provisioning deployment.
- Confirm invoices/taxes, Render domain counting, renewal and usage headroom, Neon storage/
  history/restore acceptance, and Postmark sender approval/remaining quota. An alert is not a
  spending stop; Free compute exhaustion is a service stop, not continued free availability.
- Admin Access remains unresolved: the owner declined Cloudflare's card-overage authorization.
  Deferring the admin UI does not waive the API's production Access configuration requirements.
  Keep the guards/environment checks and resolve an acceptable setup before any production API
  starts. Do not publish unprotected admin routes or put placeholder audience values into prod.
- Agree the pilot journey and AI budget/entitlements separately. Do not grant ongoing Free AI.
- Preserve `info@mentor.com`, domain/DNS/TLS conventions, and all retained staging resources.
  No provider plan change, billable resource, DNS, secret transfer, deployment or PR merge occurred.

## Reminder control verification

Four paused-email cases failed before the fix; all 35 focused notification/config unit tests
passed afterward. Four new real-PostgreSQL cases verified inbox/push preservation, unchanged
user preferences, completed/suppressed queued daily mail, guarded verification/reset delivery
and explicit re-enable. The existing 26 auth and six health cases also passed: 71 unique
targeted tests. API typecheck, targeted ESLint, build and deployment validation passed.
The first full CI exposed shared queue contamination: an earlier suite's runnable jobs occupied
the runner's first batch. Reproducing with 75 older local fixture jobs produced the same two
failures. The reminder suite now creates/migrates/drops its own uniquely named localhost test
database, preserving the real claim/handler/token paths and strict assertions. It does not
clear another suite's queue or change production ordering, batch size or provider behavior.

One initial local health setup exceeded its existing 30-second limit during concurrent checks.
The focused repeat used a CLI-only 90-second Windows hook allowance; the health setup completed
in 7.643 seconds. Repository/CI timing and assertions were not relaxed. Full CI results belong
to the PR and exact source commit; local checks alone do not prove whole-workspace readiness.
