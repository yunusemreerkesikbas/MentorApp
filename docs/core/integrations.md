# Integrations — Connection Guide

> Locked providers per roadmap §7/§8. This document explains the **account + environment** wiring for
> each service. No real secret is kept here → values go into `.env` (template: [`.env.example`](../.env.example)).

| Service | Role | Env key(s) | Phase |
|---|---|---|---|
| **Neon** | Postgres + pgvector (DB) | `DATABASE_URL` | MVP |
| **Own JWT** | Auth (access/refresh) | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | MVP |
| **Netgsm** | Turkey mobile verification SMS, application-owned OTP | `SMS_PROVIDER`, `NETGSM_*`, `PHONE_OTP_SECRET`, `PHONE_FINGERPRINT_SECRET` | Coach/trial rollout |
| **OpenAI** | AI text, embeddings + vision classification | `OPENAI_API_KEY`, `OPENAI_*_MODEL`, `AI_PROVIDER`, `VISION_PROVIDER` | MVP |
| **Gemini** | AI vision (photo→categorize) | `GEMINI_API_KEY`, `GEMINI_MODEL`, `VISION_PROVIDER` | MVP (premium) |
| **iyzico** | Subscription/payments | `IYZICO_*` | MVP |
| **Cloudflare R2** | Object storage — **two buckets**: public (avatars, forum ekleri, makale görselleri) + private (`mock-exams/`, `notebook/`, `vision-board/`). Kurulum: [`storage-r2.md`](./storage-r2.md) | `STORAGE_PROVIDER`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BASE_URL`, `R2_JURISDICTION` | MVP |
| **Cloudflare Turnstile** | Bot/Sybil | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | MVP |
| **Postmark** | Transactional email | `POSTMARK_TOKEN` | MVP |
| **Sentry** | Error monitoring | `SENTRY_DSN` | MVP |
| **Google Analytics / Search Console** | Consent-gated article analytics + ownership verification | `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | MVP |
| **Google Maps Platform** | Lazy photorealistic 3D campus tour | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | YKS beta |
| **Render** | Hosting (PaaS) | — (dashboard) | MVP |
| **Redis** | Presence/leaderboard/cache/queue | (later) | **Phase 2** |

## Setup steps (summary)

### Neon (DB)
1. [neon.tech](https://neon.tech) → project (region: **EU / eu-central**, KVKK + adjacent to Neon §8).
2. Enable the `pgvector` extension (SQL: `create extension if not exists vector;`).
3. Pooled connection string → `DATABASE_URL`. Use branching DX for preview/dev branches.
4. `pnpm --filter @mentor/api db:generate && db:migrate`.

### OpenAI / Gemini (AI)
- OpenAI key → `OPENAI_API_KEY` (no-training API; KVKK transfer disclosure). Text provider finalized via
  Turkish eval (§8). Production uses `AI_PROVIDER=openai`; `AI_PROVIDER=fake` fails boot. To pause AI,
  keep the real provider configured and disable the runtime `ai.enabled` flag.
- OpenAI live contract check: `pnpm --filter @mentor/api test:live:openai`. It reads `apps/api/.env`,
  makes four low-cost real calls (chat, stream, embedding, vision), and is never part of `pnpm test`.
- `OPENAI_EMBED_MODEL` must return 1536 finite dimensions. Changing `AI_PROVIDER`/embedding model
  requires one `POST /v1/admin/ai/reembed` run so stored and query vectors stay compatible.
- Google AI Studio key → `GEMINI_API_KEY` (vision, rate-limit + premium). Photo categorize:
  `VISION_PROVIDER=gemini` + `GEMINI_MODEL` (default `gemini-2.0-flash`). Dev/test: `VISION_PROVIDER=fake`.
- Uploads: `STORAGE_PROVIDER=r2` + `R2_*` in prod; every client PUT uses the short-lived
  `/v1/storage/uploads/:ticket` capability. The legacy direct fake-storage route is removed.

### iyzico (payments)
1. **Company required** (at least sole proprietorship) + documents + legal web pages → application (§7, Phase 0).
2. Sandbox credentials → `IYZICO_*` (`IYZICO_BASE_URL=sandbox`).
3. Webhook must be **idempotent** (no double coin/subscription §8). Card data at iyzico (PCI not ours).

### Netgsm (phone verification)

The implementation is complete enough for offline acceptance; carrier delivery is a separate
release gate. Follow this checklist in order. Never put credentials, identity documents,
raw phones or codes in Git, screenshots, CI artifacts, logs, Sentry, analytics, jobs or LLM input.

#### 1. Finish provider onboarding

- [ ] Request the sender under Online Applications / Sender Name Application. A preliminary
  application is not approval. For a new header, upload the required documents in Netgsm only,
  then send the generated form from your own send-capable KEP account to the recipient shown
  in the portal. Wait for approval and confirm the exact header appears among assigned senders.
  Existing preapproved names follow the portal's separate confirmation flow.
- [ ] Sender must relate to the subscriber/business and contain 3-11 characters. A temporary
  name still requires approval; later request another approved header and update the env value.
- [ ] Confirm the API subuser is active, API access is approved and SMS Hizmeti is authorized.
  Grant only required service access. Do not assume grayed granular UI checkboxes imply a
  signature problem. Use the API subuser password, never the main portal password.
- [ ] Confirm an active OTP SMS package/campaign and remaining OTP units. Ordinary SMS credits
  do not replace OTP units. Check expiry before the pilot; no automatic purchase is performed.
- Netgsm explicitly exempts API SMS sending from e-signature use. This concerns runtime requests;
  it does not remove the separate KEP/form requirements during sender onboarding.

#### 2. Restrict the actual API server's network access

- [ ] Render: open the NestJS service, Connect / Outbound, and record every current egress range
  for that service. Web/static-site addresses and inbound DNS addresses are not API egress IPs.
- [ ] Configure Netgsm API IP Access Management for these verified ranges. Render may use any IP
  in a range and regional ranges are shared, so credentials remain necessary. Confirm Netgsm's
  supported range format before entering it; do not assume CIDR support or allow only one sampled IP.
- [ ] If Netgsm cannot represent all required ranges, resolve with provider support or separately
  approved dedicated outbound IPs before rollout. Do not remove the restriction as a fallback.
- [ ] Pilot from the isolated deployment's own egress. Review restrictions after a region/service
  change; do not broadly allow developer or CI addresses just to make tests pass.

#### 3. Prepare secrets and Turnstile while production stays off

| Setting | Required value |
| --- | --- |
| SMS_PROVIDER | disabled during preparation; netgsm only in the isolated live pilot initially |
| NETGSM_USERCODE | Subscriber number used as the Basic Auth username |
| NETGSM_API_PASSWORD | Active API subuser password |
| NETGSM_MSGHEADER | Exact approved 3-11-character sender; approval cannot be inferred from length |
| PHONE_OTP_SECRET | Independent cryptographically random secret, at least 32 characters |
| PHONE_FINGERPRINT_SECRET | A different random secret, at least 32 characters; stable through retention |

- [ ] Generate each application secret independently in the approved secret-management workflow.
  Enter secrets directly in server configuration, not chat, command arguments or documentation.
  Missing credentials/secrets or invalid sender length reject Netgsm-enabled startup.
- [ ] Configure the real Turnstile keys and allowed web hostname for the target deployment.
  Every send verifies action phone-verification. Test stubs must never become a production bypass.
- [ ] Confirm identity.phone.enabled=false and mentorship.seats.sponsorship_enabled=false in
  production. Env controls transport; registry flags control availability and sponsored rollout.
- [ ] Preserve PHONE_FINGERPRINT_SECRET through the 12-calendar-month trial retention window.
  Blind rotation would reset phone-based matching and number-send accounting. Replacing the key
  requires a separately designed migration, not a routine config update.

#### 4. Verify schema and the application-owned OTP contract

- [ ] Apply the full migration journal through the normal deployment process using the migration
  role/URL. Do not execute just the phone SQL files manually or edit applied migrations.
  0120 creates phone/challenge/trial tables and indexes; 0121 forces SERVICE-only RLS;
  0122 persists resumable checkout data; 0123 adds the account-erasure fence. Existing users
  retain null phone fields; there is no legacy-coach grace period or verification bypass.
- [ ] Verify a fresh test DB and an existing test DB upgraded from immediately before 0120,
  including a preexisting user and subscription. Reapplying the journal must be idempotent.
- Native HTTPS POST uses /sms/rest/v2/otp with Basic Auth and flat msgheader/msg/no JSON.
  The fixed ASCII message remains one segment (<=155 characters), with a ten-digit Turkey
  mobile destination, no scheduling and no automatic retry. Long jobid values remain strings.
- Code validity defaults to five minutes; provider transport window is three minutes;
  HTTP timeout defaults to five seconds. These are different clocks. API acceptance never
  proves delivery or ownership. Only successful application code confirmation verifies a phone.
- Central defaults: 60-second resend, five wrong codes/challenge, 20 wrong codes/account/rolling
  24h, ten sends/account and target/rolling 24h, 100 global sends/rolling 24h, 1,000/UTC calendar
  month, and fresh login within ten minutes for number changes. Refresh does not count.
  Attempted sends consume quota even on rejection; account/session switching does not reset it.
- The daily reminder cron purges expired challenges, abuse counters older than 32 days and
  consumed trial fingerprints after 12 calendar months. Unknown payment claims never expire
  automatically; reconcile with provider evidence before releasing them.

#### 5. Run the separate carrier pilot and enable deliberately

- [ ] After sender/network/package setup, use an isolated deployment and test DB with real
  Netgsm transport and identity.phone.enabled=true; keep sponsorship disabled. Exercise the
  normal authenticated UI/API with real Turnstile, not a direct send or fixed-code shortcut.
- [ ] Obtain consented Turkcell, Vodafone and Turk Telekom test numbers. Record only operator,
  elapsed delivery time and verification outcome, not phones, codes, user IDs or provider bodies.
  Each operator must successfully receive and confirm a code before initial acceptance.
  A three-number pilot is a smoke check, not statistical proof of reliability.
- [ ] Check resend invalidation, manual recovery after UNKNOWN, fresh-login number change and
  no premature coach/trial/sponsorship entitlement. Unsafe or failed checks block production.
- [ ] Publish the verification purpose and twelve-month trial-retention notice; confirm the
  provider's retention/support terms. Phone verification is not marketing consent.
- [ ] After full CI and pilot acceptance, configure production transport then enable phone
  verification. Enable sponsorship separately only after its eligibility/budget checks pass.
  Real carded trials also require the completed iyzico adapter and separate payment acceptance.

#### 6. Troubleshoot and stop safely

| Outcome | Operator check | Application behavior |
| --- | --- | --- |
| 20 | Fixed message text and <=155-character ASCII length | FAILED; phone remains unverified |
| 30 | Subscriber number, API subuser password/status, API access and actual egress allowlist | FAILED; no automatic retry |
| 40-41 | Exact approved sender assigned to this account | FAILED; never use an unapproved fallback |
| 50-52 | Turkey mobile format; no fixed-line or international destination | FAILED |
| 60 | Active OTP package/campaign and remaining units | FAILED; ordinary SMS balance is insufficient |
| 70 | Request contract and required fields | FAILED |
| 100, timeout, non-2xx, malformed or unknown reply | Provider/transport state is uncertain | UNKNOWN; no automatic retry |
| 00 plus a nonempty string jobid | Request accepted, not delivery confirmed | SENT; ownership still needs code confirmation |

This table is a private operator guide; do not forward raw provider bodies or exception text to
clients or monitoring. UNKNOWN may already have sent: leave its challenge confirmable until
expiry while verification is available; user-initiated resend obeys cooldown and invalidates
its predecessor. Do not retry a timed-out HTTP call or treat it as a payment-claim cancellation.

- Emergency stop: set identity.phone.enabled=false. **Existing behavior blocks both new sends
  and pending confirmations with AUTH_PHONE_DISABLED (503).** Verified contacts and retained
  trial history are not deleted, and entitlement gates remain in force. To pause only sends
  while allowing pending confirmations, set identity.phone.global_daily_limit=0 instead.
- Keep sponsorship disabled during preparation/pilot. Its flag stops new grants; it is not
  proof that every previously funded entitlement has been revoked. Follow the mentorship
  revocation runbook for any required existing-seat cleanup.
- Restore the previous quota/flag values only after the provider issue is resolved and checks
  pass. Never roll back schema, delete history, rotate fingerprint secrets or weaken contact
  checks to restore availability.

Sources checked 2026-10-05: [OTP API](https://www.netgsm.com.tr/dokuman/#otp-sms),
[API preparation](https://bilgibankasi.netgsm.com.tr/entegrasyonlar/api-entegrasyonu-hazirlik-rehberi),
[sender application](https://bilgibankasi.netgsm.com.tr/sms/toplu-sms/gonderici-adi-talebi),
[API e-signature distinction](https://bilgibankasi.netgsm.com.tr/sms/toplu-sms/sms-gonderimlerinde-e-imza-kullanimi),
[Render egress](https://render.com/docs/outbound-ip-addresses).

### Cloudflare (R2 + Turnstile + Access)
- R2 bucket (zero egress) → `R2_*`. Turnstile site (signup/forum) → secret + public site key.
- The admin panel sits behind **Cloudflare Access** (Zero Trust) (§9) — via the dashboard, not env.

### Postmark (email)
- Server token → `POSTMARK_TOKEN`. Verify SPF/DKIM/DMARC. (US → KVKK transfer disclosure §8.)

### Sentry
- Project (node + nextjs) → `SENTRY_DSN`.

### Google Analytics 4 / Search Console
- Set the public GA4 measurement ID only in deployments where analytics is enabled. The GA script is
  absent until the visitor explicitly accepts; withdrawal disables collection and clears GA cookies.
- Search Console verification is optional and is emitted through Next metadata. GA/consent copy must
  receive product-owner legal/KVKK review before production publication.

### Google Maps Platform (YKS campus beta)
- Enable billing and the Maps JavaScript API for a dedicated browser key. Restrict the key to the
  production/preview HTTP referrers and restrict its API scope; a public browser key without both
  restrictions is not rollout-ready.
- Configure a conservative daily quota plus Cloud Billing budget alerts before enabling
  `coaching.preference_simulation.enabled`. The feature has a 2D fallback, but quota exhaustion must
  still be observable.
- The `maps3d` library loads only on `/hedef/simulasyon`. Never move the loader into the app shell or
  `/hedef`, otherwise every Vision Board visit pays the Google/3D bundle cost.
- Verify Selçuk with the real restricted key on desktop and mobile. Persist
  `PHOTOREALISTIC`; if only terrain is usable, persist `TERRAIN_ONLY` with `HYBRID`. Leave the campus
  row disabled when coverage or any of the five official POI coordinates is unverified.

### Google Ad Manager (web v1)
- Ad unit paths: `GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT` and
  `GAM_DASHBOARD_REWARDED_COIN_AD_UNIT`. Test and production units must be separate.
- Staging smoke uses Google's official test inventory only:
  `GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT=/6355419/Travel/Europe/France/Paris` and
  `GAM_DASHBOARD_REWARDED_COIN_AD_UNIT=/22639388115/rewarded_web_example`. Staging may use rewarded
  rollout `%100`; production stays `%0` until the separate GAM/domain/legal operation is complete.
- Verify the production domain and publish the real network's `ads.txt`; do not ship a placeholder
  publisher id. Keep all `ads.*` flags off until this is complete.
- In **Admin → Global settings → Network settings**, turn off Programmatic limited ads. Block adult,
  gambling, dating, alcohol/tobacco, violent and other age-inappropriate categories; apply child
  treatment to LGS inventory.
- The web loads Google's limited-ads GPT URL only after backend eligibility. EEA/UK/Switzerland stays
  off until a compatible CMP and legal review exist. Update privacy/cookie/foreign-transfer copy
  before rollout; limited ads is not synonymous with “no data processing.”
- Render Cron (or an operator) calls `POST /v1/internal/cron/expire-ad-reward-sessions` with
  `X-Cron-Secret` every five minutes. The endpoint runs a bounded, idempotent and multi-instance-safe
  sweep; AdsModule does not create a second in-process scheduler.

### Render (hosting)
- Dockerized service, single region **Frankfurt/EU**. Env variables go into the Render dashboard.
- Cost shield (§8): Neon max-CU + budget alert + Cloudflare edge rate-limit.

> ⚠️ **Phase 0 prerequisites (pre-launch, §7):** company setup, iyzico application, legal web pages
> (distance-sales/privacy/refund/KVKK), accountant/legal sign-off.
