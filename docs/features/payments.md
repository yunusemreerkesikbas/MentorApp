# Payments

> Subscriptions + entitlement + webhook-driven state machine + iyzico port. Module: `modules/payments`.
> Workstream: W4. Gates every premium AI surface via `PremiumGuard`.

## Overview

Payments owns subscription billing and the premium-entitlement check. It is **webhook-driven (no
cron)**: checkout → TRIALING (trial **once** per user — returning users re-subscribe trial-less) →
ACTIVE → PAST_DUE (premium continues `GRACE_PERIOD_DAYS=3`) → CANCELED (access until period end) →
EXPIRED. It exports `EntitlementService` + `PremiumGuard` (consumed by [AI](./ai.md) and others) and
the `PaymentsPort` (dual adapter: `fake` for dev/test, `iyzico` skeleton = unverified until Phase-0
sandbox keys). Money is an append-only ledger; **refund = record-only** (no provider call yet).

## Architecture (key decisions)

- **Schema (0003):** `plans` (seeded, **PLACEHOLDER prices** — Phase-0 WTP pending), `subscriptions`
  (state machine + partial-unique: one open sub per user), `payment_transactions` (append-only ledger,
  `providerEventId` unique), `payment_webhook_events` (idempotency belt). RLS self-read + SERVICE-write.
- **PaymentsPort + dual adapter:** `PAYMENTS_PROVIDER=fake` (dev/test — deterministic checkout,
  HMAC-signed fake webhooks via `signFakeWebhook`) · `iyzico` adapter = **UNVERIFIED skeleton**
  (fails loudly until Phase-0 sandbox keys). **Prod lock:** `fake` in production fails env validation
  at boot.
- **State machine (webhook-driven):** `payment_succeeded` → ACTIVE + period extended from the later
  of now / current period end (a late webhook never shortens paid time); `payment_failed` → PAST_DUE;
  cancel → CANCELED (access until period end, idempotent); `subscription_canceled` → EXPIRED.
- **Domain events:** `payments.subscription.activated/canceled`, `payments.payment.failed` (W5
  consumes for dunning/welcome emails).
- **EntitlementService + `PremiumGuard`** exported — W3 gates AI routes with `@UseGuards(PremiumGuard)`
  (403 `PAYMENT_PREMIUM_REQUIRED`, localized).
- **STAFF entitlement (team/beta premium):** users with the `STAFF` role are always PREMIUM
  (`reason: "STAFF"`, no expiry) **without a subscription row** → billing stats stay clean and
  trial-once is unaffected. Assignment endpoint + audit = W6 ([admin.md](./admin.md)).
- **e-Arşiv:** `InvoicePort` + logger stub called on successful charges (real integrator post Phase-0).
- **EventEmitter backbone** registered globally (`@nestjs/event-emitter`).

## Tutorials / Guides

```bash
pnpm --filter @mentor/api dev    # PAYMENTS_PROVIDER=fake (apps/api/.env)
# web /abonelik → consent → "Denemeyi başlat" → sonuc → Premium

# Simulate provider lifecycle (signed fake webhook):
signFakeWebhook(secret, { type: "payment_failed", providerRef }) → POST /v1/webhooks/payments
```

- Gate a premium route: `@UseGuards(PremiumGuard)` (import from PaymentsModule).
- Check entitlement: `EntitlementService` — premium users pass; STAFF role = always premium; trial-once
  = "has the user EVER had a subscription row" (expired users re-subscribe without trial).

### Webhook events handled

| Provider event | State transition |
|---|---|
| checkout completed | → TRIALING (fake) / INCOMPLETE (real iyzico — see gotcha) |
| `payment_succeeded` | → ACTIVE + period extended (later of now / period end) |
| `payment_failed` | → PAST_DUE (premium continues GRACE_PERIOD_DAYS=3) |
| cancel request | → CANCELED (access until period end, idempotent) |
| `subscription_canceled` | → EXPIRED |

## API

| Endpoint | Purpose |
|---|---|
| `POST /v1/subscription/checkout` | Start or resume an owned checkout (`useTrial` selects trial/direct purchase) |
| `POST /v1/webhooks/payments` | Provider webhook (raw body, signature-verified) |
| `GET /v1/subscription` | Subscription view, entitlement, trial eligibility and pending checkout recovery |
| `POST /v1/subscription/cancel` | Cancel confirmed pending checkout, or stop renewal with access until period end |

## Geliştirmeler (timeline)

- **Browser coverage aligned with automatic trials (2026-10-10).** Phone verification and
  promotion fixtures now use `ACCOUNT_USED` for paid purchases and the automatic trial
  disclosure for eligible accounts. Usage: run `phone-verification.spec.ts` and
  `promotions.spec.ts`; all 52 mobile/desktop cases passed. SMS verification still resets
  billing consent, ambiguous checkout recovery remains covered, and both discounted first
  charge and renewal prices are asserted. Gotcha: the retired paid/trial selector is no
  longer a valid test target. Related: `apps/web/e2e/{phone-verification,promotions}.spec.ts`.

- **Quiet paid start for returning accounts (2026-10-09).** The paywall and subscription cards
  no longer explain that an account/phone already used its trial. Usage: returning buyers see
  the plan price, paid-start button and immediate-charge consent; eligible trial buyers still see
  trial details and required phone verification. Eligibility and checkout intent are unchanged.
  Related: `subscription-trial-notice.tsx`, `e2e/subscription-trial.spec.ts`, `messages/{tr,en}.json`.

- **Automatic trial in web purchases (2026-10-09).** Removed the paid/trial start selector from
  the Premium paywall and subscription plan cards. An eligible account automatically gets the
  selected plan's configured trial (currently seven days); accounts/phones that already used it
  start paid. Usage: choose a plan, complete phone verification when required, then accept the
  matching billing disclosure and continue. Verification and plan changes reset consent;
  switching plans keeps automatic trial selection. Existing backend eligibility, carded checkout,
  promotions and pending-checkout recovery remain authoritative. The large paywall was split into
  a purchase hook, footer and plan picker. Related: `premium-paywall-modal.tsx`,
  `use-premium-paywall.ts`, `premium-paywall-footer.tsx`, `premium-paywall-plan-picker.tsx`,
  `subscription-trial-notice.tsx`, `subscription-plan-card.tsx`, `subscription-trial.ts`,
  `messages/{tr,en}.json`, `e2e/subscription-trial.spec.ts`.

- **Serialized paid/trial checkout reservations (2026-10-03).** Paid and trial checkout now lock
  the same ACTIVE Identity account and re-read pending claims and the open subscription in one
  transaction. Both persist an INCOMPLETE subscription and its promotion reservation before
  provider HTTP, so overlapping paid/trial requests cannot delete each other's reservation or
  initialize two provider checkouts. Matching plan/code/trial intent resumes the original hosted
  URL; an unknown outcome, including a legacy pending paid row without a saved URL, remains held
  until verified provider evidence. `pendingCheckoutUrl` in `GET /v1/subscription` exposes the
  current owner's known paid or trial URL; `pendingTrialCheckoutUrl` remains compatible.
  Canceling any INCOMPLETE checkout requires a known provider reference and confirmed provider
  cancellation. Its pending row is removed, never changed into CANCELED Premium access; an
  activation that wins during cancellation retains its history and access until period end.
  Definitive checkout rejection/cancellation emits the existing subscription lifecycle event
  after cleanup so mentorship can restore an eligible sponsored seat. Usage: resume a known
  checkout from the subscription page; wait for reconciliation when its URL is unknown.
  Gotcha: no reservation ages out automatically and a transport timeout is not rejection evidence.
  Related: `checkout.service.ts`, `subscriptions.service.ts`, `phone-trial.service.ts`,
  payment/phone repositories, `checkout-reservation.e2e-spec.ts`, forward migration `0122`.

- **Verified-phone carded trials and sponsorship gates (2026-10-02).** Checkout accepts
  additive `useTrial`: `false` buys without phone verification, `true` rejects unavailable trials,
  and omitted values keep automatic account-trial selection. `GET /v1/subscription` returns
  backend-owned `trialEligibility` for the web. An eligible trial requires an ACTIVE verified phone;
  `pendingTrialCheckoutUrl` exposes only the current owner's known pending hosted URL, so the
  subscription/paywall can resume directly without another provider call. Unknown holds return null.
  account purchase history still permits only one account trial. A payment-owned keyed fingerprint
  is reserved before provider I/O, with unique phone and pending-account constraints. The intended
  INCOMPLETE subscription and promotion reservation are committed before that single call. Instant
  fake checkout, `checkout_completed`, and first `payment_succeeded` consume the snapshot in the
  same transaction that grants access, retaining it for twelve calendar months. Hosted trial
  confirmation starts the duration reserved at checkout, even after a delayed webhook;
  it never silently changes an intended trial into paid ACTIVE access. Binding and
  activation recheck ACTIVE verification under an identity row lock and
  require the claim's original user association, so erasure cannot reattach a detached reservation;
  the fingerprint snapshot itself never follows a phone change. Erasure detaches
  the user; the retention job purges only expired CONSUMED claims. Definitive rejection/cancellation
  releases PENDING claims; ambiguous outcomes retain them without a timer. Matching retries return
  the original hosted URL; unknown outcomes return `PAYMENT_TRIAL_PENDING` and require provider or
  operator evidence before reconciliation. Do not delete a hold solely because it is old. The
  iyzico skeleton makes no live calls; its local refusal is explicitly definitive. Sponsored-seat
  `grant(studentId, linkId, coachId)` verifies BOTH ACTIVE phones centrally even when sponsorship is
  enabled. Related: `phone-trial.service.ts`, `checkout.service.ts`,
  `phone-trials.repository.ts`, `schema-phone-trials.ts`, `subscriptions.service.ts`,
  `sponsored-seat.service.ts`, migration `0120`, `payments.e2e-spec.ts`, `phone-trials.e2e-spec.ts`.

### 2026-09-17 — XP / Coin launch integration

- First-positive-charge and source-payment refund events are persisted with payment transactions through the existing JobQueuePort transaction option. The retry handler restores the original payment timestamp. PaymentEvidenceService exposes refund evidence without sharing tables. Trials and later renewals do not create invite grants. Usage: process existing jobs normally. See payment-reward-events.service.ts and economy.md.


- **`PaymentRefunded.sourcePaymentId` zorunlu (2026-09-17)** — İade ödül olayı job kuyruğundan
  parse edilirken `sourcePaymentId` her zaman gerekir (davet clawback bu id'ye kilitli). Domain
  sınıfı worker Zod şeması ile hizalandı; alanı optional yapmak kaynaksız iadede reversal'ı sessiz
  no-op yapardı. Kullanım: `refundLastCharge` zaten charge'ın `providerEventId` değerini yazar.
  Gotcha: kuyruk payload'ında alan yoksa işçi parse'da düşer ve job retry olur; clawback atlanmaz.
  İlgili: `payments.events.ts`, `payment-reward-events.service.ts`,
  `payment-reward-events.service.spec.ts`, [economy.md](./economy.md).

- **Ödeme kanalı flag'leri: web, mağaza ve web→mağaza yönlendirme (APP-096, 2026-09-15)** — Web
  ödemesini deploy'suz ve kitle bazında kapatıp alıcıyı App Store / Google Play'e gönderebilmek için.
  Mobil uygulama henüz yok; mobil flag'lerin bugünkü tek tüketicisi web yönlendirmesi.
  **Kitle × kanal:** öğrenci `payments.web.enabled` (default **true**) / `payments.mobile.enabled`;
  koç `mentorship.seats.billing_enabled` (artık "koç web checkout'u") /
  `mentorship.seats.mobile_billing_enabled`; ikisine ortak `payments.web.redirect_to_mobile`. Ayrı
  mobil anahtarlar bilerek: mağazalar büyük ihtimalle önce öğrenciye açılacak, ortak bir anahtar koçu
  Koç Pro satmayan bir uygulamaya yollardı. Karar tek yerde, saf fonksiyonda:
  `domain/purchase-channel.ts` plan başına `listed` / `purchaseEnabled` / `redirectToMobile` döner;
  servis flag'leri `purchaseChannels()` ile bir kez okur. `PlanDto.redirectToMobile` eklendi,
  `purchaseEnabled` artık "bu plan için web checkout'u mümkün" demek (provider canlı VE kitlenin web
  kanalı açık). Web: `lib/purchase-mode.ts` üç mod (`checkout` / `store` / `unavailable`) +
  `StoreButtons`; paywall yalnız öğrenci planlarını, `/abonelik` role göre planları gösterir.
  Kullanım: admin config'ten `payments.web.enabled` kapat → web "Çok yakında"; buna ek olarak
  `payments.mobile.enabled` + `payments.web.redirect_to_mobile` aç ve `NEXT_PUBLIC_APP_STORE_URL` /
  `NEXT_PUBLIC_PLAY_STORE_URL` ver → mağaza butonları.
  Gotcha: (1) Flag'ler yalnız **yeni** satın almayı gate'ler; açık abonelik, yenileme webhook'u,
  iptal ve iade etkilenmez. (2) Promosyon yalnız web'den satılabilen planlarda çözülür: satılabilir
  plan yoksa `resolveOffers` boş döner (kod yazıldıysa `PAYMENT_DISABLED`) ve `findWinBackOffer`
  susar; dashboard'da indirim bannerı yerine statik kampanya kartı kalır, o da paywall'u açar.
  Mağaza web indirimimizi uygulamaz. (3) Mağaza modunda web katalog fiyatını notsuz gösterir:
  `plans.priceMinor` mağaza fiyatına elle eşit tutulmalı. (4) Mağaza URL'leri build-time; ikisi de
  boşsa yönlendirme "Çok yakında"ya düşer, çıkmaz sokak yok. (5) Apple TR storefront'ta uygulama
  içinden web ödemesine link verilemez: yönlendirme yalnız web→mobil, mobil uygulama web kanal
  flag'lerini okumamalı.
  İlgili: `domain/purchase-channel.ts`, `subscriptions.service.ts` (`listPlans`, `checkout`,
  `resolveOffers`, `findWinBackOffer`, `getAdminView`), `common/config/config.catalog.ts`,
  `packages/types/src/payments.ts`, `apps/web/src/lib/purchase-mode.ts`,
  `apps/web/src/components/premium/{store-buttons,premium-paywall-modal}.tsx`, `subscription-shell.tsx`.

- **Süre dolma süpürücüsü + yayındaki WIN_BACK hatası (2026-09-01)** — `EXPIRED` yazan tek yer
  `subscription_canceled` webhook'uydu ve payments'ta cron yoktu, yani **süresi doğal dolan abonelik
  tabloda sonsuza kadar `ACTIVE` kalıyordu**. İki sonucu vardı: kullanıcı bir daha satın alamıyordu
  (`findOpenForUser` bayat satırı hâlâ açık sayıyor) ve `WIN_BACK` indirim kuralı hiç eşleşmiyordu.
  Yeni `POST /v1/internal/cron/expire-subscriptions` (`CronSecretGuard`, `render.yaml` girdisi,
  günlük 03:30) satırları emekli edip `SUBSCRIPTION_EXPIRED` yayıyor.
  Kullanım: sweeper yüklemi `hasRunOut`, kural `computeEntitlement`'a devrediyor — süpürücü ile
  kullanıcıya gösterilen entitlement asla ayrışamaz.
  Gotcha: **`hasRunOut` ile `hasLostAccess` farklı sorular.** Birincisi "süpürücü emekli etsin mi?"
  (zaten-EXPIRED'a hayır, süpürme idempotent kalsın diye), ikincisi "kullanıcı erişimi kaybetti mi?"
  (zaten-EXPIRED'a evet). İkisini birleştirmek WIN_BACK'i ve geri kazanım bildirimini sessizce
  öldürüyor — e2e'de regresyon kilidi var. Bir diğeri: bu, modülün belgelenmiş "webhook-driven
  (no cron)" kararının tek istisnası.
  İlgili: `subscription-maintenance.service.ts`, `payments-internal.controller.ts`,
  `entitlement.service.ts`, `render.yaml`, `test/promotions.e2e-spec.ts`.

- **İndirim ödeme yüzeyine geldi (2026-08-30)** — `GET /v1/subscription` yanıtına `discount`
  eklendi (checkout'ta donmuş liste/indirim/tahsil fiyatı + kalan dönem). `POST
  /v1/subscription/offers` geçersiz kupon kodunda 422 atıyor — önizleme ve checkout aynı hatayı
  veriyor. `POST /v1/subscription/checkout` artık `code` kabul ediyor. Detay:
  [promotions.md](./promotions.md). Gotcha: `promotions.enabled` kapalıyken `discount` her zaman
  `null` ve davranış birebir eskisi. İlgili: `subscriptions.service.ts`,
  `subscriptions.controller.ts`, `packages/types/src/payments.ts`.

- **Promosyon motoru bağlandı (2026-08-30)** — Checkout artık liste fiyatını değil, promosyon
  motorunun ürettiği tutarı sağlayıcıya geçiriyor (`PaymentsPort.plan.chargeAmountMinor`).
  Webhook tarafında defter satırı ve e-Arşiv faturası `plan.priceMinor` yerine
  `promotion_redemptions.charged_price_minor` (mutabık kalınan tutar) kullanıyor — indirimli bir
  abonelikte eski fallback hem defteri hem gelir istatistiğini hem faturayı şişiriyordu.
  Kullanım + konfigürasyon: [promotions.md](./promotions.md). Gotcha: `promotions.enabled`
  varsayılanı `false`; kapalıyken davranış birebir eskisi. İlgili: `subscriptions.service.ts`,
  `shared/ports/payments.port.ts`, `modules/promotions/**`.

- **Yoldaşlık sesi Dalga 17 — form kontrol et (2026-08-29)** — Checkout `desc_error` companion: kart “kontrol et” kalktı. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). İlgili: `apps/web/messages/{tr,en}.json`.

- **Kampanya banner (2026-08-23)** — Panelde ücretsiz kullanıcıya paylaşılan premium
  kampanya (`PremiumCampaignBanner`), sağ sütunda `campaign.jpg` + deneme metni.
  CTA paywall modal.
  İndirim uydurulmaz; 7 gün deneme + koç vurgusu. İlgili: `premium-campaign-banner.tsx`,
  [web-shell.md](./web-shell.md).

- **`/abonelik` iptal çipi (2026-08-23)** — İptal sonrası sağ üstte iki chip yok. İptal
  zaten satırlarda (erişim bitiş + yenileme durur); hero en fazla bir durum çipi gösterir.
  İlgili: `subscription-facts.ts`, `subscription-shell.tsx`.

- **`/abonelik` yönetim kartı (2026-08-22)** — Sayfa başlığı, alt başlık ve “Panele dön”
  kalktı. Üstte plan adı + ücret + durum çipi; altında sol etiket / sağ değer satırları
  (`<dl>`): ücret, dönem, başlangıç, deneme bitiş, dönem başlangıcı, sonraki yenileme **veya**
  erişim bitiş, yenileme (otomatik / dönem sonunda durur). Figma cam kartı ve ödeme geçmişi yok —
  public ledger yok, uydurulmaz. İptal butonu `secondary` ve kompakt. `GET /v1/subscription`
  artık `startedAt` + `currentPeriodStart` döner. Kullanım: ücretsizde katalog + (ödeme kapalıysa)
  “çok yakında”; açık abonelikte katalog gizlenir. Gotcha: STAFF premium satır olmadan da
  premium olabilir — o durumda sadece hero. İlgili: `subscription-shell.tsx`,
  `subscription-facts.ts`, `toSubscriptionDto`.

- **Checkout başarı overlay (2026-08-22)** —   `/abonelik/sonuc` artık kartlı sayfa değil; tam
  ekran modal (yeşil→canvas linear wash, `success.svg`, tek seferlik `confetti.lottie`).
  Puhu dans videosu yok — ödeme teyidi evrensel tik. Tek CTA “Panele dön” (metnin altında,
  dipte değil). Fiş /
  tutar / kart sonu yok: iyzico bu veriyi dönüş URL’sinde vermez, e-arşiv ayrı. Hata halinde
  konfeti yok, aboneliğe dönüş. `prefers-reduced-motion` konfetiyi ve SVG SMIL’i atlar.
  Kullanım: checkout `returnUrl` aynı kalır (`?status=success`). Gotcha: overlay `fixed inset-0`
  ile nav/tab bar’ın üstünü kaplar; X yok, çıkış “Panele dön” veya Escape (başarı → panel,
  hata → `/abonelik`). İlgili:
  `checkout-result-content.tsx`, `confetti-burst.tsx`.

- **Premium kimlik işareti (2026-08-22)** — Premium, avatar overlay değil; ismin yanında
  `--color-star` taç. “Premium” yazısı chrome’da yok. Mavi tik ve ödül kurdelesi yok. Nav,
  ayarlar ve topluluk profilinde aynı bileşen (`PremiumIdentityMark`). Feed'e basılmaz. İlgili:
  `premium-identity-mark.tsx`, `app-nav.tsx`, DESIGN.md §7.

- **Paywall görsel parity (2026-08-22)** — Overlay scoped dark token (`.premium-paywall-theme`),
  `upgrade-premium.svg` hero, ikonlu fayda listesi, seçili plan çerçevesi ve uzun dönem rozeti.
  Üst atmosfer: light-canvas blob opaklıkları + blob hue radial wash (düz charcoal slab değil).
  Motion: sheet/dialog enter, blob drift, hero bob, fayda/plan stagger (`stagger-motion`).
  Plan kartı: gölge yok, `--paywall-plan-radius: 24px`, flex ile aşağı itilir. Consent tek kutu
  (kısa metin + yasal linkler); CTA hosted checkout’a gider. Desktop: 480px içerik-yükseklikli
  sheet, tek sabit footer, blur’lu backdrop; iç scrollbar yok (`overflow-hidden`).
  Kopya: ücretsiz = plan/süre/ritüel, premium = AI koç katmanı; fayda maddeleri sohbet+selam+seans,
  haftalık hikâye/ghost/analiz, foto-konu, plan+vizyon. Utandırma ve **uydurma** indirim yok — hiç var olmamış bir "eski fiyat"ın üstü çizilmez. Gerçek bir promosyon indirimi (bkz. [promotions.md](./promotions.md)) üstü çizili gösterilebilir; o rakam kullanıcının gerçekten ödeyeceği liste fiyatıdır.
  Restore Purchase yok. İlgili: `premium-paywall-modal.tsx`, `theme.css`.
- **Kilit rozetleri (2026-08-22)** — Mood yansıması, ghost anlatımı, günlük selam ve seans
  yansıması artık kilitliyken görünür kalır; tıklanınca paywall açılır. Politika
  `isPremium || features[id].freeEnabled`. İlgili: `premium-lock-nudge.tsx`,
  `use-daily-greeting.ts`, `mood-checkin.tsx`, `analysis-ghost-teaser.tsx` (2026-09-22'den beri
  analizde `focus-path-card.tsx` balonu), `session-done-state.tsx`.
- **Premium paywall + özellik politikası (2026-08-22)** — `GET /v1/subscription` artık on özellik
  için `features` politikasını döner (`freeEnabled` / `limit` / `window`). Kota `ai_usage`'a
  payments dokunmadan action'da uygulanır: free tavan → `PAYMENT_PREMIUM_REQUIRED`, premium tavan →
  mevcut `AI_RATE_LIMITED`. Checkout/webhook değişmedi. Admin `PATCH /v1/admin/plans/:id` (FINANCE,
  audit `plan.update`) ad, fiyat, deneme günü ve aktifliği düzenler; `id`/`periodMonths` kilitli.
  Kullanım: config `ai.features.<id>.free_enabled` + `free_limit` (varsayılan kapalı = bugünkü
  davranış). Web kilit CTA `/abonelik` yerine paywall modal açar. İlgili: `feature-access.ts`,
  `premium-paywall-modal.tsx`, `admin-plans.controller.ts`.
- **`payments.payment.refunded` event'i (APP-025, 2026-07-19)** — `refundLastCharge` artık tx
  commit SONRASI `payments.payment.refunded` (`PaymentRefunded {userId, subscriptionId,
  amountMinor}`) emit eder (webhook side-effect disiplini: rollback hiçbir şey yayınlamaz).
  Tüketici: economy `RefundEventsListener` — iade edilen kullanıcının davetçisinin dönüşüm ödülünü
  geri alır (refund-only + clamp-to-zero; bkz. [economy.md](./economy.md)). Refund akışının kendisi
  değişmedi (record-only, capped).
- **English payments/account source naming (2026-07-19)** — Subscription and profile source folders,
  components, and symbols now use English canonical names. Public Turkish paths remain
  `/abonelik`, `/abonelik/sonuc`, and `/profil`; English uses `/en/subscription`,
  `/en/subscription/result`, and `/en/profile`. Related: `subscription-shell.tsx`,
  `profile-shell.tsx`, `i18n/routing.ts`.
- **W4 Payments (subscriptions + entitlement)** — schema 0003; PaymentsPort + dual adapter (fake
  deterministic / iyzico skeleton); webhook-driven state machine; EntitlementService + PremiumGuard
  exported; STAFF entitlement; e-Arşiv InvoicePort stub; web `/abonelik` + `/abonelik/sonuc`;
  EventEmitter global. e2e 12/12 full lifecycle incl. idempotent replay + invalid-signature 401 +
  trial-once re-subscribe. *(0015.)*
  - **Code-review fixes:** webhook crash-safety (idempotency record + state-apply in ONE
    `withServiceContext` tx — rollback publishes nothing; ledger dedupes on `providerEventId`);
    checkout race (concurrent double-checkout → `PAYMENT_ALREADY_SUBSCRIBED`); `isUniqueViolation`
    moved to shared `common/errors/postgres-error.ts` (DRY with identity); iyzico verification gate
    documented (rows start INCOMPLETE for real iyzico, activate on checkout-completed webhook).
- **Web Abonelik UI polish** — `AbonelikShell` extracted (header fade + stagger; SectionHeading
  status card; plan grid motion; trial consent checkbox 44px touch + `aria-describedby`;
  `ApiClientError` messages; loading/error states); `CheckoutResultContent` (chip-style badge, primary
  CTA "Koça git" on success, Link-as-button tokens, Suspense fallback). *(0040.)*
- **Admin refund + subscription view** — record-only refund + cancel on user-detail (audited,
  ADMIN-only). `SubscriptionsService.getAdminView` + `refundLastCharge` (atomic, `SELECT … FOR UPDATE`,
  capped to last charge − prior refunds). Refund = negative ledger row; never alters status. *(0025 —
  see [admin.md](./admin.md).)*
- **Verification gate + refund wiring (WP-I)** — checkout-INIT status now depends on the provider:
  instant providers (FAKE) grant TRIALING/ACTIVE immediately, hosted-page providers (IYZICO,
  `instantCheckout=false`) create an **INCOMPLETE** row that grants no premium until a signed
  `checkout_completed` webhook activates it. `PaymentsPort.refund(providerRef, amountMinor,
  idempotencyKey)` is wired — called (fake: deterministic no-op; iyzico: `notVerified` until keys)
  **before** the ledger append, so a provider failure rolls back the record; the `admin-refund:<uuid>`
  is the Idempotency-Key. No DB migration (status is a text column). *(2026-07-20.)*

### 2026-10-04 — Explicit checkout intent in integration regressions

- Promotion tests select direct purchase with `useTrial: false` while their buyers remain phone-unverified. A pending promotion reservation is released only after provider-confirmed cancellation; another checkout no longer discards an unresolved attempt. Trial conversion and refund tests keep `useTrial: true` with verified-phone fixtures, preserving coverage of the initial charge versus renewal reward lifecycle. Invite-only users still need no phone verification.
- Usage: run `promotions.e2e-spec.ts` and `economy-invite.e2e-spec.ts` against the dedicated test database. Omitting `useTrial` intentionally retains automatic first-subscription trial selection and its phone requirement. Related: `apps/api/test/promotions.e2e-spec.ts`, `apps/api/test/economy-invite.e2e-spec.ts`.

## Gotchas / Known issues

- **Coach seats read payments twice, and never write it (W8 phase B, 2026-09-27).** The seat on a
  coach link is decided in W8 (`coach_students.seat`); payments answers two questions for it:
  `paidSeatsFor(coach)` (the plan's `seat_count` while it grants premium) and
  `listSelfPayingUserIds(students)` (an open, non-SPONSOR row that `computeEntitlement` calls premium:
  such a student holds no seat, one payer per student). Every `payments.subscription.*` activated /
  canceled / expired event reseats the coaches it touches (W8's `SeatEventsListener`), so a new event
  on a subscription change needs no seat code. The seat plans are now `coach-plus-5/10/20`
  (`coach-pro-10/25` inactive, never sold).
- **A subscription row is not always a purchase (W8 seats, APP-076).** `provider = 'SPONSOR'` marks
  a row a coach's seat pays for: no checkout, no webhook, no ledger entry, `plan_id = 'coach-seat'`
  (priced 0) and `current_period_end = null` while it holds. `computeEntitlement` is deliberately
  unaware of all this — it just sees ACTIVE. **Any new query over `subscriptions` has to answer
  whether it means "has premium" or "pays us"**, because those are no longer the same set. Three
  places already had to choose: `hasAnyForUser` (trial-once — sponsored rows must not burn the
  student's own trial), `countByStatus` (the conversion denominator), and `checkout` (a seat is
  retired rather than raising `PAYMENT_ALREADY_SUBSCRIBED`). Revenue metrics needed no clause: they
  read the ledger, and a seat never writes one.
- **Coach seats are a PLAN property, not a tier (W8, APP-079).** `plans.seat_count` is 0 on every
  student plan; a non-zero value is what makes a plan a coach plan. There is no `COACH_PRO` tier
  and `computeEntitlement` is untouched: a coach subscribes to `coach-pro-10` *instead of* a
  student plan, holds the same one open subscription as everybody else, and gets `isPremium` from
  the ordinary ACTIVE path. Seat allowance is read off the row they already have. If a future tier
  ladder is ever really needed, note that this one did not require it.
- **`mentorship.seats.billing_enabled` gates coach web checkout, checkout-by-id included.** Hiding
  seat plans from `listPlans` alone would be a UI convention; `checkout` refuses them too
  (`PAYMENT_DISABLED`). Since APP-096 the catalog lists a seat plan while either coach channel is on
  (`billing_enabled` or `mobile_billing_enabled`), but checkout is the web channel and follows
  `billing_enabled` alone.
- **The sponsored cohort shares the global AI budget — deliberately, for now.** Seats hand out real
  LLM spend, and `ai.budget.monthly_cap_usd_cents` is a single cap over everyone, so a large enough
  giveaway can exhaust it and start returning `AI_BUDGET_EXCEEDED` to **paying** users. No separate
  sponsored cap was added (APP-077): inventing a ceiling without data would brake in the wrong
  place, and `GET /v1/admin/metrics/sponsorship` exists precisely to produce that data. The brakes
  that do exist are `mentorship.coach.free_seats` (bounds new seats) and
  `mentorship.seats.sponsorship_enabled` (a real kill switch — flipping it off ends live seats).
  Revisit once cost-per-seat is known.
- **`coach-seat` is an active plan that is not for sale.** `PlansRepository.findActive` excludes it
  by name. `PlanDto.purchaseEnabled` is resolved per plan by its audience's channel (APP-096), and
  `coach-seat` grants no seats, so a listed one would resolve as a sellable student plan: a buy
  button next to a ₺0 price.

- **`GET /v1/subscription` has no remaining quota** — payments must not read `ai_usage`. The
  client treats a surface as unlocked when `isPremium || features[id].freeEnabled`; exhausted free
  caps return `PAYMENT_PREMIUM_REQUIRED` on the action.
- **iyzico adapter is UNVERIFIED** — fails loudly until Phase-0 sandbox keys. **Prod lock:** `fake`
  forbidden in production (env validation at boot). `createCheckout`/`cancel`/`verifyWebhook`/`refund`
  all `notVerified()` until the real HTTP + HMAC-SHA1 mapping lands with sandbox creds.
- **Phone-trial live launch blocker (2026-10-02).** Before enabling live trials, the real adapter
  must correlate a callback that arrives before the checkout response/provider reference is saved.
  The current general webhook behavior records and acknowledges unknown references. That evidence
  must be reconciled with the payment-owned pending claim and intended subscription before applying
  activation; replaying the HTTP webhook alone will hit its idempotency record. A transport timeout
  or an old claim is not rejection evidence. Retain the hold, obtain a verified provider result,
  restore the reference/hosted URL only for its still-attached ACTIVE account, then apply the
  recorded normalized event through the existing transactional subscription service. Confirm the
  provider billing calendar matches the duration reserved at checkout before declaring trial
  launch ready. There are no live iyzico calls in this development.
- **Verification gate (shipped, WP-I; phone trials revised 2026-10-02):** hosted-page providers create an INCOMPLETE row at
  checkout-INIT; only `checkout_completed` activates it (INCOMPLETE→TRIALING/ACTIVE by the row's
  `trialEndsAt`). INCOMPLETE grants no premium (`computeEntitlement` → `free("INCOMPLETE")`). A
  paid or phone-trial INCOMPLETE row is retained until a definitive outcome; matching retries
  reuse its known checkout URL, while unknown outcomes require reconciliation. The FAKE provider stays instant (its INCOMPLETE path is exercised
  only via a seeded row + signed webhook in e2e).
- **Refund calls the provider (shipped, WP-I):** `refundLastCharge` invokes `PaymentsPort.refund()`
  before appending the `REFUND`/`REFUNDED` ledger row; the returned `refundRef` is stored in the row's
  `raw`. Real iyzico refund still needs prod keys (stub throws); fake is a deterministic no-op.
- **Refund ≠ access change (decision):** a refund never alters subscription status/entitlement. To end
  access use the separate **Cancel** action (access until period end).
- **Append-only ledger (§3):** the original charge row is never edited/deleted; net revenue = Σ amounts.
- **Webhook controller needs the raw body** — captured via the json `verify` hook in main.ts (e2e
  mirrors it). Payments e2e `beforeAll` has a 90s timeout (cold compile under load on Windows).
- **Trial-once** = account purchase history excluding INCOMPLETE and SPONSOR rows, plus a verified-phone
  fingerprint that may be used once within twelve calendar months. Expired subscribers still
  re-subscribe without another account trial. Phone-change and account erasure cannot clear an
  unexpired consumed phone fingerprint; unknown pending claims have no automatic expiry.
- **Cancel confirm** — web `/abonelik` uses `useMentorDialog().confirm()` + post-success `info()`;
  dialog copy from `subscription.*` i18n; API errors from backend message.
- **Checkout redirect** (`window.location.assign`) unchanged — provider-hosted flow.

## Backlog

- Real iyzico adapter (createCheckout/cancel/verifyWebhook/**refund**) against sandbox keys (Phase-0
  prod) · CANCELED→reactivate endpoint · outbox for payment events · all-subscriptions list / metrics.

## Related

- Seam: [ai.md](./ai.md) (PremiumGuard), [admin.md](./admin.md) (refund/cancel, STAFF assignment),
  [notifications.md](./notifications.md) (dunning/welcome event consumers)
- Web: `/abonelik`, `/abonelik/sonuc`
- Status: [core/mvp-status.md](../core/mvp-status.md) (W4)
