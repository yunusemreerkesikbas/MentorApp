# Stage and production deployment

> Domain ownership: `puhukoc.com`, confirmed by the product owner. Staging Neon schema/runtime
> safety and Render Hobby billing were verified on 2026-10-13.
> DNS, certificates and deployed application services remain unverified. Source preparation
> is complete only when its local checks pass; a live release still requires the gates below.

## Domains and environment separation

| Surface | Production | Staging | Render service (production / stage) |
|---|---|---|---|
| Web | `https://puhukoc.com` | `https://s1.puhukoc.com` | `mentor-web` / `mentor-s1-web` |
| Single API | `https://api.puhukoc.com/v1` | `https://s1-api.puhukoc.com/v1` | `mentor-api` / `mentor-s1-api` |
| Admin | `https://admin.puhukoc.com` | `https://s1-admin.puhukoc.com` | `mentor-admin` / `mentor-s1-admin` |
| Public R2 media | `https://media.puhukoc.com` | `https://s1-media.puhukoc.com` | R2 custom domains, not Render |

The minimum-cost stage omits the admin service and its DNS record. `s1-admin.puhukoc.com` stays
reserved in API configuration; it does not consume a Render custom domain. Keep stage admin API
paths protected by Access even while the admin UI is absent.

Use first-level hostnames: Cloudflare Universal SSL covers the apex and one subdomain level.
`api.s1.puhukoc.com` would require additional certificate coverage.
See [Cloudflare SSL coverage](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/).
Render manages `www.puhukoc.com` as a redirect to the apex when the apex is added as a custom domain.
Keep the browser, API and admin on the same primary domain for the existing host-only,
Secure, HttpOnly, SameSite=Lax cookies; do not add a shared cookie Domain attribute.

Staging has its own database, runtime/migration roles, JWT/edge/cron/rate-limit secrets,
R2 token and buckets, Turnstile widget, Postmark server token, VAPID key pair and OAuth client.
Do not use production customer data in staging. Prefer a separate Neon project with synthetic
seed data; a schema-only branch is an alternative only when its credentials and retention are
explicitly isolated. Never clone production user data into the public test environment.

## 1. Registrar and Cloudflare DNS

1. Record the registrar, current nameservers, existing DNS records and any working mail setup.
   Enable account MFA and domain renewal. Domain purchase alone does not set up hosting or email.
2. Add `puhukoc.com` to the intended Cloudflare account. Review the imported records, especially
   MX/TXT/CAA, before switching nameservers. Preserve mail routing; do not delete unrelated records.
3. If Cloudflare is not already authoritative, set the registrar nameservers to the exact two
   nameservers assigned by Cloudflare. Handle an existing DNSSEC DS record during the transfer,
   then enable DNSSEC using Cloudflare's new values after activation.
4. Confirm Cloudflare marks the zone active. Create the Render services and custom domains before
   inserting their DNS targets. Use the actual generated `onrender.com` host from each service's
   dashboard; the service name is not a reliable way to infer that host.

| DNS name | Type | Target | Final proxy state |
|---|---|---|---|
| `@`, `www` | CNAME | Actual `mentor-web` Render host | Proxied |
| `api` | CNAME | Actual `mentor-api` Render host | Proxied |
| `admin` | CNAME | Actual `mentor-admin` Render host | Proxied |
| `s1` | CNAME | Actual `mentor-s1-web` Render host | Proxied |
| `s1-api` | CNAME | Actual `mentor-s1-api` Render host | Proxied |
| `s1-admin` | CNAME | Actual `mentor-s1-admin` Render host | Proxied |
| `media`, `s1-media` | Managed by R2 | Matching public bucket custom domain | R2 managed |
| Provider email records | TXT/CNAME/MX | Exact values from the email providers | DNS only |

For Render-bound names, begin with **DNS only**, verify domain ownership and certificate issuance
in Render, then enable **Proxied**. Remove conflicting A/AAAA records only on those same names.
Once Render certificates are valid, use Cloudflare **Full (strict)** and HTTPS redirects.
Do not use Flexible SSL. Check restrictive CAA records if certificate issuance fails.
Sources: [Render Cloudflare DNS](https://render.com/docs/configure-cloudflare-dns),
[Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).

The API rejects normal requests while DNS is unproxied, by design. Its health endpoints remain
available for bootstrap; do not weaken the edge-origin check to get a first deployment working.

## 2. Render and database setup

1. Connect the repository with a Render account that can read it. Confirm the current release
   branch is `master`. The repo guide mentions `main`, but this checkout and existing CI use
   `master`; changing the default/protected branch is a separate operation.
2. The selected stage uses `render.staging-low-cost.yaml`: only web/API on Free, no stage admin
   or external cron, manual migration/deploy. Its two domains fit the verified unused Hobby
   allowance. Do not add a payment card or upgrade. Deploy the exact reviewed source commit;
   a feature-branch rehearsal requires selecting that branch instead of eventual `master`.
   The alternative `render.staging.yaml` and production `render.yaml` provision paid resources;
   do not apply them under the current zero-extra-cost staging authorization.
3. Supply every `sync: false` field separately per environment. Blueprint-generated secrets are
   independent per service. `sync: false` values must be maintained in the dashboard after setup;
   adding an optional integration later can also require adding its env variables manually.
4. Create a Neon EU database and apply the existing restricted runtime-role runbook. Set
   `DATABASE_URL` to its pooled runtime URL and `DATABASE_MIGRATION_URL` to its direct owner URL.
   The runtime role must not own objects, bypass RLS or inherit privileged roles.
5. Enable pgvector and execute the existing migration chain through the API pre-deploy command
   on the paid profiles, or manually with the direct migration URL before deploying the Free stage.
   Take a restore point before production migrations. Do not automatically seed demo accounts or
   write to production from local fixtures. Forward-only migrations remain the rule.
6. Verify runtime-role startup validation and `/v1/health/ready`. Web/admin production start scripts
   bind to `0.0.0.0` and consume Render's `PORT`; local `start` scripts retain ports 3000/3002.
7. The Node runtime is pinned to 22.22.0. Frozen pnpm installs explicitly include build tooling;
   Turbo builds workspace dependencies before each app. A clean checkout must not depend on
   locally prebuilt `packages/*/dist` folders.

Both deployments use `NODE_ENV=production`, so staging retains HTTPS, real-provider, origin and
Access checks. API/web/admin use `APP_ENV=staging` or `production` as appropriate. Stage web sends
`X-Robots-Tag: noindex, nofollow, noarchive`, disallows crawlers and returns an empty sitemap.
The admin sends noindex in both environments. Noindex is not access control: use synthetic data
and retain authentication. A private stage Access policy is optional and must account for API
fetches from the Next server and automated smoke tests.

The Blueprints disable the `onrender.com` subdomain for **web and admin** to prevent Access bypass
and duplicate web URLs. Their custom domains must be configured for browser smoke tests; verify
the direct Render names return 404 after provisioning. The API's Render hostname remains available:
authenticated cron jobs use it, and ordinary direct traffic is denied by the origin middleware.
Verify those denials with missing and forged headers.

Sources: [Blueprint fields](https://render.com/docs/blueprint-spec),
[custom domains](https://render.com/docs/custom-domains).

## 3. Environment values and Cloudflare security

The Blueprints contain public URLs; keep secrets out of Git and frontend variables.

| API setting | Production | Staging |
|---|---|---|
| `APP_URL` | `https://puhukoc.com` | `https://s1.puhukoc.com` |
| `ADMIN_APP_URL` | `https://admin.puhukoc.com` | `https://s1-admin.puhukoc.com` |
| `CORS_ORIGINS` | `https://puhukoc.com,https://admin.puhukoc.com` | `https://s1.puhukoc.com,https://s1-admin.puhukoc.com` |
| `TURNSTILE_EXPECTED_HOSTNAME` | `puhukoc.com` | `s1.puhukoc.com` |
| `R2_PUBLIC_BASE_URL` | `https://media.puhukoc.com` | `https://s1-media.puhukoc.com` |
| Public/private R2 bucket | `puhu-prod-public` / `puhu-prod-private` | `puhu-s1-public` / `puhu-s1-private` |
| `GOOGLE_OAUTH_REDIRECT_URI` (optional) | `https://api.puhukoc.com/v1/auth/google/callback` | `https://s1-api.puhukoc.com/v1/auth/google/callback` |
| `POSTMARK_FROM` (verify before sending) | `noreply@puhukoc.com` | `noreply@puhukoc.com`, separate sandbox server |
| `VAPID_SUBJECT` | `https://puhukoc.com` | `https://s1.puhukoc.com` |

- Create one Request Header Transform Rule per API hostname, **overwriting**
  `x-mentor-origin-secret` with that environment's `EDGE_ORIGIN_SECRET`. Preserve `CF-Connecting-IP`.
  Never expose the secret to the browser, response headers, logs or public documentation.
- Create separate Cloudflare Access applications/audiences for each environment. Within each,
  protect its admin hostname and API `/v1/admin/*` and `/v1/auth/admin/*` paths with the **same
  audience** and an allowlist/MFA policy. Configure `CLOUDFLARE_ACCESS_TEAM_DOMAIN` and
  `CLOUDFLARE_ACCESS_AUD` accordingly. Test admin credentialed CORS preflights without a public
  bypass for actual admin methods; do not gate the whole API with an interactive Access login.
- Create separate Turnstile widgets with the exact web hostnames; supply matching API secret
  and web public keys. The server checks the action per operation; test signup/login/recovery
  and phone-verification actions instead of assuming `signup` covers every flow.
- Apply endpoint-specific rate limits/WAF. Preserve SSE and OAuth callbacks. Bypass edge caching
  for API responses, admin and web HTML/RSC; web responses already prohibit CDN storage for
  nonce/auth safety. Cache public static assets and public R2 objects deliberately.
- Create two EU-jurisdiction bucket pairs and scoped tokens. Attach custom domains only to public
  buckets. Keep private buckets and `r2.dev` access private/disabled. Restrict R2 upload/read CORS
  to each environment's web/admin origins and run the existing `storage:check` verification.
- Set web `WEB_CSP_STORAGE_ORIGINS` to the exact public-media origin plus the EU R2 origins
  actually present in that deployment's signed upload/download URLs. Do not add wildcards or
  paths. Check browser uploads, private downloads and CSP reports before release.

See [security-release-checklist.md](./security-release-checklist.md) and
[storage-r2.md](./storage-r2.md) for the binding release checks.

## 4. Email, OAuth, payments and monitoring

- Verify `puhukoc.com` in Postmark. Add the exact generated DKIM TXT and custom Return-Path CNAME
  records; keep the CNAME DNS-only. Publish/maintain one coherent DMARC policy after checking
  the existing mailbox provider and SPF setup. Do not duplicate SPF records or invent DKIM values.
  Start stage with a Postmark sandbox server token so tests cannot mail real users.
  [Postmark domain verification](https://postmarkapp.com/support/article/how-do-i-verify-a-domain).
- Sending-domain verification does not create an inbox. The product owner chose to keep the
  current `info@mentor.com` support/legal contact. Verify that existing inbox is operational before
  public release; migration to `info@puhukoc.com` awaits a separate decision. The proposed
  `noreply@puhukoc.com` sender also needs verification and a decision on incoming replies.
- If Google login is used, configure the three OAuth variables together and register the exact
  callback URLs above in separate Google OAuth clients. Review authorized domains, test users
  and consent-screen status before opening production signup.
- Payments remain `disabled`, SMS remains disabled by default. Do not use fake providers under
  `NODE_ENV=production`. Enabling iyzico requires its existing payment acceptance work and real
  provider evidence. Keep sponsorship off until the SMS OTP acceptance gates pass.
- Supply real AI/vision credentials through the normal account configuration. Keep production
  AI/cost/release flags under the existing central registry and monthly budget cap; setting a
  domain does not grant unconditional free AI or authorize broad feature rollout.
- API Sentry uses `APP_ENV` to separate stage/prod incidents. Set its DSN, alert recipients and
  retention; verify a scrubbed test event and readiness monitoring. Web's
  `NEXT_PUBLIC_SENTRY_DSN` slot alone does **not** initialize a browser SDK in this codebase;
  browser error reporting remains a separate launch item.
- Keep stage GA/Search Console/ads variables unset. Configure production only after provider and
  consent review; publish the real seller ID in `GOOGLE_ADS_PUBLISHER_ID` only once AdSense/GAM
  approval is complete. Domain purchase does not enable ads. Optional Maps/social/store public
  variables from `.env.example` can be added to the appropriate web service when needed.

## 5. Deployment, verification and rollback

1. Run `pnpm check:deployment`. It checks environment/domain isolation, cron references, build
   dependencies, migration setup and Turbo environment inputs; it does not validate credentials,
   live DNS, provider permissions or the entire Render API schema.
2. Run full CI, including audit/secret scan, all app builds, tests and browser checks, on the
   intended commit. Protect `master` with the required CI check and review policy in GitHub.
3. The full stage tracks `master` with `autoDeployTrigger: checksPass`; the selected Free stage
   uses manual deploys after migrations and passing checks. Confirm the latest deployed
   commit and verify the critical flows through Cloudflare: signup, email verification/reset,
   login/refresh/logout, admin Access, uploads/downloads, SSE and scheduled job delivery.
4. On the full profile, confirm all four cron jobs target only the stage API and stage secret.
   On the selected Free profile, the API job runner works while awake; invoke the daily scheduled
   stage routes manually for rehearsal. Existing UTC schedules
   are preserved. Feature flags still control digest/payment work; no new flags are enabled here.
5. Confirm stage robots/noindex/empty sitemap and production canonical URLs. Verify production
   `www` redirect, HTML cache bypass and direct-origin denials. Record browser and provider evidence.
6. Production auto-deploy is **off** on every service. Initial Blueprint provisioning and
   Blueprint configuration sync can still initiate deployments; do not create/sync the production
   Blueprint until release is authorized. For a release, deploy the exact staging-tested commit
   to API first, then web/admin, then cron services as needed. Do not select an untested newer head.
7. Monitor error rates, readiness, authentication, DB/pool usage, queue backlog and AI spend.
   Keep risky feature flags off until their own acceptance evidence is recorded.
8. Roll back application services to the previous known-good commit and recheck readiness and
   critical flows. Disable relevant feature flags first if sufficient. A code rollback does not
   revert migrations: keep schema changes backward-compatible, and use a reviewed forward fix
   or tested Neon recovery procedure when data/schema recovery is necessary.

Provider procedure: [Render deployments](https://render.com/docs/deploys).
Record full CI and real-stage evidence before any release-ready claim.

## Open setup decisions

The owner confirmed Cloudflare DNS and an existing Postmark service, and authorized stage setup.
The selected [minimum-cost profile](./staging-cost-options.md) contains two Free services/two
domains within the verified Hobby allowance. Neon Free now has a restricted runtime role,
126 migrations and AI-off/console-email flags. Live stage setup is authorized with no paid
upgrades; provider security and live smoke verification remain required.

- Cloudflare account access and actual authoritative zone/DNS records.
- Render GitHub App permission for only the `MentorApp` repository; actual free deploy status.
- Existing support inbox reachability, sender/reply policy and eventual support-address migration.
- Stage provider credentials and security configuration, then deployed browser smoke evidence.

Do not share secrets in chat. Enter them in the environment-specific provider secret settings.
