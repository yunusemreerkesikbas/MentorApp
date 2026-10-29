# Launch readiness review, 2026-10-29

## Verdict and scope

PuhuKoç combines exam preparation tools, AI companionship and community in one
NestJS API with Next.js web/admin clients. The owner selected a small-user trial on
free services and an **admin-closed trial design** during this review. This is not
approval to publish, accept billing terms, provision credentials or run migrations.

Assumed initial use: the previously recorded expectation of at most eight people.
This is not an enforced account limit. Public signup and the disabled invitation
gate remain the recorded direction; a small trial does not silently enable an allowlist.
AI, payments, SMS and advertising stay off pending their acceptance gates.
The owner subsequently confirmed the core-only trial: forum and human coaching also
remain closed; planning, focus sessions, analysis, notebooks and account flows are in scope.
The admin and AI implementation plans are linked from the selected design. This scope
confirmation does not mean those source changes or live flags have been applied.

### Subsequent local implementation

After explicit plan/inline-execution approval, the admin mode and provider kill-switch
were implemented in the same dirty checkout, preserving owner edits. Findings 2 and the
AI-off portion of finding 3 below now have local source fixes: 161/161 selected admin,
origin, edge, validation and HTTP tests plus 30/30 selected AI regressions passed. API
typecheck and owned-file ESLint passed. HTTP tests needed approved local-loopback access;
provider calls were stubbed and no DB was used. Full CI/live acceptance is still open.
Original observations below remain historical evidence; enabled embedding accounting,
runtime override preparation and actual production configuration remain unresolved.
Independent scoped review subsequently found no blocking issue. Detailed commands/results,
implementation decisions and limits: [local implementation evidence](2026-10-29-closed-trial-implementation.md).

Reviewed checkout: `feature/APP-122`, HEAD
`e2e9bd734539e7929446e63576169f0c04e0a337`, with concurrent uncommitted notebook/quota
and platform changes. Observations about HEAD and the working tree are distinct.
No source code or provider settings were changed by this review. No full test run
was started. Existing owner edits and acceptance credentials were preserved.

## Current setup, checked in this review

| Area | Direct observation | Remaining acceptance |
| --- | --- | --- |
| Domain/DNS | Cloudflare Free zone `puhukoc.com`; nine mail-related DNS records. Public resolver 1.1.1.1 reports Cloudflare nameservers. Apex A lookup has no address; `www`, `api`, `admin`, `media` A lookups return NXDOMAIN. Cloudflare independently warns that apex/www are unreachable. | Create records from actual provisioned destinations, issue certificates, proxy API, verify Full (strict), HTTPS and apex redirect. No DNS write performed. |
| Render | Puhukoc workspace is Hobby, with no services, payment card or pending charges. Included quotas show 750 instance-hours, 500 build minutes, 5 GB outbound and two custom domains. Existing additional build spend limit is USD 0. | Select and rehearse Free web/API; the existing paid Blueprint is not the selected profile. |
| Neon | Connected account lists `puhu-s1`, Frankfurt/Postgres 16, min=max 0.25 CU, six-hour history. Its only listed branch, `staging`, is archived. | Isolated trial database, separate owner/runtime roles, migrations, recovery and quota acceptance. No SQL, unarchive, connection retrieval or compute start performed. |
| Resend | Dashboard shows `puhukoc.com` Verified, EU/Ireland region, sending enabled, receiving disabled and Forge enabled. DKIM plus the two CNAME sending records show Verified. | Public HTTPS verification/reset links, fresh DMARC and Inbox acceptance; actual production key wiring. |
| Incoming mail | Public MX records point to Cloudflare; root DMARC is exactly `v=DMARC1; p=none;`. Prior approved support-forwarding Inbox evidence exists. | No new mail sent in this review. DNS does not prove fresh mailbox placement. |
| Turnstile | Existing `puhukoc.com (Spin)` widget is Managed, with three hostnames and no pre-clearance. Prior real local login/replay acceptance exists. | Exact hosted domain/actions, CSP and real signup/login/recovery acceptance. No second widget or keypair created. |
| Access | Dashboard still presents Zero Trust onboarding. Current official setup documentation requires payment details even for Free; prior refusal remains binding. | Owner selected an admin-closed design; it is not implemented or accepted yet. |
| R2 | Existing dev/staging and unrelated buckets only; no `puhu-prod-*` pair. Overview reports USD 0 observed billable usage, approximately 119.53 MB, 66 Class A and 3.39k Class B operations for its displayed period. | Production EU bucket isolation, CORS/CSP, private-media checks and a bounded spending decision. Account totals include unrelated apps. |
| Sentry | PuhuKoc EU region; Business trial, 14 days displayed, no payment/billing details. Existing `puhu-api` synthetic-event evidence is recorded separately. | Production error receipt/alerts and permanent Free allowance. Billing usage rollups are not a second event-receipt test. Web has no initialized browser Sentry integration in the inspected source. |
| GitHub CI | [Run 577](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/40896335144), for current HEAD, is failed. Its summary says secret scan and web performance budgets passed; API tests failed. Latest listed master run 575 also failed. | Successful full CI on the final reviewed commit, including browser/security steps. |

DNS initially failed under restricted local execution, then succeeded through the
normal approved read-only network escalation. This was not a DNS configuration change.
Render/GitHub plugins were discovered but were not connected; existing authenticated
browser sessions supplied the read-only account evidence. Neon used its connected tool.

## Must resolve before a user trial

1. **There is no accepted release commit.**
   - What this is: CI is the repository's release gate, including shared contracts and browser checks.
   - Problem: Run 577 annotates interrupted-job failures at the pending-job completion and retry assertions. A guarded `beforeAll` queue cleanup already exists as an uncommitted owner/platform change; this review did not add or validate it.
   - Fix: finish concurrent work, review the local test correction, then run full CI on one fixed commit. See the [platform preflight](2026-10-29-platform-release-preflight.md) for earlier focused results.
   - If skipped: publishing would rely on a known failed commit and tests not yet reached by that run.

2. **The free trial has no deployable admin-access profile yet.**
   - What this is: production validation requires Access issuer/audience in `env-production-locks.ts`; `CloudflareAccessGuard` protects both admin API and admin auth.
   - Problem: not deploying the admin frontend does not remove the API startup requirement. Invented issuer/audience values would not be an accepted configuration.
   - Fix: implement and verify the owner's selected [admin-closed design](../plans/2026-10-29-admin-closed-pilot-design.md), retaining full Access enforcement in the existing mode.
   - If skipped: production boot fails, or an improvised workaround invalidates the security boundary.

3. **AI-off configuration is insufficient to guarantee zero provider calls.**
   - What this is: `config.catalog.ts` defaults `ai.enabled=true` and monthly cap `0`, which means unlimited; `ConfigRegistryService` uses these when overrides are absent.
   - Problem: `EmbedArticleHandler.handle` calls `LLM_PORT.embed`; `PrivacyPreservingLlmAdapter.embed` delegates without a kill-switch check or budget reservation, and `OpenAiLlmAdapter.embed` makes the provider request. An enqueued published-article embedding can therefore reach the provider despite a false global AI override. This is a source trace, not an observed live charge or a guaranteed boot-time event.
   - Fix: close the embedding/provider boundary for disabled AI and add a focused no-provider-call regression. Before starting the trial, verify persisted `ai.enabled=false` and the selected positive cap of 100 cents; the positive cap alone does not fix the embedding path. Keep sponsorship off and no provider auto-recharge.
   - If skipped: an AI-disabled rehearsal can still make billable embedding calls; a missing override can additionally enable uncapped AI.

4. **Default exam dates do not support a fresh current installation.**
   - What this is: `ContentSeedService` fills a new database from `seed/exams.seed.json`.
   - Problem: all three KPSS EXAM_DATE values are in July 2026; YKS/LGS have no events. `calendar.util.ts` filters past dates, so those seeds do not yield an upcoming exam on October 29. Existing edited databases may differ.
   - Fix: select the trial exam families and prepare editorial data from the exact official announcement, with source URL and verification metadata. Do not infer future exam dates or overwrite existing editorial rows.
   - If skipped: a fresh trial has empty countdowns and inconsistent exam-dependent flows.

5. **First-release uploads still lack an accepted total spending boundary.**
   - What this is: file/image uploads remain in scope by owner decision; notebook quota work is concurrent and owned separately.
   - Problem: per-user image counts do not bound public signup, all upload surfaces, retained bytes or repeated public/signed reads. R2's free allowance is account-wide and overages are billable; an alert is not a stop.
   - Fix: review the final notebook quota, measure all upload/read paths and explicitly resolve aggregate storage/operation controls or the remaining billing exposure before production upload acceptance. Preserve unrelated buckets.
   - If skipped: a small expected audience can still exceed shared free allowances. See [storage preflight](2026-10-29-storage-monitoring-preflight.md).

6. **Free hosting behavior and maintenance remain unproven.**
   - What this is: the API polls jobs while running; daily maintenance and notebook review reminders have separate protected HTTP triggers.
   - Problem: no free hosted rehearsal or active scheduler has been accepted. Render's 750 hours are shared; two continuously awake services in a 31-day month would use 1,488 hours. A 0.25-CU Neon compute active that entire month would use 186 CU-hours versus the documented 100 Free allowance. These are conditional calculations, not forecasts; outbound queue polling does not itself prevent Render from sleeping, but queries prevent Neon idle suspension while the API stays awake.
   - Fix: rehearse actual sleep/wake, signup/reset expiry, queue interruption/quarantine and every selected maintenance trigger. Measure aggregate usage; no keep-alive workaround or automatic upgrade. Free migrations use the external [attended procedure](2026-10-29-free-hosting-preparation.md), not build/start commands.
   - If skipped: mail, cleanup or reminders can stop during sleep/quota suspension without an accepted recovery process.

7. **Account setup has not established hosted end-to-end acceptance.**
   - What this is: verified email, Turnstile and local Sentry evidence are prerequisites, not hosted user-flow evidence.
   - Problem: the earlier reset email landed in Spam; subsequent DMARC publication has not established new-message DMARC PASS or Inbox placement. HTTPS links, nonce CSP, real Turnstile, cookies/refresh/logout, restricted DB role, storage ownership and recovery have not passed together on the intended deployment.
   - Fix: use synthetic accounts for the attended HTTPS checklist, configure production secrets separately and record receipt/denials/recovery. Keep migration-owner credentials outside the API runtime. Agree an operator support/incident path when admin is closed.
   - If skipped: provider dashboards can look healthy while registration, recovery or data isolation fails for users.

## Should resolve in the release handoff

8. **Status documents mix historical outcomes with current readiness.**
   - What this is: `docs/core/mvp-status.md` still reports September CI failures; older deployment notes retain historical provider choices.
   - Problem: feature completion or an old green build is not evidence for the current commit or live provider state. This review directly observed run 577 rather than reusing September's failure count.
   - Fix: point the release handoff to the final commit, current profile and dated evidence. Preserve history and use `docs/core/deployment.md` plus newer feature timelines for current decisions.
   - If skipped: another operator may repeat completed setup or apply the paid Blueprint to the free rehearsal.

## Publication sequence and exit criteria

1. Approve the detailed closed-admin design and trial feature scope; finish owner changes.
2. Review/implement the scoped admin boundary and AI-off correction, then establish full CI.
3. Prepare the isolated database, reviewed flags/content, restricted role and recovery procedure.
4. Resolve R2 spending and no-admin support operations; select a bounded maintenance caller.
5. Provision only the selected Free services, then attach real DNS/TLS/edge and scoped credentials.
6. Pass actual cold auth/mail, storage, queue, security, quotas and rollback acceptance.
7. Admit the small user group and watch errors, queue backlog and provider usage. Stop admission
   or pause the trial on an unaccepted gate; do not auto-upgrade or blindly replay uncertain jobs.

Render's sleeping Free services answer `/robots.txt` with disallow-all without waking.
Check before opening another page after sleep, then compare the awake response. SEO,
Search Console and ad acceptance are separate from an ads-disabled functional trial.

Not checked: every feature implementation, exhaustive security/penetration testing,
new live mail/AI/SMS/payment calls, actual deployment, browser compatibility/load,
fresh dependency/secret scans or full local CI in this review. Existing local results
are attributed to their prior evidence, not rerun or promoted to current-release success.

Primary references checked: [Render Free](https://render.com/docs/free),
[Neon pricing](https://neon.com/pricing),
[Access onboarding](https://developers.cloudflare.com/cloudflare-one/setup/),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/).

