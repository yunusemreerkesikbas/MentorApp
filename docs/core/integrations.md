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

- Keep `SMS_PROVIDER=disabled`, `identity.phone.enabled=false` and
  `mentorship.seats.sponsorship_enabled=false` until setup and the delivery pilot are complete.
- Obtain an approved sender header and OTP package. Create an API subuser with only the required
  OTP permission, restrict it to the verified Render outbound IP ranges, and use its API password
  rather than the main account password. Configure `NETGSM_USERCODE`, `NETGSM_API_PASSWORD`,
  `NETGSM_MSGHEADER` and two independent random secrets of at least 32 characters.
- `NETGSM_USERCODE` is the Netgsm subscriber number used as the Basic Auth username, not
  the API subuser's display name. `NETGSM_API_PASSWORD` is that subuser's password.
  `NETGSM_MSGHEADER` must be the approved sender, 3-11 characters; invalid lengths fail startup.
- Transport is native HTTPS POST to Netgsm's OTP REST v2 endpoint, with a fixed ASCII template,
  a five-second timeout and no automatic retry. A timeout can mean a delivered SMS; the challenge
  remains confirmable until expiry. Definitive rejection never verifies the phone.
- Netgsm documents a three-minute OTP transport window. This is separate from our five-minute
  code validity and five-second HTTP deadline; neither API acceptance nor elapsed delivery time
  proves phone ownership. The application verifies the user-supplied code before granting rights.
- Every send verifies Turnstile action `phone-verification`. Confirm the hostname matches the web
  deployment and configure the matching site key. Codes, raw phones and credentials must never
  appear in logs, monitoring, jobs or analytics. Local tests inject an in-memory adapter; there
  is no production fixed-code mode.
- Start with central registry limits: 5-minute code, 60-second resend, five guesses per challenge,
  20 failed guesses per account/rolling 24h, ten SMS sends per account and target/rolling 24h,
  100 global sends/rolling 24h and 1,000 per UTC calendar month. Lower a limit to zero to stop the
  corresponding operation. Limits count attempted sends even when transport rejects them.
- The existing daily reminder cron also purges expired phone challenges, OTP abuse counters older
  than 32 days, and consumed trial fingerprints after 12 calendar months. Pending payment outcomes
  have no automatic expiry; reconcile with provider evidence before releasing them.
- Keep `PHONE_FINGERPRINT_SECRET` stable through retention. Changing it without a controlled
  migration would reset phone-based trial matching and number-send accounting. Confirm Netgsm's
  retention/support terms and publish the verification purpose and trial retention notice.
- Pilot only with consented Turkcell, Vodafone and Turk Telekom numbers; record aggregate delivery
  time and completion rates without phone/code data. Enable verification first, then sponsorship
  only after the acceptance checks. The iyzico skeleton still blocks real carded-trial acceptance.

Provider references: [OTP API](https://www.netgsm.com.tr/dokuman/#otp-sms),
[API preparation](https://bilgibankasi.netgsm.com.tr/entegrasyonlar/api-entegrasyonu-hazirlik-rehberi).

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
- Reviewed public QA (2026-10-25): migrate `0127_ad_question_reviews` through the normal deployment
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
- Existing community QA (2026-10-26): migrate `0130_community_question_ad_review`, adding nullable
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
- Reviewed announcement detail (2026-10-26): migrate `0131_ad_review_content_type` through the
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
