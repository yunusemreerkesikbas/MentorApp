# Staging cost options

This evaluation follows the owner's request to reduce staging costs before creating paid Render
resources. The normal production architecture remains NestJS + Next.js on Render, Neon Postgres
and Cloudflare; no provider substitution or weakened security is proposed.

## Recommended first staging profile: on demand

Use [`render.staging-low-cost.yaml`](../../render.staging-low-cost.yaml) instead of
`render.staging.yaml`. They describe the same stage service names/domains and are mutually exclusive.
The proposal is prepared and checked locally; it has not been applied to Render.

| Component | Profile | Compute floor |
|---|---|---|
| API and web | Two Render Free web services; no stage admin | $0/month within free instance limits |
| Separate Render cron services | None | $0/month |
| Staging database | Neon Free, fixed 0.25 CU | $0/month within free quotas |
| Two Render custom domains | Both fit the confirmed unused Hobby allowance | $0/month |
| Postmark, R2, AI, traffic and build overages | Existing/separate account quotas | Metered separately; not included in the floor |

The zero-hosting-fee profile fits the verified Hobby account: no payment card, no pending charges,
0 of 2 custom domains used, 750 Free instance-hours, 5 GB bandwidth and 500 pipeline minutes
included per month. Stay within these allowances; do not add a card or upgrade. Free quota
exhaustion can stop availability. Provider usage remains bounded separately.
Sources: [Render pricing](https://render.com/pricing),
[custom-domain allowances](https://render.com/docs/custom-domains),
[Render Free limits](https://render.com/docs/free),
[Neon Free update](https://neon.com/blog/neon-free-plan-1-gb-per-project).

Tradeoffs:

- Render Free services sleep after 15 minutes without inbound traffic and need about a minute to
  start again. Multiple services can wake independently; a first visit may require waiting/retrying.
  They share 750 running instance-hours per workspace per month, rather than 750 hours each.
- Pre-deploy commands are unavailable on Free. Apply the normal Drizzle migration chain with the
  direct migration role **before** each deployment. Auto-deploy is off in this proposal to preserve
  that ordering. Never put migrations into frontend builds or give the API an owner runtime role.
- No paid cron services run. The API already polls queued user-triggered jobs every ten seconds,
  so signup/recovery emails can be delivered while the API is awake. Pending work resumes on the
  next wake; this profile does not promise scheduled reminders while the API sleeps.
- Invoke daily reminders, mentorship digests and subscription expiry manually against the stage
  API when testing those flows, with the existing cron secret. Keep real payments disabled.
  This is a staging tradeoff, not a production scheduling design.
- Do not add keep-alive pings to defeat Free sleep. R2 stays the durable object store, and Neon
  stays the database; local filesystem contents on Render are disposable.
- Production security checks, Cloudflare origin validation/Access, HTTPS, Turnstile, restricted
  runtime DB role and noindex still apply. Cheap hosting does not permit fake production providers.

## Why an always-on API can make the database bill larger

The codebase's `JobRunnerService` queries Postgres every ten seconds by default. The readiness
endpoint also executes `SELECT 1`. These activities keep Neon active while the API runs; a pooled
connection does not eliminate compute usage from periodic queries.

Neon Free currently allows 100 CU-hours per project per month. A fixed 0.25-CU compute running
for 30 full days needs `0.25 × 24 × 30 = 180 CU-hours`, exceeding that quota. Free is suitable
for the on-demand profile; it is not a claim of month-long always-on availability. On Free,
quota exhaustion can stop availability instead of silently authorizing a paid-plan upgrade.
See [Neon compute lifecycle](https://neon.com/docs/introduction/compute-lifecycle) and
[Free allowance](https://neon.com/blog/neon-free-plan-1-gb-per-project).

An always-on alternative keeps only the API paid and web/admin Free, and omits separate queue
cron. Its Render API starts at $7/month. At the published Launch rate of $0.106/CU-hour, a
continuous 0.25-CU database for a 30-day month would be approximately $19.08 in compute alone,
plus storage/history/transfer. This is a forecast, not the current account's bill: the account
is still Free and no upgrade has been requested or performed.
[Neon compute rate](https://neon.com/blog/major-compute-price-reduction-on-neon).

The original three paid services/four-cron proposal has a Render compute floor around $25/month
before database/provider costs. It is closer to continuous release rehearsal, but not required
for the first internal on-demand staging environment.
[Cron billing](https://render.com/docs/cronjobs).

## Actual setup state

- The owner confirmed Cloudflare manages the domain, an existing Postmark service is available,
  and no Render/Neon application services were already provisioned.
- The Neon connection is working. Created project `puhu-s1`, id `nameless-surf-42172578`, on the
  confirmed Free organization `Yunus Emre`, in `aws-eu-central-1` (Frankfurt), Postgres 16.
- Default branch: `staging`, id `br-orange-truth-b9qhwncd`; database: `mentor`;
  migration role: `puhu_s1_migration`. Endpoint `ep-gentle-sky-b9gnp8lq` is bounded to 0.25 CU.
  The provider rejected an explicit suspend-interval override on this Free account, so its default
  was retained. Do not infer automatic suspension solely from public plan documentation; verify
  the endpoint's actual idle behavior before unattended use.
- On 2026-10-13, after explicit stage-only approval, enabled pgvector, created the restricted
  `puhu_s1_runtime` login/default DML grants and applied all 126 existing Drizzle migrations.
  Production-mode runtime-role inspection passed against the pooled connection. Bootstrap flags
  are `ai.enabled=false` and `dev.email.console_enabled=true`: AI stays disabled and test emails
  go to stage logs. Logs can contain verification/reset links; restrict access. Credentials and
  independent secrets live only in ignored `.env.staging`, with TLS `sslmode=verify-full`.
  Local development env was not changed. Suspend the endpoint during setup pauses to save quota.
- No Render service, paid-plan upgrade, Cloudflare DNS/Access rule or email provider change has
  been created in this step. Render email verification/login and Hobby billing were confirmed.
  No Render MCP management tools are exposed; setup uses the browser. GitHub App connection
  completed after the owner's explicit approval and reauthentication, scoped only to `MentorApp`.
  Render now lists this repository. Cloudflare DNS/Access/R2 settings still need inspection.

## Next actions after choosing the profile

1. Use the connected repository to create only the two Free services; preserve Hobby/no-card.
2. Restore Cloudflare browser access, or provide appropriately scoped credentials through local
   secret settings. Never paste API tokens or database passwords into the chat.
3. Keep migration credentials separate from the runtime login. Apply any later migrations with
   the direct owner URL and recheck runtime safety; do not rerun the one-time role creator.
4. Prepare stage-specific Turnstile, R2 buckets/token and Access audience, and verify the intended
   Postmark sandbox sender before enabling real email delivery. The first stage keeps console
   email enabled. Preserve the existing legal/support inbox address as instructed.
5. Publish the verified source through the repository's normal review/CI path, provision the chosen
   staging profile, apply DNS/TLS in the order from [deployment.md](./deployment.md), and record
   live browser/provider smoke evidence before declaring staging ready.
