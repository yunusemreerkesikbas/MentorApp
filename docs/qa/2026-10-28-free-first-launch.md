# Free-first launch evidence and spending controls

Owner direction, 2026-10-28. Evaluate free services first, then consider the cheapest suitable
paid option only when measurements justify it. No fixed total monthly spending target.
Auto-upgrades, paid overages and auto-recharge must remain off. An email alert is not a cap.

Status: source preparation and local measurements complete; live free-tier acceptance is
**not complete**. No paid hosting, billing or live application flag was changed. The owner
completed Resend login and imported the three approved sending DNS records; Free and disabled
paid overages were verified. Public DNS matches exactly and Resend completed domain verification.
The domain is Verified. An owner-approved, domain-scoped sending key was saved only to an
ignored local acceptance file; one transport test reached the provider's Delivered event.
The owner confirmed this message reached the Gmail Inbox and supplied a screenshot showing
the correct sender. The separately approved Cloudflare support-forwarding setup and its
single-message Gmail Inbox test also passed. The local auth API/queue then passed with two
approved real messages, both marked Delivered by Resend. The owner confirmed verification in
Gmail Inbox but reset in Spam; reset Inbox acceptance remains open. Cold-start signup/reset
delivery remains unverified.
Reset-message header inspection subsequently confirmed SPF/DKIM PASS and DMARC FAIL; public
DNS confirmed the missing DMARC policy. After browser recovery, published the non-enforcing
`v=DMARC1; p=none;` TXT record; Cloudflare and public `1.1.1.1` DNS show the exact value. See the
auth acceptance record for evidence and the public-HTTPS retest gate. New-message DMARC PASS
and reset Inbox acceptance remain unverified; DNS publication does not guarantee Inbox.
The [2026-10-29 Turnstile preflight](2026-10-29-turnstile-preflight.md) verified the existing
integration and 87 focused tests. The owner subsequently approved the free Managed widget
and saving its keypair only to the ignored local acceptance file. Provisioning and the
dummy-secret probe passed. The owner's manual browser challenge then passed the real local
Nest login (200) and same-token replay rejection (400), after the automated browser attempt
hit Cloudflare 300030. Production Next.js/Render acceptance remains pending.
No security guard was relaxed and no account API credential was created.
The owner requested the original checkout/current branch; unrelated landing work is
outside this package. Earlier cost profiles are historical alternatives.

Continuation: [local auth email acceptance](2026-10-28-auth-email-acceptance.md) found and fixed
request-language loss in queued auth mail. Real local API/DB/queue tests passed first with
provider HTTP mocked, then with actual Resend delivery. Render cold-start acceptance remains open. The current
[Cloudflare setup guide](https://developers.cloudflare.com/cloudflare-one/setup/) still requires
payment details even on Zero Trust Free. No Access plan, card/overage terms or security bypass
was accepted; browser control disconnected before completing a fresh account-level inspection.

## Provider matrix

Prices/limits checked against primary sources on 2026-10-28. Account observations below are
session snapshots, not billing settings enforced by the repository. Authorized DNS/domain/key
setup and the separately approved transport/forwarding/auth tests are recorded separately below.

| Service | Free candidate and limits | Exhaustion / actual stop | Decision and paid gate |
|---|---|---|---|
| Render web/API/admin | Hobby; 750 shared running instance-hours/month, 500 build minutes, 5 GB public outbound, two custom domains. Free services sleep after 15 idle minutes; waking takes about a minute. | Free-hour exhaustion suspends Free services. Without a payment method, bandwidth exhaustion suspends services and build exhaustion stops new builds. With a card, bandwidth is billed; the pipeline spend limit covers builds only. | Test a temporary free rehearsal first. Never apply the existing paid Blueprint for that test. Current account has no services/card; preserve that state until acceptance. |
| Neon Postgres | Free: 100 CU-hours/project/month, 1 GB database storage, 5 GB outbound, six-hour limited restore history. Start at min=max 0.25 CU, approximately 1 GB RAM. | Compute/network exhaustion suspends project compute; storage-growing writes fail at the Free storage limit. Free does not bill overages. | Suitable only if measured active time fits the quota. No organization upgrade or larger compute without a separate cost proposal. |
| Resend transactional email | Free verified before testing: 0/3,000 monthly and 0/100 daily messages; three included domains. This workflow subsequently sent four approved messages: direct delivery, support forwarding, auth verification and password reset; all four are marked Delivered. | Actual Transactional/Automations/Inboxes pay-as-you-go switches are off and disabled on Free. Quota exhaustion blocks sending; delivery errors retain existing queue retry/expiry guards without a paid fallback. | Source migration is ready. `puhukoc.com` added in eu-west-1; sending DNS matches and the domain is Verified. Resend receiving remains off; inbound support uses Cloudflare instead. Custom tracking is not configured. The sending key exists only in the ignored local acceptance file; production credentials remain unconfigured. |
| Cloudflare DNS, Turnstile, Email Routing | Use Free plans. Turnstile Free supports 20 widgets and unlimited challenges. Inbound Email Routing is free. | Product limits are not permissions to enable paid products. Keep unrelated account workloads unchanged. | The three Resend sending records, five Cloudflare receiving records and one non-enforcing DMARC TXT record are published. Support forwarding to the verified Gmail address is Active; its Inbox test passed, catch-all is Disabled. One approved Managed Turnstile widget is created; its local keypair, dummy-secret probe and real local Nest login/replay acceptance passed. Production Next.js/Render acceptance and website DNS remain open. No paid Workers/email-sending product was enabled. |
| Cloudflare Access | Evaluate Access Free for the operator only; retain the existing admin/API Access checks. | Current seat-management documentation states that new users are blocked once all subscription seats are consumed. This bounds seats, not other metered Cloudflare products or the whole account invoice. | Account onboarding still requires payment details. The owner's earlier refusal of card/overage terms remains in force; no activation or bypass was performed. Verify the actual Free subscription/checkout before considering a new decision. |
| Cloudflare R2 Standard | Shared Free allowance: 10 GB-month storage, 1M Class A and 10M Class B operations; internet egress is free. | R2 bills storage/operations above the allowance. Budget alerts do not stop them. No account-wide hard billing stop has been verified. | Retain existing unrelated/dev/staging buckets. Do not enable production uploads/public media until enforceable request/storage controls or a suitable bounded alternative have been verified. |
| Sentry | Evaluate Developer Free for one operator, with error monitoring only. No Replay or tracing in the initial cost profile. | Confirm the actual account plan/quota and paid-overage behavior before supplying production DSNs. A DSN does not enforce spending settings. | API integration exists. Web has only an environment slot, not an initialized browser SDK; do not claim browser monitoring is working. |
| OpenAI / Gemini | AI stays off during acceptance; do not assume API credits or privacy-suitable free usage. | Application cap selected: `ai.budget.monthly_cap_usd_cents=100` before activation. The catalog's `0` means unlimited, not zero spend. App accounting/reservations are not a provider invoice cap. | Verify model availability/prices, all billable paths, conservative reservations and provider stop/top-up controls before enabling limited coach AI. Unknown model prices must not be treated as zero-cost permission. |
| AdSense / Ad Manager | No subscription purchase is needed for the initial publisher evaluation. | No real publisher ID/account acceptance has been established. Flags stay off; no sample ID is production inventory. | The selected Google account has no AdSense account. Account terms, site review, actual seller ID/inventory and policy/age checks remain outstanding. Ad approval does not block an ads-disabled application launch. |

Sources: [Render Free](https://render.com/docs/free),
[Render bandwidth](https://render.com/docs/outbound-bandwidth),
[pipeline stop control](https://render.com/docs/build-pipeline#setting-a-spend-limit),
[Neon pricing](https://neon.com/pricing),
[Neon Free exhaustion](https://github.com/neondatabase/website/blob/main/content/faqs/free-plan-limits-and-quotas.md),
[Resend pricing/overages](https://resend.com/pricing),
[Turnstile plans](https://developers.cloudflare.com/turnstile/plans/),
[email pricing](https://developers.cloudflare.com/email-service/platform/pricing/),
[Access setup](https://developers.cloudflare.com/cloudflare-one/setup/),
[Access seat exhaustion](https://developers.cloudflare.com/cloudflare-one/team-and-resources/users/seat-management/),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[Cloudflare alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/),
[Sentry plans](https://sentry.io/pricing/),
[AdSense cost](https://support.google.com/adsense/answer/32850?hl=en).

## Hosting account recheck, 2026-10-29

Read-only account inspection; no service, database, branch, credential or billing setting
was created or changed. The original checkout remains on `feature/APP-121`.

- Render's **Puhukoc** workspace shows Hobby, no card on file, no pending charges, zero
  included services, and unused monthly allowances (750 instance-hours, 500 build minutes,
  5 GB bandwidth and two custom domains). Workspace Build Pipeline shows an existing
  **USD 0 monthly spend limit**. This stops additional builds after included minutes are
  exhausted; it is not a general invoice or bandwidth cap. Preserve the no-card state.
- The connected Neon organization reports **Free**. Its existing `puhu-s1` project
  (`nameless-surf-42172578`) is in Frankfurt, PostgreSQL 16, with min=max **0.25 CU**,
  a 1 GiB branch logical-size limit and six-hour history retention. Its only listed branch
  is `staging`, currently **archived**; its endpoint is **idle**. No SQL was run, connection
  string retrieved, branch unarchived or endpoint started. These observations do not
  establish production readiness, database-role safety or live quota/resume acceptance.
- The endpoint reports `suspend_timeout_seconds=0`; preserve that raw observation rather
  than interpreting it as an always-on setting. Current official Free-plan documentation
  specifies a fixed five-minute idle suspension. Confirm actual resume/sleep during the
  attended rehearsal. Do not change account settings to resolve an untested assumption.
- Next: resolve the migration credential/command ownership and unattended maintenance
  procedure described below, then prepare the isolated Free rehearsal against a reviewed
  commit. Existing Access/storage gates remain open. Keep the archived staging data and
  local-only acceptance secrets intact; neither is a production deployment input.

Sources: account read APIs (`list_projects`, `describe_project`, `list_organizations`,
`list_branches`, `list_postgres_endpoints`), Render workspace Billing/Build Pipeline UI,
[Render Free](https://render.com/docs/free), [Neon pricing](https://neon.com/pricing),
[Neon idle suspension](https://neon.com/docs/introduction/scale-to-zero).

## Local queue measurement

Measured the current `JobRunnerService`, `JobRepository`, pg Pool/Drizzle transaction/RLS context
and `DbHealthIndicator` against a new local-only PostgreSQL/pgvector database named
`mentor_free_first_20261028`, using the repository migrations. No Neon query, real email, AI,
push or paid-provider request was made. The diagnostic refuses non-loopback connections and
databases outside the dedicated `mentor_free_first_*` namespace.

Each scenario ran for 21 seconds after connection warm-up. Count actual pg client statements;
readiness was simulated every five seconds. Do not log SQL parameters or job payloads.

| Scenario | Observed statements | Interpretation |
|---|---:|---|
| No periodic work | 0 | Idle local reference |
| Existing ten-second empty queue poll | 8 | Two transactions, four statements each |
| Poll plus five-second readiness | 12 | Same polls plus four `SELECT 1` probes |

Eight synthetic jobs through the real poller reached an in-process diagnostic handler:
first **10,075 ms**, last **10,115 ms** after enqueue preparation started. This does not include
Render wake-up, HTTP/auth middleware, Neon resume, Resend delivery or mailbox latency; it is
not end-to-end email acceptance or a user-capacity promise.

The empty poll's nominal daily extrapolation is 8,640 transactions / 34,560 statements per
running API instance. More importantly, it prevents a five-minute inactive interval. Frequent
DB readiness probes independently prevent Neon suspension. At continuous 0.25 CU, 30/31 days
consume **180/186 CU-hours**. Free's 100 CU-hours cover 400 active hours, approximately 16.7
continuously active days. Low user count alone does not make the always-on topology free.

The ignored local evidence directory `.artifacts/deployment/free-first/` retains `measure.cjs`
and `measurement.json`. Reproduce from the repository root after migrating a fresh dedicated
local database: set `FREE_TIER_DATABASE_URL` to that database and run
`node .artifacts/deployment/free-first/measure.cjs`. The diagnostic inserts eight synthetic jobs;
use another empty dedicated database for an independent rerun. The measured RSS belongs to
this diagnostic process, not a complete API server, so it is not a Render memory-sizing result.

No polling/health/token TTL change was made. Do not replace DB readiness with liveness, slow
mail polling beyond verification expiry, or remove retention/maintenance just to fit Free.

## Paid alternatives, only after a measured free-plan failure

- The retained `render.yaml` is optional: web and API each have one paid 512 MB instance at
  USD 7/month, admin is Free, and three daily cron services have a minimum USD 1/service/month.
  Two custom domains are included; extras cost USD 0.25/hostname/month. Cron requests retain
  bounded timeouts. These are base/minimum charges, not an invoice maximum. Render has no
  verified account-wide cap for compute/domains/bandwidth; the build spend limit is insufficient.
- Neon Launch at fixed 0.25 CU costs USD 19.08/19.72 compute for a continuously active 30/31-day
  month, plus USD 0.35/GB-month storage and history/other usage. Upgrading the current organization
  can also meter retained staging storage. Project quotas can suspend compute, but they are
  per-metric, approximate and reported with delay; storage can still bill after compute stops.
  They are not an exact total-dollar stop. Verify compute/storage/history/transfer/branch bounds
  and retained resources before presenting a maximum charge.
- Resend Pro is USD 20/month for 50,000 emails, only if Free demonstrably fails the required
  volume. Keep transactional overages off; do not buy a plan just for the initial eight people.
- If a proposed paid service cannot establish an acceptable maximum exposure, do not enable
  its metered feature. Document a suitable bounded alternative or leave its launch gate open.
  Do not silently change providers, reduce safety, delete shared resources or raise limits.

References: [Render pricing](https://render.com/pricing),
[cron billing](https://render.com/docs/cronjobs),
[domains](https://render.com/docs/custom-domains),
[Neon consumption quotas](https://neon.com/docs/guides/consumption-limits),
[Neon alerts](https://neon.com/docs/introduction/spending-notifications).

## Free hosting rehearsal preparation, not provisioned

Use one attended session with synthetic data and separate credentials; stop unused services
before ending it. This is a rehearsal, not a public launch or permanent staging. Keep the
workspace without a card, the additional build-spend limit at zero and auto-deploy off.
Render explicitly recommends Free for evaluation rather than production; accept its practical
limits only after observing the application's real behavior, not merely a successful build.

| Service | Candidate settings | Existing commands, repository root |
|---|---|---|
| API | Free, Frankfurt, Node 22.22.0, production security checks, `/v1/health/ready` | Frozen pnpm install; `pnpm exec turbo run build --filter=@mentor/api`; `pnpm --filter @mentor/api start:prod` |
| Web | Free, same runtime/region, `/tr` health path | Frozen pnpm install; `pnpm exec turbo run build --filter=@mentor/web`; `pnpm --filter @mentor/web start:prod` |
| Admin | Free, same runtime/region, `/login` health path; publish only behind working Access | Frozen pnpm install; `pnpm exec turbo run build --filter=@mentor/admin`; `pnpm --filter @mentor/admin start:prod` |

Leave the monorepo root directory unchanged so shared packages remain available. Review actual
Free/zero-price selections before service creation. Do not add a paid cron/worker, persistent
disk, autoscaling or a third billed custom domain to make the test work. The optional paid
Blueprint and its dedicated checker remain separate; no Free Blueprint was applied or certified.

The following compatibility work is required before a runnable rehearsal can be approved:

1. **Migrations:** Free has no pre-deploy command, one-off jobs or shell access. Run the existing
   `pnpm --filter @mentor/api db:migrate` from a trusted operator environment against a new,
   isolated database before API deployment; never migrate during each API wake-up. The
   [2026-10-29 source adaptation](2026-10-29-free-hosting-preparation.md) moves the explicit
   production migration connection requirement into a dedicated Drizzle config. The runtime
   needs only its restricted `DATABASE_URL`; role/security checks remain. Operator execution,
   dedicated roles and recovery acceptance are still pending. Do not invent placeholder URLs.
2. **Scheduled work:** the queue poller operates only while the API runs. An attended rehearsal
   can call the existing secret-protected daily-reminder, notebook-review, mentorship-digest
   and subscription-expiry endpoints, then inspect persisted results and queue catch-up.
   The optional paid Blueprint schedules three of these; notebook review has a separate
   controller endpoint but no matching trigger in that Blueprint/workflows. A permanent Free
   scheduler, including missed-run handling, is still unresolved. A public-repository standard
   GitHub runner is a free candidate. The [queue source fixes](2026-10-29-queue-recovery.md)
   now dedupe inbox retries and quarantine uncertain interrupted jobs with owner-selected
   manual review; live monitoring/restart acceptance remains open. No scheduler was activated. Do not add a paid
   fourth cron silently or use manual calls as proof of unattended production maintenance.
3. **Wake-up acceptance:** close test clients and stop test traffic for actual sleep. Observe
   the first cold auth/cron request, its response body, queue timestamps and received mail.
   Require the expected API result, not just HTTP success. A timeout is a failed run. Preserve
   readiness, edge/Access checks and the 180-second verification expiry; no keep-alive workaround.
4. **Credentials and release:** Access activation, Turnstile, bounded storage, restricted DB
   role and separate rehearsal secrets must be ready. The local Resend acceptance key is not
   authorization to upload it to Render. Select the exact reviewed commit and complete its
   full CI before deployment; concurrent uncommitted landing work is outside this package.

Sources: [Render Free limitations](https://render.com/docs/free),
[pre-deploy availability](https://render.com/docs/deploys#pre-deploy-command),
[monorepo root behavior](https://render.com/docs/monorepo-support).

## Acceptance and remaining live gates

1. **Free hosting rehearsal:** keep the account without paid fallback. Record service settings
   and shared quotas. Free instances do not support the paid Blueprint's pre-deploy/one-off
   facilities or paid cron profile unchanged. Review a compatible migration/maintenance procedure
   first; use only isolated synthetic data and a reviewed, fixed expiry. Do not publish the main
   site merely to measure a cold start.
2. **Cold auth path:** after actual service sleep, verify signup, verification, password reset
   and retries in TR/EN. Include API/web wake-up, DB resume, queue wait and inbox receipt in the
   timing. The current verification token lasts 180 seconds; expired/superseded tokens must
   never be sent. Check the client's timeouts too. Waiting through a quota outage requires a
   newly requested token, not replaying expired mail.
3. **Background work:** check reminders, coach digest, subscription expiration, retention and
   orphan recovery after idle/restart. A scheduled request that times out is a failed run, not
   successful maintenance. No constant keep-alive pings that defeat free suspension.
4. **Quota stop:** verify the actual Free/overage settings and observe safe boundary failures
   without deliberately exhausting a live account. Local HTTP 429/5xx delivery tests verify
   propagation/sanitization only. Account controls are not configured by this source package.
5. **Production safety:** separate restricted runtime/direct migration roles, independent secrets,
   restore/rollback, origin denials, Access/MFA, Turnstile and actual mail DNS/receipt must pass.
   `puhukoc.com` is registered; A/API/admin/media remain unconfigured. Resend sending and
   Cloudflare receiving/support forwarding passed separate single-message Gmail Inbox tests.
   Cold-start application auth mail remains a separate gate.
6. **Release:** public signup is intended, `signup.pilot.enabled=false`; eight people is an
   initial usage assumption. Before public traffic, explicitly keep `ai.enabled=false`, ads,
   payments, SMS and sponsorship behind their existing gates. Source defaults/live overrides
   are distinct. Full exact-commit CI and review are still required; earlier remote CI has an
   unrelated community source-assertion failure. This package does not claim release readiness.

## Verification result

- Focused API delivery/env/runner/admission group: **126/126 passed**. The additional regression
  checks that copying an empty optional key from the example env still permits local console
  delivery, while production rejects empty/whitespace credentials and an absent sender.
- Real Nest/notifications integration against the dedicated local database: **4/4 passed**.
  The first attempt was blocked by an unrelated local `ADS_LOCAL_TEST_ENABLED` setting; the
  successful rerun explicitly isolated test environment, loopback app URL, disabled local ads/
  SMS, fake providers and the blank Resend key. No live message was sent.
- API TypeScript check, API build, targeted API/admin lint, web legal registry **3/3**, deployment
  checker and its strict TypeScript check passed. These do not establish full-workspace CI.
- Independent read-only review found no blocking runtime defect. Required sender-example and
  integration-fixture migration cleanups were completed; the admin provider hint was updated.
- Live free hosting and quota exhaustion remain pending. The owner confirmed the single
  transport message in the Gmail Inbox, with the correct sender, and supplied a screenshot.
  The owner imported
  the three approved Resend DNS records after browser control became unavailable. Public DNS
  matches the exact DKIM key and both DNS-only CNAME targets. Resend recorded DNS verified;
  the domain subsequently reached Verified.

Approved and published records, with CNAME proxy disabled (the imported BIND file uses
300-second TTL):

| Type | Name | Content |
|---|---|---|
| TXT | `resend._domainkey` | The public DKIM value displayed for this exact Resend domain; retained in the local review screenshot |
| CNAME | `rsend` | `rsend-euw1.forge.rmta.net` |
| CNAME | `send` | `send.forge.rmta.net` |

The account offered these actual Resend Forge CNAME records, not a guessed legacy Amazon SES
MX/SPF recipe. There were no existing Cloudflare DNS records at preparation. The five receiving
records and support forwarding were subsequently approved and configured as recorded below.
Root DMARC was subsequently published as `v=DMARC1; p=none;` and verified through public DNS
after the auth-mail Spam investigation. The approved Managed Turnstile widget was subsequently
created, and real local login/replay acceptance passed through the owner's normal browser.
Production site DNS, rendering/hostname/cold-start acceptance and Access remain open.


The browser control connection later disappeared and could not be restored through the
supported recovery paths; no Cloudflare API credential is configured. A validated three-record
BIND import file is retained at `.artifacts/deployment/free-first/puhukoc-resend-dns.txt`.
The owner confirmed import with **Proxy imported DNS records off** on 2026-10-28. Exact public
DNS comparison passed at 08:44 UTC (11:44 TRT); evidence is retained in
`.artifacts/deployment/free-first/resend-dns-check.json`. Resend DNS verification was started
and the domain subsequently reached **Verified**, with the provider stating it is ready to
send. Evidence is retained in `.artifacts/deployment/free-first/resend-domain-verified.jpg`.
Domain verification does not establish actual inbox delivery. After explicit owner approval,
the key `puhu-local-email-acceptance` was created with **Sending access** limited to
`puhukoc.com`. Its value was written only to the Git-ignored
`apps/api/.env.resend-acceptance.local`, alongside `RESEND_FROM=noreply@puhukoc.com`.
The main development env and production service credentials were not changed. This dedicated
file is for manual local acceptance; it is not automatically loaded by the application.

One owner-approved transport test was sent from `noreply@puhukoc.com` to
`erkesikbasyunusemre@gmail.com` at 09:36 UTC (12:36 TRT) on 2026-10-28. The API accepted it
with HTTP 200, and the provider UI recorded both **Sent** and **Delivered**, message ID
`01a181de-75c0-7d14-928b-c5913957e1bc`. No automatic retry or extra send occurred under that
initial approval; the separately approved support test is recorded below.
The local one-shot diagnostic reserves its result file before sending and supplies an
idempotency key; rerunning it fails before another send. Evidence is retained in
`.artifacts/deployment/free-first/resend-transport-result.json` and
`.artifacts/deployment/free-first/resend-test-delivered.jpg`; neither contains the API key.
Delivered alone confirms recipient-server acceptance. The owner subsequently confirmed
receipt and supplied a screenshot showing **Gelen Kutusu** and `noreply@puhukoc.com` as sender.
Inbox receipt is therefore verified for this one Gmail message; this does not establish
delivery reliability across recipients or future messages.
This direct transport test did not exercise signup, reset, application queueing,
Render cold starts or the 180-second verification window. Those release gates remain open.

## Support mail routing, verified

After reviewing the prepared settings, the owner explicitly approved the five receiving DNS
records, Gmail destination verification, the support-only forwarding rule and one test.
Cloudflare Email Routing was activated only for `puhukoc.com` on 2026-10-28. The existing zone
contained exactly the three approved Resend records; these were retained. Published additions:

| Type | Name | Published value | Priority |
|---|---|---|---:|
| MX | `@` | `route1.mx.cloudflare.net.` | 33 |
| MX | `@` | `route2.mx.cloudflare.net.` | 76 |
| MX | `@` | `route3.mx.cloudflare.net.` | 24 |
| TXT | `cf2024-1._domainkey` | Exact public DKIM key supplied by the Cloudflare activation form | n/a |
| TXT | `@` | `v=spf1 include:_spf.mx.cloudflare.net ~all` | n/a |

Public DNS confirmed all three exact MX targets/priorities, one root SPF record and the
Cloudflare DKIM selector. The Resend return-path CNAME still points to its approved target.
The Gmail verification email was opened only in the selected account and its official
Cloudflare verification link completed the approved destination setup. The destination list
subsequently showed **Verified**. No verification token was printed or retained in evidence.
The routing page shows exactly one rule: `destek@puhukoc.com` ->
`erkesikbasyunusemre@gmail.com`, **Active**. Catch-all is **Disabled**; the domain overview shows
Routing **Enabled**, one domain, one destination and one rule. No unrelated domain, existing
destination, paid product or billing setting changed.

One message from `noreply@puhukoc.com` to `destek@puhukoc.com` was accepted with HTTP 200 at
10:19:58 UTC on 2026-10-28, ID `01a18206-1281-7881-84d8-55ce4adbfa68`. Its subject is
`PuhuKoç destek yönlendirme testi`. The selected Gmail account showed it in **Gelen Kutusu**,
with sender `noreply@puhukoc.com` and recipient `destek`. The sender is different from the
Gmail forwarding destination, avoiding same-account test suppression. The one-shot diagnostic
reserves a result file before sending and uses an idempotency key; no retry or second routing
test was sent. This confirms one real receiving/forwarding path, not all mail clients or future
delivery reliability. Gmail sending as `destek@puhukoc.com` was not configured by forwarding.

Evidence under `.artifacts/deployment/free-first/`: `support-routing-dns-check.json`,
`support-routing-test-result.json`, `support-destination-verified.jpg`,
`support-routing-active.jpg`, `support-routing-domain-active.jpg`, and
`support-routing-inbox-received.jpg`. No credential or verification URL is included.

Sources: [routing setup](https://developers.cloudflare.com/email-service/get-started/route-emails/),
[destination verification](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/).
