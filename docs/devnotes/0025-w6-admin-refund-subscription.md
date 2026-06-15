# 0025 — W6 · Admin Refund + Subscription View

> Date: 2026-06-15 · Scope: api (admin + payments) + admin UI + packages/validation · Related: roadmap §9/§7,
> AGENTS §4, workstreams W6/W4, builds on payments [0015](./0015-payments.md)

## What was done
- **Admin subscription view + actions** on the user-detail page: a user's subscription/trial state +
  entitlement + billing ledger, plus two **audited** actions — a **record-only refund** and a **cancel**.
  Mirrors the economy admin panel (per-user, audited, consumes another module's public service).
- **payments module (W4, additive):** `SubscriptionsService` gained `getAdminView(userId)`
  (subscription + plan + entitlement + recent transactions; reuses `getView`) and
  `refundLastCharge(userId, amountMinor, reason, actorId)`. Cancel **reuses** the existing
  `SubscriptionsService.cancel`. `PaymentEventsRepository.listForUserAdmin` (SERVICE context) added.
  `PaymentsModule` now **exports `SubscriptionsService`**.
- **admin module (W6):** `AdminSubscriptionController` (`@Roles(ADMIN)` + `AdminAuditInterceptor`,
  `imports: [PaymentsModule]`):
  - `GET /admin/users/:userId/subscription` → `getAdminView` ·
  - `POST …/refund` — `@Audit('subscription.refund')` ·
  - `POST …/cancel` — `@Audit('subscription.cancel')`.
- **Validation** (`@mentor/validation/payments.ts`): `adminRefundSchema` (`amountMinor` positive int,
  `reason` required). Error codes `PAYMENT_REFUND_NO_CHARGE`, `PAYMENT_REFUND_EXCEEDS_CHARGE` (+ TR/EN).
  Audit: `SUBSCRIPTION_REFUND`/`SUBSCRIPTION_CANCEL` + `AuditTargetType.SUBSCRIPTION`.
- **Admin UI (TS):** user-detail `Abonelik` kartı — durum badge, plan/fiyat, trial/dönem sonu, entitlement;
  iade formu (kuruş + sebep, son charge varsa) + iptal butonu + işlem geçmişi tablosu (refund = negatif/kırmızı).

## How to use (usage)
```bash
# ADMIN: /users/:id → Abonelik kartı. İade: tutar (kuruş) + sebep → onay. İptal: tek tık + onay.
# API: GET /v1/admin/users/:id/subscription · POST …/refund {amountMinor,reason} · POST …/cancel
```

## Gotchas
- **Record-only refund (decision):** appends a `REFUND`/`REFUNDED` ledger row with **negative
  `amountMinor`**; the iyzico refund API is **not** called (adapter unverified, no prod keys). The actual
  money movement is done manually in the provider panel until `PaymentsPort.refund()` is wired (backlog).
- **Refund ≠ access change (decision):** a refund never alters subscription status/entitlement. To end
  access use the separate **Cancel** action (reuses `subscriptions.cancel` → access until period end).
- **Append-only ledger (§3):** the original charge row is never edited/deleted; net revenue = Σ amounts.
- **Refund cap:** server caps to `lastSuccessfulCharge − Σ priorRefunds(sameSubscription)`; partial refunds
  allowed; over-cap → 400 `PAYMENT_REFUND_EXCEEDS_CHARGE`; no charge → 409 `PAYMENT_REFUND_NO_CHARGE`.
- **Atomic refund (review M1):** `refundLastCharge` runs read → `SELECT … FOR UPDATE` on the subscription →
  re-read cap → append in ONE `withServiceContext` tx, so concurrent refunds can't race the cap (TOCTOU).
- **Idempotency:** like economy adjust, no `Idempotency-Key` (FE busy-flag + the row lock guard double-submit;
  each refund gets a unique synthetic `providerEventId = admin-refund:<uuid>`). Idempotency-Key header = backlog.
- **RLS:** admin reads use `getView` (target user-context) + `listForUserAdmin` (SERVICE). Local `mentor`
  superuser bypasses RLS — verify on Neon/prod. **No migration** (tables + `TxType.REFUND`/`TxStatus.REFUNDED`
  exist since 0015/0003).
- **STAFF entitlement:** `getAdminView` doesn't pass `rolesHint`, so STAFF-role-based premium isn't
  reflected in the entitlement line; roles are shown on the same page — acceptable.
- **`@Roles(ADMIN)` only** (not EDITOR) — money/access actions are admin-only (fine FINANCE sub-role = backlog).

## Related files & decisions
- `apps/api/src/modules/admin/presentation/admin-subscription.controller.ts` · `admin.constants.ts` · `admin.dto.ts` · `admin.module.ts`
- `apps/api/src/modules/payments/application/subscriptions.service.ts` (`getAdminView`, `refundLastCharge`) ·
  `infrastructure/payments.repositories.ts` (`listForUserAdmin`) · `payments.module.ts` (export)
- `packages/validation/src/payments.ts` (`adminRefundSchema`)
- `apps/admin/src/app/(general)/users/[id]/page.tsx` (Abonelik kartı) · `lib/types.ts` (AdminSubscriptionView/Tx)
- **Verified:** e2e 7 (403 non-admin; GET view; refund over-charge 400; partial refund −amount + audit;
  cumulative cap 400; no-charge 409; cancel→CANCELED + audit); api lint+typecheck, admin typecheck+build green.
- Decisions (owner): record-only refund (no provider call); refund + separate cancel; admin-entered amount capped to last charge.

## Backlog
- `PaymentsPort.refund()` + real iyzico refund (Phase-0 prod). · `Idempotency-Key` on refund.
- All-subscriptions list / metrics. · Fine admin sub-roles (FINANCE). · CANCELED→reactivate.
