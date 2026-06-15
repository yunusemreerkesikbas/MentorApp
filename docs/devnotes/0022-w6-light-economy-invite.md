# 0022 — W6 · Light Economy Slice 2a (Invite → Conversion → Coin)

> Date: 2026-06-13 · Scope: api (modules/economy + admin) + admin UI + db · Related: roadmap §3, workstreams W6, devnote 0021

## What was done
- **First organic earning path** (§3 MVP "davet → dönüşürse coin"). Least coupling: consumes the
  existing `payments.subscription.activated` event; **no change to identity/payments**.
- **Schema** (migration `0013`): `invites` (inviter_user_id PK, unique code) + `invite_redemptions`
  (invited_user_id **unique**, status PENDING→CONVERTED). RLS: invites self-read (inviter)+SERVICE/ADMIN;
  redemptions SERVICE/ADMIN.
- **InviteService**: `getOrCreateCode` (stable per user) · `redeem(invited, code)` with guards —
  invalid code (`INVITE_CODE_INVALID` 404), self (`INVITE_SELF` 400), already redeemed (unique →
  `INVITE_ALREADY_REDEEMED` 409), **already premium** (via payments `EntitlementService` →
  `INVITE_ALREADY_PREMIUM` 409) · `onInvitedConverted` (listener path): flip PENDING→CONVERTED
  (`update … where status=PENDING` → idempotent) + reward the inviter via `EconomyService.grant`
  (reason `invite.converted`, refId=redemptionId, **enforceLimits:true**).
- **Listener** `InviteEventsListener @OnEvent(SUBSCRIPTION_ACTIVATED)` — gated by `economy.enabled` (F5).
- **User API** (flag-gated): `GET /economy/invite` → `{code}` · `POST /economy/invite/redeem` → `{status}`.
- **Admin visibility:** `GET /admin/users/:id/economy` overview now includes `invite {code,invited,converted}`;
  shown on the user-detail Economy card. Reward also appears in the ledger as `invite.converted`.
- **Config:** `economy.invite.reward_coin` (default 20, sensitive, bounded).
- **F1 fix (from devnote 0021):** `EconomyService.grant` enforced-COIN path now runs cap-check + append
  in ONE `withServiceTx` transaction (LedgerRepository methods take an optional `exec` tx) — closes the
  TOCTOU race now that organic earning is live. Advisory-lock = backlog.

## How to use (usage)
```bash
# Flag on (/config economy.enabled). Inviter: GET /v1/economy/invite → share code.
# Invited (new, non-premium): POST /v1/economy/invite/redeem {code} → PENDING.
# Invited subscribes → payments.subscription.activated → inviter gets reward_coin (once).
```

## Gotchas
- **Forward-only:** reward fires only on a conversion AFTER redeem. Premium-at-redeem is rejected; a
  user already subscribed before redeeming simply has no future activation to convert.
- **Idempotent twice over:** redemption status guard (`PENDING` only) + ledger `refId` unique → a
  replayed/duplicate `subscription.activated` never double-rewards.
- **Reward is capped** (slice-1 caps + min-XP via enforceLimits) — mass-invite abuse is bounded.
- **Migration journal ordering:** another track shipped 0011/0012 with **future `when` timestamps**
  and **missing snapshots**; drizzle's migrator skips an entry whose `when` ≤ the last applied. Fixed by
  (a) trimming the auto-generated 0013 to only the invite tables (0008-style), and (b) bumping 0013's
  journal `when` past 0012. **Lesson:** when generating after another track, check `meta/_journal.json`
  ordering + that prior snapshots exist.
- Churn/refund reversal of the invite reward = Phase 2 (negative compensating entry).

## Related files & decisions
- `apps/api/src/modules/economy/{application/invite.service,application/invite-events.listener,infrastructure/invite.repository}.ts`
- `economy.controller` (invite endpoints) · `economy.module` (imports PaymentsModule, exports InviteService)
- `admin/presentation/admin-economy.controller.ts` (invite in overview) · `config.catalog.ts`
- `database/schema.ts` (invites/invite_redemptions) · `drizzle/0013_w6_invites.sql`
- `packages/validation/src/economy.ts` (`redeemInviteSchema`) · `apps/admin/.../users/[id]/page.tsx`
- **Verified:** unit (invite 6, economy 6 incl. tx-grant) + e2e 5 (code/self/unknown/double-redeem;
  conversion rewards once, replay no double) green; admin typecheck+build, api lint green; live API smoke
  (code gen, premium-guard, self-guard, admin summary).
- Decisions: reward = inviter only; conversion = subscription.activated (carded trial incl.); redeem
  forward-only + new-user; code entry post-signup (identity untouched). Web user-facing invite UI = separate track.

## Code-review fixes / backlog (4-lens review: architect/backend/frontend/code-reviewer)
- **(F1, fixed) Listener resilience:** `onInvitedConverted` marks CONVERTED (a fact) then rewards
  best-effort — a coin-cap denial is the abuse shield (info log, swallowed), other failures are logged
  (not thrown) so the event listener never throws uncaught. Conversion+reward are NOT atomic by design.
- **(F2, fixed) Redeem race:** `createRedemption` uses `onConflictDoNothing().returning()`; the service
  maps the empty result to `INVITE_ALREADY_REDEEMED` (409) — concurrent double-redeem no longer 500s.
- **(F3, fixed) Code entropy:** invite code now `randomBytes(6)` (12 hex) — lower collision risk.
- **(F4, backlog/note) Coupling:** economy imports PaymentsModule for the `EntitlementService` premium
  check (sanctioned public contract). Could drop to event-only if tighter decoupling is wanted.
- **(F5, process) Cross-track migrations:** 0011/0012 shipped without snapshots + with future `when`
  timestamps → manual journal/SQL fix needed for 0013. Team rule: commit migration **with** its snapshot,
  real timestamps. Reward reconcile on transient grant failure (outbox/retry) = Phase 2 (§3).
