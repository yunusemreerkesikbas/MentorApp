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
| **Resend** | Transactional email, Free first | `RESEND_API_KEY`, `RESEND_FROM` | MVP |
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

#### Current rollout: SMS off, coaching and carded trials available (2026-10-15)

| Control | Default/current rollout target | Purpose |
| --- | --- | --- |
| `SMS_PROVIDER` | `disabled` | Environment transport kill switch; no Netgsm request |
| `identity.phone.enabled` | `false` | Registry switch for OTP requests and confirmations |
| `mentorship.phone_verification_required` | `false` | Require coach phone ownership for invitations, protected access and notifications |
| `payments.trial.phone_verification_required` | `false` | Require phone ownership for new carded-trial claims |
| `mentorship.seats.sponsorship_enabled` | `false` | Keep sponsored Premium off; granting it always requires actual verified contacts |

The two requirement switches are independent of transport. Enabling SMS does not enable either
requirement; losing SMS availability does not bypass one that is already on. Registry changes use
the existing admin config screen, validation and audit. Actual ownership is never manufactured.
The registry cache currently assumes one API instance; coordinate restarts for multiple instances.

Deploy migration `0126_optional_trial_phone` before the API, then deploy the web. Keep all five
controls at the values above for the current rollout. Existing overrides must be checked explicitly;
changing a catalog default does not clear an override. No live values were changed by this work.
For rollback, switch a requirement off rather than reverting the nullable schema after account-only
claims exist. In-flight trials complete using their stored requirement, even after a flag change.
Existing phone-bound claims still need the original fingerprint secret and verification checks.

After provider acceptance, configure transport, enable phone availability, verify it, then enable
mentorship and trial requirements separately. Requiring phones can lock existing unverified coaches;
communicate that rollout before enabling it. Sponsorship remains a separately approved rollout.
Account-only trials preserve account limits but cannot deduplicate different accounts by phone.



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
  retain null phone fields. Current coach/trial requirements are configured independently as above.
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

### Resend (email)
- Use Free first (3,000 emails/month, 100/day). Keep **Transactional Overages** disabled;
  exhaustion stops sending instead of authorizing paid fallback. Check the actual team settings.
- Verify `puhukoc.com` with Resend's exact SPF/DKIM records and a coherent DMARC policy;
  use a sending-only, domain-scoped `RESEND_API_KEY` and verified `RESEND_FROM=noreply@puhukoc.com`.
- Existing `EmailPort` templates stay in backend TR/EN catalogs. Production requires both values;
  local/staging console delivery remains dev-only. Requests time out after ten seconds and
  failures enter existing queue retries without logging raw provider bodies or auth links.
- Disable domain open/click tracking. Receiving support mail is separate: Cloudflare Email
  Routing forwards `destek@puhukoc.com` to the owner-selected Gmail inbox. Verify actual receipt.
- Account/login, domain acceptance, live quota controls and inbox delivery are outstanding.
  Keep the provider/foreign-transfer disclosure current. No SDK or new public API is needed.
- References: [pricing/overages](https://resend.com/pricing),
  [domain verification](https://resend.com/docs/dashboard/domains/introduction),
  [send API](https://resend.com/docs/api-reference/emails/send-email).

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
- Existing inventory setup/readiness: follow the [account, site, ads.txt and pilot runbook](../qa/2026-10-26-ads-launch-readiness.md).
  Existing admin `/config` embeds a SUPER_ADMIN read-only summary for all eight DISPLAY placements;
  it checks current-process configuration only, never provider/site/privacy approval. Refresh or
  save an existing setting to reread it. Legacy unit env values use shared Zod Google-path
  validation; official sample DISPLAY network paths are rejected in production independently
  of the local preview flag. Public/settings TR/EN disclosure covers the gated inventory.
- Ad unit paths: `GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT` and
  `GAM_DASHBOARD_REWARDED_COIN_AD_UNIT`. Test and production units must be separate.
- Local manual preview: set `ADS_LOCAL_TEST_ENABLED=true` in `apps/api/.env`, restart the API,
  and open `http://localhost:3000/blog/kpss-basvuru-sureci` anonymously or on Free. Scroll to
  the article end. This uses the real local content/eligibility endpoints and Google's actual
  SDK, without browser API mocks or changing DB flags. Only development with an HTTP loopback
  `APP_URL` is allowed; staging/production fail startup if this flag is set. Missing local country
  is treated as TR for the forced official test unit only. Premium/STAFF and content/age checks
  still apply. Ad blockers may hide the sample. Set the flag to false and restart to leave preview.
  Test ads do not demonstrate production approval, fill or revenue.
- Official DISPLAY sample `/6355419/Travel/Europe/France/Paris` is for local development;
  runtime rejects it whenever `NODE_ENV` or `APP_ENV` is production, including production-built
  staging. Production-built staging smoke therefore needs owned Google inventory with a reviewed
  test creative/demand setup after external gates, or mocked browser fixtures. The separate
  rewarded sample is `/22639388115/rewarded_web_example`; production rewarded remains closed
  without server verification and rollout stays `%0`. A staging build with `NODE_ENV=production`
  also fails that existing rewarded verification gate; never loosen it for a smoke screenshot.
  The article catalog includes `300x250`, `320x100` and `728x90`; the reading column filters out
  widths it cannot fit. In the 2026-10-14 live SDK rehearsal the official sample returned no-fill
  for `320x100` but filled `300x250`. Keep a supported rectangle in the test request; never infer
  broken integration from a sample unit that has no creative for the requested size. Reserve 250px
  before loading. CSP allows the observed `ep1.adtrafficquality.google` configuration/pixel in
  `connect-src`/`img-src` and `ep2.adtrafficquality.google` in `frame-src`; script trust remains
  nonce-based. See [live Google smoke evidence](../qa/2026-10-14-google-display-smoke.md).
- Create/select AdSense with the owner's chosen Google account, add the owned live domain, and
  obtain site approval. Create Ad Manager and connect **actual Google demand** to the article ad
  unit; an empty Ad Manager network does not earn revenue. Disable AdSense Auto ads to preserve
  the single article slot. The domain `puhukoc.com` is now owned (owner-confirmed, 2026-10-12).
  Ownership does not prove DNS, hosting or Google approval; follow [deployment.md](./deployment.md).
- Set web server `GOOGLE_ADS_PUBLISHER_ID` to the real `pub-` + 16-digit seller ID from AdSense.
  `/ads.txt` returns the Google DIRECT entry without locale redirection; blank configuration
  returns 404, malformed configuration fails visibly. Never publish a placeholder ID. Verify
  `https://puhukoc.com/ads.txt` after domain/DNS/hosting setup and Google's Authorized/Ready status.
  Match the seller ID to the connected demand account. Keep production ad flags off meanwhile.
- In **Admin → Global settings → Network settings**, keep Programmatic limited ads off until
  the actual data processing, lawful basis for automatic serving in Turkey and updated
  privacy/foreign-transfer copy have passed review. This source change is not a consent signal
  or legal approval. If the configured processing requires consent, do not activate automatic
  programmatic delivery without a reviewed alternative. After review, enable contextual Google
  demand for this pilot: limited ads disables
  personalization but programmatic mode may use IVT-only cookies and local storage. Block adult,
  gambling, dating, alcohol/tobacco, violent and other age-inappropriate categories; apply child
  treatment to LGS inventory.
- The web automatically loads Google's limited-ads GPT URL after backend eligibility, when the
  article end approaches the viewport. There is no visitor advertising accept/reject switch.
  Optional analytics is still opt-in; rejecting it does not disable ads or grant ad-free access.
  The retired advertising choice is not read, rewritten or promoted to consent. Account changes
  and subscription reads recheck eligibility; Premium/STAFF remove existing slots.
  `ads.display.allowed_countries` defaults to `TR` (uppercase comma-separated country codes);
  empty allowlist or unknown `cf-ipcountry` denies display. Ensure Cloudflare overwrites country
  headers and the API origin cannot bypass that trusted edge. EEA/UK/Switzerland stays
  off until a compatible CMP and legal review exist. Update privacy/cookie/foreign-transfer copy
  before rollout; limited ads is not synonymous with “no data processing.”
- Rehearsal: use the official test article inventory above in an isolated environment; check
  mobile/desktop, absent/rejected/accepted legacy advertising values, optional analytics choices,
  automatic display, login/account switch, Free→Premium,
  no-fill and ad-blocking. Local browser suites stub GPT and do not prove a real Google fill.
- Production gate: require account/site approval, correct ads.txt, separate production inventory,
  connected demand, policy/category and privacy review, full CI, and a restricted production smoke
  with a real impression visible in Ad Manager before wider exposure. Only enable `ads.enabled`,
  `ads.display.enabled`, `ads.placement.knowledge_article_end.enabled`; keep rewarded flags/rollout
  off (web has no server verification). Roll back by disabling `ads.enabled`.
- Overview inventory (2026-10-25): admin `/config` adds independent
  `ads.placement.{notebooks_overview,vision_overview}.enabled` switches (default false) and
  `.ad_unit_path` strings. Blog `.ad_unit_path` overrides its environment unit; empty preserves
  the existing environment fallback. Overview empty paths disable delivery. Only inventory paths
  are accepted, never scripts/HTML; saving is validated and audited. Changes apply on the next
  placement-policy request, with no redeployment or active-page polling.
- Reviewed public QA (2026-10-25): migrate `0128_ad_question_reviews` through the normal deployment
  path. In Community admin, inspect the public question and every answer before approving its
  revision; approve/revoke are audited. Public/authenticated `forum.question.end` requests require
  UUID `questionId` and rendered SHA-256 `contentRevision`. Current snapshot, rendered revision and
  approval must match. Unknown exam context or unavailable/unapproved QA cannot request Google,
  including local sample mode. The flag defaults off and the unit has no env fallback. Complete
  Google inventory/content/privacy review and update public disclosures before activation.
  Monitor the existing moderation report queue; manual approval is not automated policy detection.
  Changes apply on the next eligibility request; open snapshots have no live moderation push.
  No user-level impression tracking added. See [Google's UGC guidance](https://support.google.com/adsense/answer/1355699?hl=en)
  and [the implementation design](../plans/2026-10-25-reviewed-question-ads.md).
- Existing community QA (2026-10-26): migrate `0131_community_question_ad_review`, adding nullable
  approval metadata to the existing table. In the same admin review section, first approve public
  text, then preview and approve the separate community view, including identities/media and its
  selected waiting-question rail. Only an exactly matching view qualifies; viewer-specific rails
  may need another review. Configure `ads.placement.community_question_end.ad_unit_path`; empty
  disables it, with no env fallback. Leave `.enabled=false` until authenticated-page inventory,
  safe crawling, privacy and disclosures are verified. Never supply real student accounts or
  private data to Google. The flag also gates page-context assembly in local sample mode; preview
  is available while off. Public reapproval/revoke clears community approval; community-only revoke
  preserves public approval. Writing, files, emoji and dialogs remove pending/filled ads for the
  visit, with no auto-resume. There is no new page, live polling or per-user impression tracking.
- Discovery home preparation (2026-10-26): no migration. Admin `/config` adds
  `ads.placement.community_overview.{enabled,review_approved,ad_unit_path}`. Both flags default
  false; empty unit disables delivery, with no env fallback. Keep them off pending Google
  inventory/value, moderation, safe authenticated crawling, privacy and disclosure review. The
  screen is largely navigation, so eligibility must be established rather than assumed. Local
  sample mode does not bypass these gates or public-context proof. Never provide real student
  credentials/private data to Google. Personalized history, buddy relations, nonpublic rooms,
  failed/incomplete reads and stale rendered sidebars prevent delivery without hiding content.
  The sole slot is rail-end on desktop and the last content on mobile; personal interactions
  cancel it for the visit. Verify using `test:e2e:community-ads`; no real Google traffic is used.
- Reviewed announcement detail (2026-10-26): migrate `0132_ad_review_content_type` through the
  normal deployment path before starting the new API. It adds a QUESTION-default discriminator
  to the existing approval table; ANNOUNCEMENT writes/revokes stay separate. In existing admin
  Forum → Duyuru reklam incelemesi, inspect the initial thread/comments/identities/images/tags/
  sidebar, then approve its revision. Configure `ads.placement.community_announcement_end.ad_unit_path`;
  empty disables delivery. Keep `.enabled=false` pending Google inventory/value, safe crawling,
  moderation, privacy and disclosures. Never provide real student accounts/private data. There
  is no anonymous announcement inventory; local sample still requires approval and page proof.
  Hidden nested replies are excluded from the initial review; opening another view/composition
  cancels the ad. Sidebar truncation (>100), unsupported media, unknown exam or private context
  fails closed. No automatic refresh or live moderation push. Use `test:e2e:community-ads` for
  synthetic browser verification. Fresh isolated Postgres tests avoid unrelated shared fixtures;
  test inventory is not revenue evidence.
- Public blog index (2026-10-25): configure `ads.placement.knowledge_index.ad_unit_path` in the
  same admin category and leave `.enabled=false` until the index itself passes inventory,
  content-value and privacy review. Empty path disables delivery. The index uses
  `family`/`category`/`page` on existing placement endpoints to verify published descriptions on
  the actual selected page, including a matching featured article only on page one. No unrelated
  article URL or legacy exam query proves the listing context. The UI shares one server request
  result for its list/ad boundary, mounts no ad for a failed/empty list and uses a single
  non-sticky responsive slot. Revise the currently article-end-specific public TR/EN disclosures
  before production activation. After approval, use the existing 14-day real-impression pilot and
  per-placement rollback switch; stubbed or sample inventory proves no revenue.
- Keep both overview switches off until Google has accepted the actual login-protected content,
  crawler accessibility and privacy treatment. These are tool/personal-library screens, so blog
  approval alone does not establish their inventory eligibility. As part of that review, revise
  the currently blog-specific public privacy/KVKK/terms and TR/EN advertising disclosures before
  activating overview inventory; this development does not certify or publish that legal review.
  Use synthetic data in any
  isolated crawler rehearsal; never provide real student credentials, weaken RLS/authentication,
  expose private notes/goals, or spoof a public article URL as the overview's context. If safe
  crawler access cannot be demonstrated with the existing auth, leave the placement off and plan
  that integration separately. Do not build a crawler bypass as part of the ad rollout.
- Locally, `ADS_LOCAL_TEST_ENABLED=true` previews all display placements with Google's
  official sample unit; real configured inventory cannot replace it. Premium/STAFF exclusion,
  verified profile for overviews, strict audience treatment and explicit country restrictions
  remain. Production/staging/public-origin use is rejected at startup. Previews earn no revenue.
- After each overview passes the existing production gates, enable it independently and run the
  same 14-day observation from its first real impression. Reuse Google reporting rather than
  adding passive user-level logs. Roll back one placement with its switch, or all via `ads.enabled`.
  Future direct sponsor campaigns can use the same units via Google Ad Manager Sponsorship or
  Standard line items; no second provider or sponsor database is required for this initial model.
- Run a 14-day exploratory pilot from the first real impression. Record daily Ad Manager fill,
  impressions, viewability, revenue, eCPM, and serving restriction=Limited ads. Record article read
  completion and Web Vitals only among analytics-consenting visitors; these are a biased subset.
  Use the reporting timezone consistently, allow for reporting delay, and avoid revenue sufficiency
  conclusions at low traffic. Technical success is real eligible fill/revenue and zero Google
  requests for excluded visitors. No per-user ad reporting is stored in Mentor.
- Render Cron (or an operator) calls `POST /v1/internal/cron/expire-ad-reward-sessions` with
  `X-Cron-Secret` every five minutes. The endpoint runs a bounded, idempotent and multi-instance-safe
  sweep; AdsModule does not create a second in-process scheduler.

### Render (hosting)
- Native Node services, single region **Frankfurt/EU**. Production uses `render.yaml` with manual
  deployments and separately supplied credentials. Follow [deployment.md](./deployment.md) for
  domains, provisioning and release gates. Permanent staging is deferred; retained resources
  and optional rehearsals are recorded in [deferred-staging.md](./deferred-staging.md).
- Cost shield (§8): Neon max-CU + budget alert + Cloudflare edge rate-limit.

> ⚠️ **Phase 0 prerequisites (pre-launch, §7):** company setup, iyzico application, legal web pages
> (distance-sales/privacy/refund/KVKK), accountant/legal sign-off.
