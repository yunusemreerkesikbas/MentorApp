# Payments & Subscriptions (`modules/payments` · W4)

> Subscriptions, `EntitlementService` + `PremiumGuard`, serialized paid/trial checkout reservations,
> phone-optional / phone-verified carded trials, `PremiumPaywallModal`, purchase channels, and
> append-only transaction ledger.

---

## 1. Overview & Architecture

`PaymentsModule` owns subscription billing and the global Premium entitlement check (`PremiumGuard` /
`EntitlementService`).

- **State Machine:** `INCOMPLETE` (pending hosted checkout) → `TRIALING` (one carded trial per account/phone) → `ACTIVE` → `PAST_DUE` (access continues for `GRACE_PERIOD_DAYS = 3`) → `CANCELED` (renewal stopped; access continues until `currentPeriodEnd`) → `EXPIRED` (via `subscription_canceled` webhook or the daily `03:30` UTC `expire-subscriptions` cron sweeper).
- **Special Entitlement Paths:**
  - **`STAFF` Role:** Always returns `isPremium: true` (`reason: 'STAFF'`) without creating a `subscriptions` row, keeping financial metrics and trial-once history clean.
  - **Coach-Sponsored Seat (`provider = 'SPONSOR'`, `plan_id = 'coach-seat'`):** Grants `ACTIVE` Premium to a seated student (`priceMinor = 0`, no ledger entry, never consumes the student's own carded trial). Gated by `mentorship.seats.sponsorship_enabled` (`false` until SMS OTP is live).
- **Serialized Checkout Reservations & Phone-Optional Trials (`0120`, `0122`, `0126`):**
  - Paid and trial checkouts lock the `ACTIVE` Identity account, persist the `INCOMPLETE` subscription + promotion reservation + optional phone fingerprint claim *before* provider HTTP, and expose `pendingCheckoutUrl` on `GET /v1/subscription` for safe resumption.
  - `payments.trial.phone_verification_required` (`default: false`) controls whether carded trials require a verified phone or run in account-only mode.
- **Audience × Channel Flags (`APP-096`):**
  - Student: `payments.web.enabled` (`true`), `payments.mobile.enabled`.
  - Coach (`seat_count > 0` plans `coach-plus-5/10/20`): `mentorship.seats.billing_enabled`, `mentorship.seats.mobile_billing_enabled`.
  - Shared: `payments.web.redirect_to_mobile` (renders App Store / Google Play `StoreButtons` when web checkout is off and mobile is on).
- **Paywall & Identity UX (`PremiumPaywallModal`, `PremiumIdentityMark`):**
  - Scoped `.premium-paywall-theme` with asymmetric open/close motion (`250ms` → `150ms`), zero-CLS `PaywallCheckoutSkeleton`, aurora `PREMİUM` pill, 4 live benefit rows (`coach` Puhu chat, `daily`, `analysis`, `plan` — dynamically lifting the triggered feature to row 1), per-month price breakdown + `%N tasarruf` badge, accordion coupon input, and live CTA (focuses consent checkbox if unchecked).
  - Premium users display Puhu's night-blue hero domino mask (`PremiumIdentityMark`) next to their name.

---

## 2. API Surface

| Endpoint | Purpose |
|---|---|
| `GET /v1/plans` | Public active student & coach plans with channel flags (`purchaseEnabled`, `redirectToMobile`) |
| `GET /v1/subscription` | Current entitlement, `features` policy map, `discount`, `trialEligibility`, and `pendingCheckoutUrl` |
| `POST /v1/subscription/offers` | Resolve automatic or coded (`{ code? }`) promotion discounts (`422` on invalid coupon) |
| `POST /v1/subscription/checkout` | Start or resume checkout (`{ planId, code?, useTrial? }`) |
| `POST /v1/subscription/cancel` | Cancel confirmed pending checkout or stop auto-renewal at period end |
| `POST /v1/webhooks/payments` | Raw-body signature-verified provider webhook (`idempotent`) |
| `POST /v1/internal/cron/expire-subscriptions` | Daily `03:30` UTC sweeper retiring naturally ended subscriptions (`SUBSCRIPTION_EXPIRED`) |

---

## 3. Geliştirmeler (Condensed Milestone Timeline)

- **2026-10-25..11-04 — Puhu Hero Mask (`PremiumIdentityMark`), Zero-CLS Paywall Polish & `INVITED` Promotion Seam:** Replaced the crown icon with Puhu's night-blue domino mask (`0140`/DESIGN §7), added `PaywallCheckoutSkeleton` and open/close choreography to `PremiumPaywallModal`, updated paywall copy to name **Puhu** (`yapay zekâ`), and wired `InviteSignalRegistry` + `findInviteOffer` / `previewInviteOffer` for friend-invite discounts.
- **2026-10-02..15 — Serialized Checkout Reservations, Automatic Web Trials & Phone-Optional Trial Switch (`0120–0126`):** Serialized paid/trial reservations under account locks, removed the manual trial/paid toggle (eligible accounts automatically start with the 7-day trial), aligned paywall benefit rows with live web features, and added `payments.trial.phone_verification_required`.
- **2026-09-01..27 — Natural-Expiry Cron Sweeper, Purchase Channel Flags & Coach Seat Plans (`APP-096`):** Added `/v1/internal/cron/expire-subscriptions` (`hasRunOut` vs. `hasLostAccess`), student/coach web-to-store channel flags, `PaymentRefunded.sourcePaymentId` job integration, and `coach-plus-5/10/20` seat plans.
- **2026-07-15..08-30 — W4 Foundation, Paywall Visual Parity & Promotions Wiring (`0015`, `0040`, `WP-I`):** Shipped `PaymentsPort` (`fake`/`iyzico`), `EntitlementService` + `PremiumGuard`, `INCOMPLETE` verification gate, provider refund + `payments.payment.refunded` event, `/abonelik` + `/abonelik/sonuc` overlay, and `PromotionsModule` checkout/webhook pricing integration.
