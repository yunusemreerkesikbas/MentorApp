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

## Gotchas / Known issues

- **iyzico adapter is UNVERIFIED** — fails loudly until Phase-0 sandbox keys. **Prod lock:** `fake`
  forbidden in production (env validation at boot).
- **iyzico verification gate (F2 TODO):** rows start TRIALING at checkout-INIT — correct for FAKE
  (instant), **wrong for real iyzico** (abandoned payment page must not grant premium). When verifying
  the adapter: start as INCOMPLETE, activate only on the checkout-completed webhook.
- **Record-only refund (decision):** appends a `REFUND`/`REFUNDED` ledger row with negative
  `amountMinor`; the iyzico refund API is **not** called (adapter unverified, no prod keys). The
  actual money movement is done manually in the provider panel until `PaymentsPort.refund()` is wired
  (backlog).
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

- `PaymentsPort.refund()` + real iyzico refund (Phase-0 prod) · `Idempotency-Key` on refund ·
  CANCELED→reactivate endpoint · outbox for payment events · all-subscriptions list / metrics.

## Related

- Seam: [ai.md](./ai.md) (PremiumGuard), [admin.md](./admin.md) (refund/cancel, STAFF assignment),
  [notifications.md](./notifications.md) (dunning/welcome event consumers)
- Web: `/abonelik`, `/abonelik/sonuc`
- Status: [core/mvp-status.md](../core/mvp-status.md) (W4)
