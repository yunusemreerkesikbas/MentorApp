# Ads — Google Ad Manager (Blog pilot)

## Product boundary

- Pilot: one contextual Google limited ad at the end of `/blog/[slug]` for anonymous and Free
  readers in Turkey, across published KPSS/YKS/LGS articles. Premium and STAFF stay ad-free.
- Backend eligibility controls automatic display for anonymous/Free readers. There is no visitor
  advertising accept/reject switch. Optional analytics remains separately opt-in; rejecting it
  does not disable ads. Cookie preferences disclose ad processing without presenting ad permission.
- Notebook/Vision Board ads and their policy evaluation are deferred. Sponsor placements,
  one-time cosmetic purchases and affiliate/institutional pilots have no new sales infrastructure.
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
No new provider or database table is added. Published article validation and the stricter
profile/content CHILD or TEEN treatment are preserved.

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
