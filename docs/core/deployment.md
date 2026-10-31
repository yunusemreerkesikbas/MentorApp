# Production deployment

> Source preparation only. PR #156 does not provision services, change DNS, accept billing
> terms, deploy production or merge itself. Domain ownership and an existing Postmark account
> are confirmed; production infrastructure and live acceptance remain outstanding.

## Domains

| Surface | Production URL | Resource |
|---|---|---|
| Web | `https://puhukoc.com` | `mentor-web` |
| Single API | `https://api.puhukoc.com/v1` | `mentor-api` |
| Admin | `https://admin.puhukoc.com` | `mentor-admin` |
| Public media | `https://media.puhukoc.com` | Public EU R2 bucket |

Use first-level subdomains for Universal SSL coverage. Keep existing host-only Secure,
HttpOnly, SameSite=Lax cookies; do not add a shared cookie Domain attribute. Web canonical
URLs and sitemap use the apex; admin sends `X-Robots-Tag: noindex, nofollow, noarchive`.
Noindex does not replace authentication or Cloudflare Access.

## 1. Release prerequisites and budget

**Current owner direction, 2026-10-28:** evaluate suitable free plans first. There is no fixed
total monthly spending target. Consider the cheapest suitable paid alternative only after
measurements establish the need and its fixed/variable charges and enforceable stop controls
are understood. Keep auto-upgrades, paid overages and auto-recharge off. An alert is not a cap.
The current `render.yaml` remains an **optional paid always-on alternative**, not the selected
launch profile. Do not apply it just to perform the free-plan evaluation. See
[the current plan](../plans/2026-10-28-free-first-launch.md) and
[provider limits and evidence](../qa/2026-10-28-free-first-launch.md).

Permanent staging is not a prerequisite. Local/CI tests use isolated test databases and fake
providers. Full CI must pass on the exact reviewed commit before publication. An optional
temporary rehearsal can validate provider integration before the first release or critical
auth/payment/migration/storage changes; see [deferred-staging.md](./deferred-staging.md).

Resolve these items before authorizing production provisioning:

- Evaluate Render Free and Neon Free in a rehearsal first, including cold-start auth mail,
  aggregate quotas and maintenance jobs. Only then consider the optional paid `render.yaml`,
  with two single-instance paid web services, a Free admin and three daily cron jobs.
  Agree fixed/variable charges and enforceable controls before selecting a paid profile.
  Manual deploy settings do not prevent billing or an initial Blueprint deployment.
- Obtain dedicated production runtime/migration DB URLs and JWT, rate-limit, edge, cron and
  VAPID secrets. Supply production OpenAI, Gemini, R2, Turnstile, Postmark and Sentry settings.
  A Gemini credential is currently missing. Never promote `.env.staging` credentials to prod.
- Resolve admin Access activation: the observed Cloudflare Free checkout required permission
  to charge a card for quota overage. The owner declined it. Do not accept those terms or
  weaken existing Access guards. Admin publication remains blocked pending an acceptable setup.
- Verify the Postmark sending domain, DNS/TLS, storage permissions and actual provider flows.
  Domain purchase alone does not enable hosting, mail delivery, payments or ads.
- Confirm `info@mentor.com` is operational for support/legal contact. Keep that address until
  the owner decides otherwise; `noreply@puhukoc.com` is a separate proposed sending identity.

## 2. Render and database

1. Follow the existing [security release checklist](./security-release-checklist.md) and
   [integration guide](./integrations.md). Connect only this repository to Render. The actual
   release branch is `master`; changing the default/protected branch is a separate task.
2. If free-plan acceptance fails and the paid alternative clears cost/release gates, apply
   `render.yaml`. Every service has
   `autoDeployTrigger: off`. Initial provisioning or Blueprint sync can still deploy; do not
   treat this setting as a provisioning approval gate.
3. Native Node services use Frankfurt/EU and Node 22.22.0. Frozen installs include dev build
   tools; Turbo builds each app's workspace dependencies. Web/admin `start:prod` bind to
   `0.0.0.0` and consume Render's `PORT`. Local starts retain their original ports.
4. Create the production Neon EU database with pgvector. `DATABASE_URL` is the pooled restricted
   runtime connection; `DATABASE_MIGRATION_URL` is the direct migration-owner connection used
   by the existing pre-deploy migration command. The runtime role must not own DB objects,
   bypass RLS, inherit privileged roles or create roles/databases. Startup inspection rejects
   unsafe roles. Keep both URLs out of Git and public environment variables.
5. Create a restore point and run the existing forward-only migration chain with the owner
   connection before starting the API. Never seed demo accounts or run local fixtures against
   production. No new schema or endpoint is part of this preparation.
6. Supply `sync: false` values in provider secret settings and maintain them there after setup.
   Independently generated API secrets must not be shared with staging. Keep
   `NODE_ENV=production` and `APP_ENV=production`; runtime production checks stay enabled.
7. Verify `/v1/health/ready`, restricted-role startup and pool usage. The three daily cron
   services reference `mentor-api` and its `CRON_SECRET`; preserve their UTC schedules.
   The paid API's existing `JobRunnerService` handles the queue automatically; its secret-
   protected `process-jobs` HTTP endpoint remains available for manual catch-up.

### Optional paid always-on alternative and overage controls

Earlier direction on 2026-10-13: keep the reader-facing web and API always on; accept cold
starts only for admin. This is an alternative retained for comparison. The 2026-10-28 direction
requires evaluating free plans first and does not approve the paid resources in this table.

| Render item | Launch choice | Monthly base, USD |
|---|---|---:|
| Web | `0.5c-512mb`, one instance | 7 |
| API | `0.5c-512mb`, one instance | 7 |
| Admin | Free, single instance | 0 |
| Daily reminders, coach digest, subscription expiry | Three daily cron services | At least 3 |
| Compute + cron subtotal | Hobby workspace, no paid workspace upgrade | **At least 17** |
| Custom domains | Two included; each additional billed hostname | +0.25 each |

Prices checked on 2026-10-13: [Render pricing](https://render.com/pricing),
[custom domains](https://render.com/docs/custom-domains),
[cron billing](https://render.com/docs/cronjobs#compute-plans-and-billing).
The three explicit hostnames imply 17.25/month before other usage; reserve 17.50 if the
automatically added `www` alias also counts toward billed domains. Confirm the actual domain
count in Billing after setup. Taxes, Neon, AI, email, storage and usage above allowances are
separate. This is a minimum estimate, not a total spending cap.

The queue catch-up cron was removed because the always-on API already polls pending jobs.
The other schedules remain 06:00, 07:00 and 03:30 UTC. Their HTTP calls fail on error and use
10-second connection / 60-second request limits to avoid a hung request accruing cron runtime.
A timeout is a failed maintenance run: inspect the provider logs and queue, then retry through
the protected endpoint after checking its result. It is not successful task completion.

Render Free can sleep after 15 minutes idle and take about a minute to wake. Its 750 monthly
Free instance hours are shared across the workspace. Evaluate the combined web/API/admin
runtime rather than assuming one full month per service. Free web/API acceptance is pending:
the existing paid Blueprint must not be relabeled Free without validating migrations, queue
delivery and scheduled maintenance. Do not auto-upgrade. Keep Access enabled before publication
and test admin sessions after wake/restart.
See [Free limitations](https://render.com/docs/free).

**Observed account settings, 2026-10-13:** Puhukoc is on Hobby; no services, payment card,
pending charges or usage. Included usage is 500 pipeline minutes, 5 GB bandwidth, two custom
domains and 750 Free instance hours. The Starter build pipeline already has a **$0 additional
monthly spend limit**. These observations are not settings guaranteed by the Blueprint.

- Preserve the $0 pipeline limit in Workspace Settings → Build Pipeline. Once included
  minutes run out, new builds/pre-deploy tasks stop; existing apps continue running. This
  also prevents a recovery build until the next period unless a separately approved limit
  increase is made. Keep automatic deploys off and complete CI before a manual release.
- Render has no documented workspace-wide spending cap for compute, domains and bandwidth.
  Its pipeline limit does **not** stop bandwidth charges after a card is linked. Hobby includes
  5 GB/month, then public outbound traffic costs $0.15/GB. For example, 20 GB/month adds
  `(20 - 5) * 0.15 = $2.25` for bandwidth alone. See
  [bandwidth billing](https://render.com/docs/outbound-bandwidth) and
  [pipeline limits](https://render.com/docs/build-pipeline#setting-a-spend-limit).
- At launch, verify one paid instance per service, no autoscaling, the billed domain count
  and the workspace notification address. During initial use, check Billing and per-service
  Metrics daily. At 400 pipeline minutes or 4 GB bandwidth (80% of included usage), investigate
  before more usage accumulates. Provider emails warn about approaching/exceeded usage;
  notification is not automatic cost containment.
- Use the existing selective Cloudflare caching for public static/media assets and R2 media
  delivery. Keep API/admin/HTML/RSC caching bypasses; never cache private responses to save
  money. Investigate large assets, abusive traffic, repeat builds or excessive service egress.
- Keep separate Neon/provider usage budgets. Before enabling AI, set a positive
  `ai.budget.monthly_cap_usd_cents`; the catalog's `0` default means **no cap**, not zero spend.
  Provider safety and live acceptance gates remain required before opening paid resources.

`pnpm check:deployment` validates the optional paid Blueprint: it rejects a paid admin,
Free web/API in that particular profile, extra instances/autoscaling,
the redundant queue cron, changed daily schedules or unbounded/unauthenticated cron HTTP.
It checks source configuration, not live billing settings or a hard account budget.

Web/admin Render subdomains are disabled to prevent duplicate public URLs and Access bypass.
The API Render hostname remains enabled for secret-authenticated cron calls; ordinary direct
traffic must be rejected by the origin middleware. Verify missing/forged-header denials.

## 3. Cloudflare DNS and TLS

Cloudflare is the confirmed registrar/DNS provider. Review existing records, mail routing,
DNSSEC and CAA before changing anything. Preserve unrelated records and enable account MFA
and renewal. Use each actual generated Render host, not an inferred name.

| DNS name | Type | Target | Final proxy state |
|---|---|---|---|
| `@`, `www` | CNAME | Actual web Render host | Proxied |
| `api` | CNAME | Actual API Render host | Proxied |
| `admin` | CNAME | Actual admin Render host | Proxied |
| `media` | R2 managed | Public bucket custom domain | R2 managed |
| Email records | Provider TXT/CNAME/MX | Exact provider values | DNS only |

Begin Render records with DNS only, verify domain ownership and certificate issuance, then
enable proxying and Full (strict), plus HTTPS redirects. Do not use Flexible SSL. Remove
conflicting A/AAAA records only on those names. Render handles the `www` redirect for its
apex custom domain; verify it after setup. The API rejects normal unproxied requests during
bootstrap by design; health endpoints remain available. Do not weaken the origin check.

## 4. Production environment and edge security

`render.yaml` contains public settings, not actual credentials:

| API setting | Value |
|---|---|
| `APP_URL` | `https://puhukoc.com` |
| `ADMIN_APP_URL` | `https://admin.puhukoc.com` |
| `CORS_ORIGINS` | `https://puhukoc.com,https://admin.puhukoc.com` |
| `TURNSTILE_EXPECTED_HOSTNAME` | `puhukoc.com` |
| `R2_PUBLIC_BASE_URL` | `https://media.puhukoc.com` |
| R2 buckets / jurisdiction | `puhu-prod-public`, `puhu-prod-private` / `eu` |
| Optional OAuth callback | `https://api.puhukoc.com/v1/auth/google/callback` |
| `POSTMARK_FROM` / `VAPID_SUBJECT` | `noreply@puhukoc.com` / `https://puhukoc.com` |

- Overwrite `x-mentor-origin-secret` in a Request Header Transform Rule scoped only to
  `api.puhukoc.com`, using production `EDGE_ORIGIN_SECRET`. Preserve `CF-Connecting-IP`.
  Never expose that secret in browsers, response headers, logs or docs.
- Protect the admin hostname and API `/v1/admin/*` and `/v1/auth/admin/*` with the same Access
  audience and an allowlist/MFA policy. Supply `CLOUDFLARE_ACCESS_TEAM_DOMAIN` and
  `CLOUDFLARE_ACCESS_AUD`. Verify credentialed preflights without bypassing admin methods.
  Do not put an interactive login on the entire API. The billing prerequisite above still applies.
- Create a production Turnstile widget for the exact hostname; use the matching server secret
  and web public key. Verify each operation's action, including login/recovery/phone checks.
- Apply endpoint-specific WAF/rate limits preserving SSE and OAuth callbacks. Bypass CDN
  caching for API/admin/web HTML and RSC; deliberately cache only public static/media assets.
- Create scoped production EU R2 credentials and separate public/private buckets. Attach the
  media domain only to the public bucket; keep private/public-development `r2.dev` access off.
  Restrict upload/read CORS to production origins and run `storage:check`.
- Set web `WEB_CSP_STORAGE_ORIGINS` to exact public-media and EU R2 origins used by signed URLs.
  No wildcards or paths. Validate uploads, private downloads and CSP in browsers.

Follow [storage-r2.md](./storage-r2.md) for storage permissions and release checks.

## 5. Email and other integrations

- Verify `puhukoc.com` in Postmark with the exact DKIM TXT and Return-Path CNAME records.
  Keep CNAME DNS-only and one coherent SPF/DMARC policy compatible with existing mail routing.
  Sender verification does not create an inbox. Decide how replies to `noreply` are handled.
- Configure Google OAuth's three variables together if enabled; register the exact callback
  and check authorized domains/consent-screen status before public signup.
- Payments remain disabled; SMS and sponsorship stay behind existing acceptance gates. Do not
  select fake providers in production. AI uses real provider wiring with central feature flags
  and the existing monthly cost cap; configuration does not grant unconditional Free AI.
- Supply API Sentry DSN and verify scrubbed events, readiness alerts and retention. API Sentry
  tags incidents by `APP_ENV`. The web DSN slot alone does not initialize a browser SDK;
  browser reporting remains a separate launch item.
- Configure analytics/ads only after provider and consent review. Domain ownership is not
  Google approval; keep existing ad rollout gates and publish only a verified real seller ID.

## 6. Verification, release and rollback

1. Run `pnpm check:deployment`: production domains/CORS, exact dependency builds, port-aware
   starts, migration configuration, cron references and Turbo cache inputs must pass. This
   check does not certify credentials, provider permissions, live DNS or the full Render schema.
2. Require full CI on the exact reviewed commit: lint, typecheck, builds, tests, browser checks,
   dependency audit and secret scan. Keep the three approved historical false-positive
   fingerprints only; do not disable or broaden scanning. Protect `master` with review/CI gates.
3. Use an optional temporary isolated rehearsal when useful. Before authorizing production,
   record provider evidence, restore/rollback procedure and budget. Before public traffic,
   verify signup, verification/reset, login/refresh/logout, admin Access, uploads/downloads,
   SSE, cron delivery, production canonical/sitemap, admin noindex and origin denials.
4. An authorized release deploys the exact reviewed commit to API, web/admin, then cron.
   Monitor readiness/errors/authentication, DB/pool use, queue backlog and AI spend. Keep
   risky feature flags off until their acceptance evidence is recorded.
5. Disable relevant flags or roll back apps to a known-good commit, then recheck critical flows.
   Code rollback does not revert migrations. Use a reviewed forward fix or tested Neon recovery
   for schema/data recovery; keep migrations backward-compatible.

Provider references: [Render Blueprint](https://render.com/docs/blueprint-spec),
[deployments](https://render.com/docs/deploys),
[Cloudflare DNS for Render](https://render.com/docs/configure-cloudflare-dns),
[Universal SSL coverage](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/),
[Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/),
[Postmark verification](https://postmarkapp.com/support/article/how-do-i-verify-a-domain).
