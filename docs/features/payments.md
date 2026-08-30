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
| `POST /v1/subscriptions/checkout` | Start checkout (consent required) |
| `POST /v1/webhooks/payments` | Provider webhook (raw body, signature-verified) |
| `GET /v1/subscriptions/current` | Subscription view + entitlement |
| `POST /v1/subscriptions/cancel` | Cancel (access until period end) |

## Geliştirmeler (timeline)

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
  `use-daily-greeting.ts`, `mood-checkin.tsx`, `analysis-ghost-teaser.tsx`,
  `session-done-state.tsx`.
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

## Gotchas / Known issues

- **`GET /v1/subscription` has no remaining quota** — payments must not read `ai_usage`. The
  client treats a surface as unlocked when `isPremium || features[id].freeEnabled`; exhausted free
  caps return `PAYMENT_PREMIUM_REQUIRED` on the action.
- **iyzico adapter is UNVERIFIED** — fails loudly until Phase-0 sandbox keys. **Prod lock:** `fake`
  forbidden in production (env validation at boot). `createCheckout`/`cancel`/`verifyWebhook`/`refund`
  all `notVerified()` until the real HTTP + HMAC-SHA1 mapping lands with sandbox creds.
- **Verification gate (shipped, WP-I):** hosted-page providers create an INCOMPLETE row at
  checkout-INIT; only `checkout_completed` activates it (INCOMPLETE→TRIALING/ACTIVE by the row's
  `trialEndsAt`). INCOMPLETE grants no premium (`computeEntitlement` → `free("INCOMPLETE")`). An
  abandoned INCOMPLETE row is **deleted** on the next checkout (not expired) so the user isn't locked
  out and trial-once stays intact. The FAKE provider stays instant (its INCOMPLETE path is exercised
  only via a seeded row + signed webhook in e2e).
- **Refund calls the provider (shipped, WP-I):** `refundLastCharge` invokes `PaymentsPort.refund()`
  before appending the `REFUND`/`REFUNDED` ledger row; the returned `refundRef` is stored in the row's
  `raw`. Real iyzico refund still needs prod keys (stub throws); fake is a deterministic no-op.
- **Refund ≠ access change (decision):** a refund never alters subscription status/entitlement. To end
  access use the separate **Cancel** action (access until period end).
- **Append-only ledger (§3):** the original charge row is never edited/deleted; net revenue = Σ amounts.
- **Webhook controller needs the raw body** — captured via the json `verify` hook in main.ts (e2e
  mirrors it). Payments e2e `beforeAll` has a 90s timeout (cold compile under load on Windows).
- **Trial-once** = "has the user EVER had a subscription row"; expired users re-subscribe without trial.
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
