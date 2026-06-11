# 0015 — W4 · Payments (subscriptions + entitlement)

> Date: 2026-06-11 · Scope: api (payments module) + web (/abonelik) + api-client · Related: roadmap §7/§10, workstreams W4

## What was done
- **Schema (0003):** `plans` (seeded, **PLACEHOLDER prices** — Phase-0 WTP pending §12), `subscriptions`
  (state machine + partial-unique: one open sub per user), `payment_transactions` (append-only ledger,
  providerEventId unique), `payment_webhook_events` (idempotency belt). RLS self-read + SERVICE-write.
- **PaymentsPort + dual adapter:** `PAYMENTS_PROVIDER=fake` (dev/test — deterministic checkout, HMAC-signed
  fake webhooks via `signFakeWebhook`) · `iyzico` adapter = **UNVERIFIED skeleton** (fails loudly until
  Phase-0 sandbox keys). **Prod lock:** `fake` in production fails env validation at boot.
- **State machine (webhook-driven, no cron):** checkout→TRIALING (trial **once** per user — returning
  users re-subscribe trial-less) · `payment_succeeded`→ACTIVE+period advance · `payment_failed`→PAST_DUE
  (premium continues `GRACE_PERIOD_DAYS=3`) · cancel→CANCELED (access until period end, idempotent) ·
  `subscription_canceled`→EXPIRED. Domain events: `payments.subscription.activated/canceled`,
  `payments.payment.failed` (W5 consumes).
- **EntitlementService + `PremiumGuard`** exported — W3 gates AI routes with `@UseGuards(PremiumGuard)`
  (403 `PAYMENT_PREMIUM_REQUIRED`, localized).
- **e-Arşiv:** `InvoicePort` + logger stub called on successful charges (real integrator post Phase-0).
- **Web:** `/abonelik` (status card, plan catalog, **explicit trial-consent checkbox** §7, cancel) +
  `/abonelik/sonuc`. EventEmitter backbone registered globally (`@nestjs/event-emitter`).
- **Tests:** entitlement matrix (pure fn), fake-adapter signature, **e2e 11/11 full lifecycle** incl.
  idempotent replay + invalid-signature 401 + trial-once re-subscribe.

- **STAFF entitlement (team/beta premium):** users with the `STAFF` role are always PREMIUM
  (`reason: "STAFF"`, no expiry) **without a subscription row** → billing statistics stay clean and
  trial-once is unaffected. Decision: role-based instead of comp-subscription or a config email list
  (auditable via roles, stats-separable, no redeploy). Assignment **endpoint + audit = W6**; until then:
  ```sql
  begin; select set_config('app.role','SERVICE',true);
  update users set roles = array_append(roles,'STAFF') where lower(email)=lower('kisi@ornek.com');
  commit;
  ```

## How to use (usage)
```bash
pnpm --filter @mentor/api dev    # PAYMENTS_PROVIDER=fake (apps/api/.env)
# web /abonelik → consent → "Denemeyi başlat" → sonuc → Premium
# Simulate provider lifecycle (signed):
#   signFakeWebhook(secret, { type: "payment_failed", providerRef }) → POST /v1/webhooks/payments
```
- Gate a premium route: `@UseGuards(PremiumGuard)` (import from PaymentsModule).

## Code-review fixes (post-implementation)
- **F1 webhook crash-safety:** if applying a verified event fails, the idempotency record is now
  **un-recorded** so the provider's retry isn't swallowed as a duplicate (re-apply is convergent;
  tx ledger dedupes on providerEventId).
- **F3 checkout race:** concurrent double-checkout hitting the partial-unique index now maps to
  `PAYMENT_ALREADY_SUBSCRIBED` (mirrors the signup race fix). `isUniqueViolation` moved to
  `common/errors/postgres-error.ts` (shared with identity — DRY, no cross-module import).
- **F2 (iyzico verification gate, documented TODO):** rows start TRIALING at checkout-INIT — correct
  for FAKE (instant), **wrong for real iyzico** (abandoned payment page must not grant premium).
  When verifying the iyzico adapter: start as INCOMPLETE, activate only on the checkout-completed
  webhook. Code comment at the create site.
- Backlog noted: CANCELED→reactivate endpoint (W6) · outbox for payment events (with W5 consumers).

## Gotchas
- **Fixed a cross-package cycle (coordinated touch on W2 file):** `validation/coaching.ts` imported
  `paginationQuerySchema` from `./index.js` → index↔coaching cycle crashed sync ESM-from-CJS loading
  (`ts-node` exporter AND `node dist/main.js`). Moved the schema to `validation/pagination.ts`; **rule:
  inside a package import from leaf modules, never the barrel.**
- Trial-once = "has the user EVER had a subscription row"; expired users re-subscribe without trial.
- Webhook controller needs the raw body — captured via the json `verify` hook in main.ts (e2e mirrors it).
- Payments e2e `beforeAll` has a 90s timeout (cold compile under load on Windows).

## Related files & decisions
- `apps/api/src/modules/payments/**` · `shared/ports/{payments,invoice}.port.ts` · `drizzle/0003_*.sql`
- `apps/web/src/app/(app)/abonelik/**` · `packages/{types,validation}/src/payments.ts`
