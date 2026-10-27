# Ads — Google Ad Manager (Blog, reviewed Forum content and gated app overviews)

## Product boundary

- Existing public-room announcement detail: one `community.announcement.end` slot after the
  initially visible comments. The full publisher snapshot requires editor approval. CHAT, QA,
  private/archived rooms, polls, coach bridges and unsupported media are excluded from this
  placement. Personal interaction/composition/files/dialogs end advertising for the visit.
  Defaults off; no new announcement page or anonymous inventory is added.

- Existing discovery home preparation: one `community.overview` slot at the desktop rail end and
  after all content on mobile. Existing cards remain. Both enable and independent operational
  review flags default off; empty unit disables delivery. This is not a Google-approved inventory
  launch. Personal continuation rows, buddy active/pending states, private/archived rooms and
  unverified or stale rendered sidebars exclude the view.

- Existing authenticated question detail: one `community.question.end` slot after answers,
  using a separate editor-approved publisher snapshot. No new page. Text/draft/file interaction
  or an open dialog removes the ad for that question visit. Defaults off.

- Reviewed public QA pilot: one `forum.question.end` slot after all answers. Only an answered
  public QA snapshot explicitly approved by an editor qualifies. Inventory defaults off.
  Community feed, chat, profile and private thread advertising remain excluded.

- Pilot: one contextual Google limited ad at the end of `/blog/[slug]` for anonymous and Free
  readers in Turkey, across published KPSS/YKS/LGS articles. Premium and STAFF stay ad-free.
- Gated public blog index inventory: `knowledge.index` uses the selected family/category/page,
  appears below the exam card on desktop and before that card after the article list on mobile.
  One DOM slot is rendered; the rail is not sticky. The index placement defaults off pending
  inventory, content-value and privacy review.
- Backend eligibility controls automatic display for anonymous/Free readers. There is no visitor
  advertising accept/reject switch. Optional analytics remains separately opt-in; rejecting it
  does not disable ads. Cookie preferences disclose ad processing without presenting ad permission.
- Authenticated Free overview inventory: `notebooks.overview` follows the notebook list/load-more;
  `vision.overview` follows the desktop discovery list or the open mobile discovery panel.
  Both default off pending private-page content/crawler and privacy review. Editors stay ad-free.
  Sponsor campaigns can later reuse the same Google Ad Manager units through directly sold line
  items; no sponsor sales, cosmetic purchase or affiliate infrastructure is added.
- Existing rewarded development/test code remains; production stays fail-closed without server
  verification. Interstitial, sticky/app-open, feature entitlement and mobile SDK ads are excluded.

## Mimari

`AdsModule` placement uygunluğunu ve `ad_reward_sessions` yaşam döngüsünü sahiplenir; Economy
ledger'ına erişmez. Başlangıçta Economy'nin `coin_grant_reservations` kontrol tablosunda kapasite
rezerve edilir. `rewardedSlotGranted` geldiğinde rezervasyon ve `ad.reward.completed` ledger satırı
aynı SERVICE transaction içinde tamamlanır. `(ref_type, ref_id)=(ad_reward, sessionId)` tekrarları
ikinci Coin üretmez. Web kanıtı açıkça `CLIENT_EVENT` olarak saklanır; SSV değildir.

Pasif impression/fill/gelir kullanıcı bazında Mentor DB'ye yazılmaz; Google Ad Manager raporlarında
kalır. Makale ailesi Content modülünün yayımlanmış içerik arayüzünden çözülür; istemcinin gönderdiği
eski `examType` değeri güven kararı değildir. Profil ile içerikten biri LGS ise `CHILD`, değilse biri
YKS ise `TEEN` treatment uygulanır. Yaş, kullanıcı kimliği, sınav sonucu, ruh hâli, performans veya
AI konuşması Google'a gönderilmez.

## API

- `GET /v1/ads/public/placements/:placementId?contentSlug=` (`examType` deprecated)
- `GET /v1/ads/placements/:placementId?contentSlug=`
- `GET /v1/ads/{public/}placements/forum.question.end?questionId=<uuid>&contentRevision=<sha256>`
- `GET /v1/admin/ads/questions/:questionId` (preview, EDITOR/full admin)
- `PUT /v1/admin/ads/questions/:questionId` with `{contentRevision}` (audited approval, stale → 409)
- `DELETE /v1/admin/ads/questions/:questionId` (audited revoke)
- `GET /v1/ads/placements/community.question.end?questionId=<uuid>&contentRevision=<sha256>` (session required)
- `GET /v1/ads/placements/community.overview?contentRevision=<sha256>` (session required;
  no article slug or invented question ID; rendered/current discovery proofs must match)
- `GET /v1/ads/placements/community.announcement.end?threadId=<uuid>&contentRevision=<sha256>` (session required)
- `GET/PUT/DELETE /v1/admin/ads/announcements/:threadId` (EDITOR/full admin preview/approve/revoke;
  PUT accepts `{contentRevision}`, stale preview → 409; mutations audit approval metadata only)
- `GET/PUT/DELETE /v1/admin/ads/questions/:questionId/community` (separate preview/approval/revoke;
  PUT accepts `{contentRevision}`; EDITOR/full admin; mutations audited)
- `GET /v1/ads/reward-offers/:placementId`
- `POST /v1/ads/reward-sessions` (`Idempotency-Key: <uuid>` opsiyonel)
- `POST /v1/ads/reward-sessions/:id/complete`
- `POST /v1/ads/reward-sessions/:id/close`
- `POST /v1/internal/cron/expire-ad-reward-sessions` (`CRON_SECRET`)

## Configuration and rollout

All ad **enable flags** default off. `ads.display.allowed_countries` is an uppercase comma-separated
registry string, default `TR`; empty disables display everywhere and an unknown country always
fails closed (`REGION_NOT_ENABLED`, additive `/v1` reason). Existing EEA/UK/Switzerland CMP
restrictions still apply even if those countries are added to the allowlist. Ad units remain
environment-backed: `GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT`, `GAM_DASHBOARD_REWARDED_COIN_AD_UNIT`.
Overview inventory adds no provider or table; reviewed QA has its approval store.
Published article validation and the stricter
profile/content CHILD or TEEN treatment are preserved. Overview inventory uses only the
authenticated server-side profile; unknown/missing exam context returns `CONTEXT_UNVERIFIED`.
Public placement requests for overview inventory return 404; authenticated endpoints require a session.

### Admin-managed display units

In admin `/config`, category **Reklamlar**, configure each display unit using a Google inventory
path such as `/123456/notebooks`; URLs, HTML and scripts are rejected. Saves use the existing
validated/audited config API. Keys:

| Placement | Enable key | Google unit key |
|---|---|---|
| Article end | `ads.placement.knowledge_article_end.enabled` | `ads.placement.knowledge_article_end.ad_unit_path` |
| Blog index | `ads.placement.knowledge_index.enabled` | `ads.placement.knowledge_index.ad_unit_path` |
| Notebook overview | `ads.placement.notebooks_overview.enabled` | `ads.placement.notebooks_overview.ad_unit_path` |
| Vision discovery | `ads.placement.vision_overview.enabled` | `ads.placement.vision_overview.ad_unit_path` |
| Reviewed public QA | `ads.placement.forum_question_end.enabled` | `ads.placement.forum_question_end.ad_unit_path` |
| Existing community question | `ads.placement.community_question_end.enabled` | `ads.placement.community_question_end.ad_unit_path` |
| Discovery home preparation | `ads.placement.community_overview.enabled` | `ads.placement.community_overview.ad_unit_path` |
| Reviewed announcement detail | `ads.placement.community_announcement_end.enabled` | `ads.placement.community_announcement_end.ad_unit_path` |

Discovery additionally requires `ads.placement.community_overview.review_approved` (default false).
This audited operational gate must only be set after Google inventory/value, authenticated-page
crawling, moderation, privacy and public-disclosure review. It does not certify Google compliance
or replace moderation/editorial review. A navigation-heavy home may remain unsuitable; preparing a
slot is not evidence of content value. Keep both flags off until the review establishes eligibility.
The local official sample path also requires both gates and a verified public view. Do not give
Google real student credentials or private data to crawl the screen.

Empty overview units disable delivery. An empty article unit explicitly retains the legacy
`GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT` fallback; turn off the article placement to stop delivery.
Rewarded configuration is unchanged. A saved override takes effect on the next policy request
(normally route re-entry/reload), without deployment; existing slots are not polled or live-updated.
The existing registry cache is process-local, so multi-instance cache invalidation remains a
separate platform concern.

Blog index policy requires `family`, with optional `category` and `page` (default 1), on the
existing public/authenticated placement endpoints. Content's published-list API verifies the same
shared `BLOG_PAGE_SIZE` page as the UI. A matching featured article counts only on page one.
At least one matching published summary must contain an editorial description; links-only,
empty and past-end pages are denied. This minimum check is not a Google policy approval.
The legacy `examType` or an unrelated article slug never proves index context. Authenticated
readers retain the stricter profile/content audience treatment. A failed content lookup cannot
enable advertising. Empty index unit configuration disables delivery, with no environment fallback.

The server-rendered list and ad boundary share a request-scoped React cache for their existing
content requests. A failed/empty list never mounts the index ad boundary, regardless of ad policy.
Filtering or pagination replaces the slot's context; Premium/account changes retain the existing
teardown behavior. The index does not change article-end, overview or rewarded inventory.

Overview inventory requests only fitting `250x250` / `300x250` sizes. Discovery-panel width and map
height are unchanged; no second hidden desktop/mobile slot is mounted. A closed mobile drawer
does not prepare a slot, and closing it destroys its active slot. Google code remains deferred
until the placement approaches the viewport. No-fill/blocking/errors collapse the ad, with no
feature restriction or automatic refresh. Private notes, goal text and personal images are not
added to ad targeting or request parameters.

The retired `mentor.advertising-consent.v1` value is neither read nor rewritten and is never
interpreted as data consent. Google policy and GPT code remain deferred until the article end
approaches the viewport, with space reserved for declared inventory heights. No-fill, provider
errors or blocking preserve the article. Auth changes and subscription refresh signals invalidate
policy, cancel pending callbacks and remove the old slot before eligibility is reread.

Set web-server `GOOGLE_ADS_PUBLISHER_ID` to the real Google seller ID to serve `/ads.txt`. Blank
returns 404, malformed values fail rather than publishing fake sellers. `puhukoc.com` is the
purchased domain; live DNS/hosting setup remains pending. Google account selection,
AdSense/site approval, actual Google demand connected in Ad Manager, production inventory and
privacy/policy review remain external prerequisites. Ad Manager account creation alone is not a
revenue integration. Disable Auto ads to keep this single placement.

GPT uses the limited URL and `limitedAds: true` before display. **Programmatic limited ads** stays
off until the actual data processing, lawful basis for automatic serving in Turkey and
international transfers have been reviewed; then enable it for Google contextual
demand. It disables personalization but may use IVT-only cookies/local storage. Production flags
stay off until an isolated rehearsal with official inventory, full CI and a restricted real production impression /
revenue report have been verified. The detailed sequence and rollback are in
[`integrations.md`](../core/integrations.md#google-ad-manager-web-v1).

## 14-day exploratory pilot

Start at the first real impression. Track aggregate fill, impressions, viewability, actual revenue
and eCPM in Ad Manager (Limited ads serving restriction). Check article completion and Web Vitals
only among analytics-consenting readers, without treating that subset as all readers. A local
stubbed browser test proves lifecycle behavior, not Google fill/revenue. Technical success requires
real eligible impressions appearing in reporting and zero Google requests for excluded visitors.
Low traffic cannot establish revenue sufficiency. Keep passive per-user ad logs out of Mentor DB.

## Geliştirmeler (timeline)

- **2026-10-26: Existing inventory launch preparation.** Existing admin `/config` now embeds a
  read-only eight-placement summary from SUPER_ADMIN `GET /v1/admin/ads/readiness`; refresh or
  save config to reread switches, unit source/status and country/review gates. No Google calls,
  user/content inspection, approvals inferred from configuration or new activation controls.
  Official sample DISPLAY inventory is blocked in production even when pasted into config/env;
  legacy unit env values share Zod path validation. Public/settings TR/EN ad disclosure covers
  gated current screens and ad-free editors. Usage/setup/rollback/external blockers:
  [launch runbook](../qa/2026-10-26-ads-launch-readiness.md). Gotchas: local configuration does not
  verify live web ads.txt, Google account/site/demand, private-page crawling or privacy approval;
  all new production placements remain off. Related: `ads-readiness.service.ts`, `ad-unit.ts`,
  `admin-ads-readiness.controller.ts`, admin `AdsReadinessSummary.tsx`, `cookie-preferences-content.tsx`,
  `.env.example`, `e2e/ads-readiness.spec.ts`. No new room, page, inventory or database migration.

- **2026-10-26: Reviewed announcement detail inventory.** Added one lazy 250x250/300x250 slot
  after all initially visible comments on the existing message detail, exclusively for PUBLIC,
  active ANNOUNCEMENT rooms. Usage: migrate `0131`, open existing admin Forum → **Duyuru reklam
  incelemesi**, enter the announcement URL/UUID, inspect text, visible top-level comments,
  identities/avatars, images, tags and sidebar rooms, then approve the exact revision. Configure
  the separate unit in `/config`; empty disables delivery with no environment fallback. Keep
  `.enabled=false` pending Google inventory/content, safe authenticated crawling, moderation,
  privacy and disclosure review. Local sample mode still requires page context and approval.
  No real student credentials/private data may be supplied to Google.
  Gotchas: only the initial publisher view is approved, not hidden nested replies. Reply counts
  participate in its revision; opening a reply window, comment detail, edit/action controls,
  files, search or dialogs removes the ad before another view appears. Account navigation and
  the empty composer are application chrome; existing profile/content moderation remains
  necessary. Text, edited timestamps, visible comments, identities, images, tags or room changes
  require review again. Actual persistent sidebars must match the server proof; private, stale,
  unsupported or incomplete context stays ad-free. The existing sidebar limit is 100 rooms;
  more results fail closed until complete rendering/proof is supported. No live moderation push,
  automatic refresh or user impression tracking is added.
  The legacy `ad_question_reviews` table now has `content_type`, default QUESTION for all existing
  rows; ANNOUNCEMENT approval/revoke is isolated. No new table/provider; existing reviewer erasure
  clears both kinds. Revocation still works after content becomes unavailable. Admin preview
  resolves API-relative images through the shared media URL helper, and CSP permits only the
  configured API origin in addition to existing image sources. Related: `announcement-ad-snapshot.ts`,
  `forum-announcement-page.service.ts`, `ads-announcement-review.service.ts`,
  `admin-ad-announcements.controller.ts`, `AnnouncementAdReview.tsx`, message detail hook/components,
  migration `0131`, [plan](../superpowers/plans/2026-10-26-announcement-detail-ads.md).

- **2026-10-26: Discovery home preparation, closed delivery.** Added `community.overview` on the
  existing Keşfet home, desktop rail end/mobile last, with 250x250/300x250 width filtering and
  existing lazy GPT teardown. Usage: admin `/config` → Reklamlar has independent enable, unit
  path and `review_approved` controls. Both flags remain false; approval is an operational review
  checkpoint, not automatic Google certification or per-post editorial approval. No new page,
  table, provider, sponsor feature or migration. After both gates, Forum returns an opaque public
  page proof, exact waiting-question list and expected sidebar rooms. Eligibility rereads that
  view and compares the rendered proof; volatile action/count/presence fields are excluded.
  Gotchas: a replied, nonempty featured discussion is only a technical minimum, not Google's
  inventory-value approval. Any continuation/history rows, active/pending buddy relation,
  private/archived room or failed/incomplete read denies the view. This intentionally restricts
  coverage without hiding cards. Buddy UI must independently confirm no personal card; both
  persistent sidebars must match the proof before the slot mounts. Cached private rooms after
  cross-tab membership changes remain ad-free on soft navigation. Search/dialog/room changes
  cancel advertising for the visit, without automatic resume. Gates off add no context queries;
  no active-page moderation push/polling or user impression tracking was added. Shared script
  `test:e2e:community-ads` covers discovery and existing question inventory with synthetic API/GPT.
  Related: `forum-hub-page.service.ts`, `AdsService`, discovery controller, `hub-shell.tsx`,
  `community-overview-ad.tsx`, `community-sidebar-snapshot.tsx`, `session-buddy-card.tsx`,
  [implementation plan](../superpowers/plans/2026-10-26-community-overview-ads.md).

- **2026-10-26: Existing community question detail inventory.** Added one deferred square slot
  after answers on the existing authenticated screen. Usage: migrate `0130`, approve the public
  text in Community admin, then select **Topluluk görünümünü önizle**, inspect every identity,
  image, attachment, tag, room and waiting-question preview, and approve that exact view. The
  independent `/community` approval requires current public approval; public reapproval/revoke
  clears it, while community-only revoke preserves public approval. Audit retains revision/reviewer
  metadata only; account erasure clears both reviewer identities. Configure the new unit under
  `/config`; its empty path disables delivery, with no environment fallback. Leave the flag off
  pending inventory, authenticated-page crawling, privacy and public-disclosure review. Never give
  Google real student credentials or private data. Local sample mode also needs this placement's
  flag to assemble page context, and still requires both approvals.
  Gotchas: recommendations vary by viewer, so only an exactly matching reviewed rail qualifies.
  Private/archived rooms, coach bridges, polls, inline Markdown media, non-image attachments,
  unknown exam context and failed rail reads stay ineligible. Flag-off requests preserve the old
  query path; flag-on detail returns the rail it hashed, with no second client rail read. Text,
  attachments, emoji and dialog interaction remove filled or pending ads without auto-resuming;
  content revision changes replace the old slot. No live moderation polling or impression table.
  Browser suite: `pnpm --filter @mentor/web test:e2e:community-ads` (synthetic API/GPT only).
  Related: `forum-question-page.service.ts`, `community-question-snapshot.ts`,
  `ads-question-review.service.ts`, `CommunityQuestionAdReview.tsx`, question detail components,
  migration `0130`, [plan](../plans/2026-10-26-community-question-ads.md).

- **2026-10-25: Standalone calendar proposal withdrawn.** Removed the unpublished calendar/guide
  page, its dedicated ad placement/configuration, links and tests at the user's request. Existing
  blog, notebook, vision and reviewed-question inventory remains the scope. No migration or
  production activation occurred. Related: shared ads contracts/config and existing ad components.

- **2026-10-25: Reviewed public QA pilot.** Added one lazy square slot after all answers.
  Usage: Community admin → Question ad review → paste a public question URL/UUID → inspect
  the question and every answer → approve the exact snapshot. Revoke also works after the
  question becomes unavailable. EDITOR/full admin mutations audit revision/reviewer metadata,
  without copying content bodies. Ads owns the SERVICE-only, forced-RLS `ad_question_reviews`
  table; it reads Forum's public application service, never its tables. Account erasure clears
  reviewer attribution while preserving the reviewed snapshot and the existing audit retention
  policy. Eligibility requires
  matching rendered/current/approved revisions. Text, answer IDs/acceptance, update timestamps
  and zone context participate; editing back to old text cannot restore approval. Unknown exam
  context, private/archived/deleted/unanswered questions and missing approval fail closed even
  in local sample mode. Public pages read fresh on each visit. Gotchas: no live moderation push
  or polling to already open snapshots; manual review is not automated policy/PII detection.
  Monitor existing reports and revoke when needed. The new flag defaults off, unit paths have
  no env fallback, and approval alone cannot enable inventory. Google inventory/content/privacy
  review and updated public disclosures remain activation prerequisites. Browser checks use
  `pnpm --filter @mentor/web test:e2e:question-ads` (isolated ports 3370/3371, synthetic content,
  no database or real Google requests). Related: `ads-question-review.service.ts`,
  `ad-question-review.repository.ts`, `admin-ad-reviews.controller.ts`, `forum-public.service.ts`,
  `QuestionAdReview.tsx`, public `forum/question/[id]/page.tsx`, migration `0127`.

- **2026-10-25 · Public blog index inventory.** Added default-off `knowledge.index`, an admin
  enable switch and validated Google unit path, published list/featured-context verification,
  and one responsive non-sticky slot. Usage: configure `ads.placement.knowledge_index.ad_unit_path`
  under admin `/config`, review inventory/content/privacy and update the currently article-end
  public disclosures before enabling `ads.placement.knowledge_index.enabled`. Local sample mode
  supports the index but still requires verified content. Gotchas: editorial description is a
  minimum technical check, not approval; empty/error lists and description-free content do not
  become ad inventory. Related: `blog-ad-context.ts`, `ads.service.ts`, shared ads/content
  contracts, `knowledge/_components/{blog-posts,blog-index-ad,posts-section}.*`, `lib/ads.ts`,
  `e2e/blog-index-ads.spec.ts`, `test/ads.e2e-spec.ts`.
  Verification: 79 targeted API/config unit tests, 11 API/Postgres integration tests and 22 web
  message/blog/GPT unit tests passed. Sixteen new index browser cases and 16 related article/
  overview compatibility cases were verified on mobile/desktop, with focused reruns after
  transient local content-load failures. Screenshots were inspected; API/web/shared typechecks
  and touched-file lint passed, and independent review found no actionable findings. Full CI,
  live Google demand/revenue, inventory acceptance and disclosure review remain outstanding.

- **2026-10-25 · Vision discovery ad bottom alignment.** The ad now consumes the remaining
  space above it in the desktop discovery rail and open mobile drawer, placing it toward the
  panel bottom when the list is short. Long lists still scroll normally; the ad is not fixed or
  sticky, and the map size is unchanged. Usage: open `/hedef` with eligible inventory or local
  test mode; on mobile open the discovery drawer. Related: `vision-board-shell.tsx`.

- **2026-10-25 · Admin-managed Google overview inventory.** Added gated `notebooks.overview` and
  `vision.overview`, independent on/off settings, and validated Google unit paths for all three
  display placements. Usage: configure the unit under admin `/config` and complete the inventory,
  private-page/crawler and privacy gates before independently enabling either overview; defaults
  remain off. Local `ADS_LOCAL_TEST_ENABLED=true` now previews all display placements using only
  official sample inventory, retaining profile, entitlement and explicit-country protections.
  Gotchas: test inventory/stubbed browser tests do not establish revenue or publisher approval;
  do not expose real student credentials/data to crawlers. Empty blog configuration retains its
  documented environment fallback. Rewarded Coin and editors are unchanged. Related:
  `ads.constants.ts`, `ads.service.ts`, `config.catalog.ts`, `packages/{types,validation}/src/ads.ts`,
  `components/ads/*`, notebook/vision overview shells, `e2e/overview-ads.spec.ts`,
  `test/ads.e2e-spec.ts`, `docs/core/integrations.md`.
  Verification: 67 targeted API/config unit tests and 10 API/Postgres integration tests passed.
  Fifty distinct mobile/desktop blog/overview browser cases were verified across the combined
  run and focused reruns after correcting test-only editor landmark assertions. API, web and
  shared-package typechecks and touched-file lint passed; an independent review found no
  actionable findings. Browser demand is stubbed; full workspace CI, production eligibility,
  real Google fill/revenue and the required public disclosure review remain unverified.

- **2026-10-14 · PR #168 conflict resolution.** Synced the local Google display preview
  branch with `master`, retaining the isolated SDK/creative findings and the normal local
  application follow-up. Usage: follow the existing opt-in local preview steps; production
  rollout and publisher validation gates still apply. Gotcha: the smoke report covers two
  different backend setups, so keep their evidence and limitations distinct. Related:
  `docs/features/ads.md`, `docs/qa/2026-10-14-google-display-smoke.md`.

- **2026-10-14 · Google test ads in the normal local application.** Added opt-in API
  `ADS_LOCAL_TEST_ENABLED=true` for development with an HTTP loopback `APP_URL`. The existing
  article placement uses Google's official sample inventory, overrides display rollout switches
  only in this mode, and assumes TR only when the local request has no country header. Usage:
  set the key in `apps/api/.env`, restart the API, open `/blog/kpss-basvuru-sureci` on
  `http://localhost:3000`, and scroll to the article end in an anonymous or Free session.
  Premium/STAFF entitlement, published-content validation, stricter profile/content treatment,
  explicit country restrictions, and limited-ads loading remain in force. Gotchas: a Premium
  session or ad blocker still prevents display; the blog index has no slot. Missing local
  country is simulated, not evidence of edge geolocation. Startup rejects this mode on staging,
  production, non-development NODE_ENV, or a public APP_URL. Real inventory env values cannot
  replace the forced sample unit; rewarded placements and persisted configuration are unchanged.
  Disable with `ADS_LOCAL_TEST_ENABLED=false` and restart the API. Test inventory generates no
  publisher revenue. Related: `config/{env.validation,local-display-test}.ts`, `ads.service.ts`,
  `ads.constants.ts`, corresponding unit tests, `.env.example`.
  Verification: 101 relevant API/config/policy tests, API typecheck and touched-file lint passed.
  Desktop/mobile fresh browsers on the normal `localhost:3000` app received the real local
  backend decision and Google's 300x250 creative, without content or eligibility response mocks.
  The local API was restarted with the opt-in flag; normal web/API remain available for manual
  review. Full CI, production publisher approval and revenue were not verified in this step.

- **2026-10-14 · Real Google test inventory and CSP compatibility.** An isolated local web
  snapshot with synthetic content/eligibility loaded the actual limited GPT and a 300x250 Google
  test creative on desktop/mobile. The earlier 320x100 request returned no-fill. Added 300x250
  to the existing article catalog and reserved its 250px height. Allowed only the observed Google
  traffic-quality hosts in their required connection/image/frame directives; nonce script trust
  is unchanged. Usage: rehearse with the official sample unit, then configure a production unit
  with matching sizes after the existing rollout gates. Gotchas: backend eligibility was simulated,
  so this proves the real SDK/creative path, not trusted country headers, account approval or
  earnings. Test inventory does not establish the publisher's revenue integration. Related:
  `ads.constants.ts`, `components/ads/*`, `content-security-policy{,.spec}.ts`, blog ad fixtures,
  [Google smoke evidence](../qa/2026-10-14-google-display-smoke.md).
  Verification: 56 relevant web/API unit tests, 26 mobile/desktop ad browser cases, both package
  typechecks and touched-file lint passed. Actual Google test creatives were visually confirmed
  in desktop/mobile fresh contexts; no production ad flag, database setting or provider account
  was changed. Full hosted CI and real publisher revenue remain unverified.

- **2026-10-13 · Automatic Free blog ads.** Removed the advertising opt-in provider, banner
  choices, storage guards and withdrawal flow. Backend-eligible anonymous/Free readers now request
  the single limited ad automatically near the article end, regardless of optional analytics.
  Premium/STAFF, country/content checks, CHILD/TEEN protections and lifecycle cancellation remain.
  TR/EN cookie and legal copy now disclose ads rather than offering ad-free access by rejection.
  Usage: configure approved inventory and follow the existing rollout gates; production flags stay
  off. Gotchas: this is not user consent, legal certification or cookie-free programmatic demand;
  Ad Manager controls IVT storage network-wide. Do not enable automatic programmatic delivery
  before documenting an appropriate legal basis; if consent is required for the configured
  processing, use a reviewed alternative rather than silently enabling it. No sponsor integration
  or fake fallback revenue was added. Related: `components/ads/*`, cookie components,
  `analytics-consent.tsx`, `google-publisher-tag{,.spec}.ts`, `messages/{tr,en}.json`, `legal.ts`,
  `e2e/blog-ads.spec.ts`, `docs/core/integrations.md`.
  Verification: 33 relevant web unit tests and 31 existing API ad unit tests passed; 26 automatic
  ad browser cases and 8 compatibility cases passed on mobile/desktop Chrome with stubbed GPT.
  After the analytics fixture changed, all 6 affected browser cases passed again. Changed-file
  lint, translation-key parity and a focused TypeScript check of changed files/dependencies passed.
  Browser tests used the local development server, not a production build or live Google demand.
  The first isolated-server attempt hit an existing Next dev lock; the running user server was
  reused without stopping it. Parallel dev compilation then delayed assets beyond test deadlines;
  trace evidence identified that delay, and sequential local runs passed. Full web typecheck remains
  blocked by a stale generated `coach-application/page.js` reference and the pre-existing missing
  `hasCoach` field in `invite-lock.spec.ts`. Full CI/build and live/legal rollout remain pending.

- **2026-10-10 · Release checks and concurrent reward retries.** Restored the dashboard
  performance gate by deferring the notebook client's initial import; all eight budget checks
  pass on the CI-configured production build (dashboard route 739.3 KiB, total 1278.7 KiB).
  Reward-session creation now rechecks the same user's idempotency key before rejecting an
  offer changed by a concurrent creation. Usage: retry with the original key to receive the
  existing session. Added a deterministic race regression; the expiration test checks its own
  session's single reservation release instead of assuming a globally empty test database.
  Validation: final local workspace tests passed 4187 tests; full browsers passed 984
  cases (122 scoped skips), and the separate CAPTCHA phase passed 90. Lint, types, build,
  audit and budget gates passed. Gotchas: hosted CI, staging and real Google demand/revenue
  remain unverified; local checks alone do not authorize production rollout. Related:
  `ads.service{,.spec}.ts`, `test/ads.e2e-spec.ts`, `notebook-contents-cache.ts`,
  [`release verification`](../plans/2026-10-09-blog-ads-release-verification.md).

- **2026-10-09 · Turkey-only blog revenue pilot controls.** Added the central display country
  allowlist and additive region reason, independent TR/EN advertising choices, deferred consent-
  gated GPT, revocation with document reload, account/subscription invalidation and reserved ad
  height/error handling and selection of inventory sizes that fit the article column. Added an
  environment-backed root `ads.txt` endpoint, privacy disclosures
  and rollout/pilot instructions. Usage: keep production disabled, enter a real seller ID and
  separate units after domain/account/site/demand setup, verify staging, then follow the runbook.
  Gotchas: no old analytics choice enables ads; unknown country is denied; limited ads can still
  process data; browser GPT stubs do not prove live revenue; rewarded web remains closed in
  production. Related: `config.catalog.ts`, `ad-policy.ts`, `ads.service.ts`, advertising consent
  and GPT libraries, `components/ads/*`, cookie preferences, `legal.ts`, `app/ads.txt/route.ts`,
  `test/ads.e2e-spec.ts`, `e2e/blog-ads.spec.ts`, `docs/core/integrations.md`.
  Verification: 41 relevant API unit tests, 8 PostgreSQL ads E2E tests, 40 relevant web unit tests,
  20 mobile/desktop blog-ad tests against the production web build (GPT stub), existing blog and
  rewarded compatibility suites, and cross-tab auth regression passed. API/web type checks,
  touched-file lint, shared-types build, Render YAML parse and web production build passed.
  A fresh reviewer identified delayed account resolution and withdrawal retry teardown; both were
  corrected and covered by regressions. Performance budgets: article total 970.3 KiB / 985 KiB
  passes; dashboard route 843.3 KiB / 760 KiB and total 1382.7 KiB / 1295 KiB fail. This working
  tree is **not merge/release-ready** until that budget gate and full CI pass. Live staging Google
  inventory, production delivery/revenue, site/account approval and legal review remain unverified.

- **2026-09-25 · Reward completion feedback restored.** The dashboard quest sheet now shows the
  existing localized success toast after a fake/verified reward completion while refreshing the
  remaining offer. The browser fixture uses a future session expiry instead of a dated value, and
  checks two grants and idempotent retry on mobile and desktop. Use the optional "Reklamı izle"
  action to see the confirmation; no API contract or production ad flag changed. Related:
  `panel-shell.tsx`, `e2e/ads.spec.ts`.

- **2026-09-25 · Reward QA fixture follows the economy gate.** The rewarded-session unit and
  Postgres E2E fixtures explicitly enable `economy.enabled` while testing grants, replay and
  cross-user denial, then restore the previous override. This matches the existing server rule:
  reward completion is unavailable when economy is off. Run the two ads suites against isolated
  `mentor_test`; no production flag changes are implied. Related: `ads.service.spec.ts`,
  `test/ads.e2e-spec.ts`.

- **2026-09-06 — Rewarded Coin üretimde fail-closed** — Google Ad Manager web rewarded formatı
  sunucu tarafı doğrulama kanıtı vermediği için üretimde istemci `rewardedSlotGranted` olayı Coin
  basamaz. Teklif `SERVER_VERIFICATION_UNAVAILABLE` gerekçesiyle kapalı döner; daha önce üretilmiş
  bir oturumu tamamlama isteği de 422 ile reddedilir. Geliştirme/test ortamındaki akış görsel ve
  entegrasyon çalışması için korunur. Kullanım: üretimde ödül ancak imzalı sunucu doğrulaması sunan
  bir sağlayıcı veya app formatı seçildikten sonra yeniden açılmalıdır. Gotcha: günlük limit
  suistimal kanıtı değildir. İlgili: `ads.service.ts`, `ads.service.spec.ts`, `packages/types/src/ads.ts`.

- **2026-08-30 — Premium görev bannerı reklamdan ayrıldı** — `TopBanner` reklam bileşeni değil,
  ortak dashboard duyuru/görev giriş noktasıdır. Premium kullanıcı `Bugünün görevleri seni
  bekliyor` item'ını görüp Görevler sheet'ini açar; rewarded satır, GPT scripti ve reklam isteği
  gösterilmez. Rewarded Coin item'ı yalnız uygun Free kullanıcıya özel kalır. İlgili:
  `top-banner.tsx`, `panel-shell.tsx`, `e2e/ads.spec.ts`.

- **2026-08-30 — Ardışık günlük reklam hakları ve görev odaklı duyuru** — Web rewarded
  cooldown varsayılanı `0` oldu; günlük iki hak ayrı kullanıcı tıklamaları ve ayrı idempotent
  session'larla arka arkaya kullanılabilir. İlk tamamlamada başarı toast'ı gösterilir, açık Görevler
  sheet'indeki reklam satırı backend teklifini yeniden alıp ikinci GPT slotunu hazırlar; günlük hak
  bitince tamamlanmış duruma geçer. Top banner artık kalan toplam Coin'i görev diliyle gösterir ve
  sakin token tabanlı gradient kullanır; modal reklamı açmadan önce `Kısa bir reklam izle` diyerek
  şeffaf kalır. Gotcha: katalog varsayılanı mevcut DB override'ını ezmez; aktif ortamda
  `ads.rewarded.web.cooldown_seconds` ayrıca `0` kaydedilmelidir. İlgili: `config.catalog.ts`,
  `rewarded-ad-offer.tsx`, `top-banner.tsx`, `panel-shell.tsx`, `e2e/ads.spec.ts`.

- **2026-08-30 — Dashboard top banner ve günlük Coin görevi** — Sağ raydaki bağımsız rewarded
  kart kaldırıldı. Backend teklifi uygun Free kullanıcı dashboard'un üstündeki tek satırlık
  `{count} Coin seni bekliyor` duyurusundan mevcut Görevler sheet'ini açar; GPT ancak sheet
  açıldıktan sonra hazırlanır. Rewarded aksiyon günlük listenin ilk sırasında ayrı Coin görevidir,
  Economy'nin ritüel sayısına/serisine katılmaz. Duyuru kapatma tercihi sekme oturumu boyunca
  `sessionStorage` içinde kalır; çoklu item sözleşmesi beş saniyelik, hover/focus'ta duran rotasyona
  hazırdır. Gotcha: no-fill mevcut dashboard ziyaretinde duyuruyu gizler; Premium/STAFF ve backend
  ineligible kararları hiçbir GPT isteği üretmez. İlgili: `top-banner.tsx`,
  `rewarded-ad-offer.tsx`, `economy-quests-card.tsx`, `panel-shell.tsx`, `e2e/ads.spec.ts`.

- **2026-08-30 — Top banner görsel sadeleştirme** — Banner item ikonları kaldırıldı; dikkat dağıtan
  gradient yerine tasarım sisteminin düz yüzey ve nötr border renkleri kullanıldı. İlgili:
  `top-banner.tsx`, `panel-shell.tsx`.

- **Yoldaşlık sesi Dalga 17 — form kontrol et (2026-08-29)** — `ads.rewarded` unavailable/session_active “kontrol et” kalktı. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: e2e unavailable metni. İlgili: `apps/web/messages/{tr,en}.json`, `e2e/ads.spec.ts`.

- **Yoldaşlık sesi Dalga 11 — rewarded reklam (2026-08-29)** — `ads.rewarded` companion hak: `kazan`/`ödül`/`Lütfen` kalktı; `{count}` Coin gerçeği durdu. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: CTA “Reklamı izle”; leaderboard durdu. İlgili: `apps/web/messages/{tr,en}.json`, `e2e/ads.spec.ts`.

- **2026-08-29 — Web v1 stabilizasyonu ve staging hazırlığı** — Contextual karar artık yayımlanmış
  makalenin `contentSlug` değerini Content public arayüzünden doğrular ve profil/içerik arasındaki en
  sıkı treatment'ı seçer. Reward limiti Europe/Istanbul takvim gününe taşındı; create çağrısı UUID
  idempotency anahtarı, tek aktif session partial unique indexi ve forward-only `0088` migration ile
  yarışlara dayanıklı hâle geldi. Render Cron tarafından beş dakikada bir çağrılan, 200 kayıtlık
  `SKIP LOCKED` expiry sweep'i Coin rezervasyonunu aynı transaction'da bırakır; AdsModule mevcut
  job/cron mimarisinin dışında ayrı timer çalıştırmaz. Web rewarded
  akışı null slot/no-fill/10 saniye timeout'ta CTA'yı kaldırır, belirsiz create/complete sonucunu aynı
  kimlikle yalnız bir kez tekrarlar ve focus'u sakin sonuç durumuna döndürür. Kullanım: staging test
  unit'lerini env'e girip tüm `ads.*` bayraklarını yalnız staging'de açın; production rollout `%0`
  kalmalıdır. Gotcha: web kanıtı hâlâ `CLIENT_EVENT`tir; gerçek GAM/CMP/hukuk onayı bu teslimatta
  yoktur. İlgili dosyalar: `modules/ads`, `economy.service.ts`, `drizzle/0088_*`, `components/ads`,
  `lib/ad-reward-retry.ts`, `test/ads.e2e-spec.ts`, `e2e/ads.spec.ts`.

- **2026-08-29 — Web v1 temel teslimatı** — Ads bounded context, merkezi kill-switch/placement
  kataloğu, Coin kapasite rezervasyonu, client-event reward session, idempotent completion, RLS ve
  migration eklendi. Bilgi makalesi contextual slotu ve dashboard gönüllü Coin kartı limited GPT
  singleton'ı üzerinden bağlandı; Premium/STAFF script yüklemez. Admin overview reward/coin
  metriklerini gösterir; hesap silme mutable reklam/rezervasyon verisini temizler. Gotcha: bayraklar
  ve env yolları bilerek kapalı/boş gelir; Google + hukuk checklist'i tamamlanmadan açılmamalıdır.
  İlgili dosyalar: `modules/ads`, `database/schema.ts`, `components/ads`, `lib/google-publisher-tag.ts`,
  `drizzle/0087_perpetual_taskmaster.sql`.
