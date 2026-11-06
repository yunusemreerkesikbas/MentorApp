# Promotions — Coupons, Campaigns & Automatic Discounts (`modules/promotions`)

> Single-winner commercial discount engine for web checkout: welcome coupons, seasonal campaigns,
> consistency rewards (`ACTIVE_DAYS`), win-back offers (`WIN_BACK`), and friend-invite discounts (`INVITED`).

---

## 1. Overview & Product Boundaries

`PromotionsModule` evaluates and reserves subscription discounts without ever reading `payments` or
`coaching` tables directly (callers pass a `PromotionUserContext` and a lazy `activeDates` thunk):

- **Single Promotion Wins (No Stacking):** When multiple automatic or coded promotions match, the highest discount wins.
- **Real Discounts Only (No Fake Strikethroughs):** Strikethrough prices on the paywall represent the actual list price (`list_price_minor`) reduced by a live promotion.
- **No FOMO / No Marketing Spam (`docs/copy/voice.md`):** Validity dates are stated calmly (`"30 Eylül tarihine kadar geçerli"`), never as `"Son şans! / Kaçırma!"`. Campaigns are surfaced in-app via `PromotionDialog` (once per campaign ID, yielding to mood/celebration modals), `TopBanner` (3D cube-flip strip), and optional admin announcements (`/announcements`).
- **Price Invariant (`computeDiscount`):**
  1. Clamped by `promotions.max_percent` (default `50%`, applies to both `PERCENT` and `FIXED` discounts).
  2. Floored by `MIN_CHARGE_MINOR` (`1,00 ₺` = `100` kuruş) so a discounted charge never hits `0 ₺` (which would skip e-Arşiv invoicing).
  3. Frozen on `promotion_redemptions`: `charged_price_minor + discount_minor === list_price_minor` (enforced in TS and DB `CHECK`).

---

## 2. Rule Types (`evaluateRule`)

| Rule Type     | Signal & Qualification                                                                                                                                                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANYONE`      | Any eligible user within the campaign's date window and global/per-user quota.                                                                                                                                                                                                                |
| `NEW_USER`    | Signed up within `ruleParams.withinDays` days.                                                                                                                                                                                                                                                |
| `ACTIVE_DAYS` | Studied on at least `ruleParams.minActiveDays` days within `windowDays` (lazy `StreakService.listActiveDatesSince` thunk).                                                                                                                                                                    |
| `WIN_BACK`    | Former subscriber who has lost Premium access (`lostPremiumAccess: true` via `hasLostAccess`, triggered on `SUBSCRIPTION_EXPIRED`).                                                                                                                                                           |
| `INVITED`     | Redeemed a friend's `PUHU-` invite code within `withinDays` (default `30`), has never paid real money (`!hasPaid`), is not a `COACH`, and holds a verified phone (`phone_fingerprint` quota = once per phone). Fails closed (`PHONE_REQUIRED` / `RULE_UNMET`) if `phoneFingerprint` is falsy. |

---

## 3. Locking & Lifecycle

- **Advisory Resolve vs. Transactional Reserve:** `resolveOffers` advises UI pricing; `reserve` runs inside the checkout transaction under deterministic lock order (**promotion lock → user lock**) so concurrent checkouts never exceed `maxRedemptions` or per-phone quotas.
- **Redemption States:** `RESERVED` (at checkout init) → `APPLIED` (on `checkout_completed` webhook) or `VOIDED` (when an `INCOMPLETE` checkout is canceled, freeing the quota).

---

## 4. API & Configuration

| Endpoint / Config Key                          | Purpose                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `POST /v1/subscription/offers`                 | Resolve best automatic or coded (`{ code? }`) offer per plan (`20/min`, `422` on invalid code) |
| `GET\|POST\|PATCH /v1/admin/promotions{,/:id}` | `FINANCE` campaign CRUD (audited; deactivate via `isActive: false`)                            |
| `promotions.enabled` (`false`)                 | Global kill-switch; when off, all checkouts use list price                                     |
| `promotions.max_percent` (`50`)                | Hard ceiling (%) across all discount types                                                     |
| `promotions.max_discount_periods` (`1`)        | Maximum billing periods a discount can span                                                    |

---

## 5. Geliştirmeler (Condensed Milestone Timeline)

- **2026-10-25..26 — `INVITED` Friend-Invite Rule, `previewByRule` & Fail-Closed Phone Quota (`0130`):** Added the `INVITED` rule with once-per-phone `phone_fingerprint` quota, `PromotionsService.previewByRule` for anonymous `/davet/[code]` previews, coach exclusion, and strict falsy fingerprint checks.
- **2026-09-16..24 — Single Panel Offer Request & Admin Duralux Form:** Deduplicated panel `PromotionOffersView` requests between `PanelShell` and `PromotionDialog`, and aligned `/promotions` admin forms with `FormSection`.
- **2026-08-30..09-02 — Promotions Core (`0090`, `0092`), `ACTIVE_DAYS`, `WIN_BACK`, `TopBanner` & Ticket Modal:** Shipped `promotions` + `promotion_redemptions`, localized admin `eyebrow`/`description` copy, notched ticket `PromotionDialog` (with active-dialog yield and `AnimatePresence` exit), `TopBanner` cube-flip integration, downward currency rounding, and `global-setup.ts` test-DB hygiene.
