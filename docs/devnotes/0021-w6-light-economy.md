# 0021 — W6 · Light Economy (Slice 1: Ledger Substrate + Admin Adjust)

> Date: 2026-06-12 · Scope: api (modules/economy + admin) + admin UI + db · Related: roadmap §3/§10, AGENTS §4 #3, workstreams W6

## What was done
- **`modules/economy` (slice 1 substrate)** — the append-only ledger foundation for the light economy
  (§3: XP reputation + Coin non-monetary → AI right). **Earning automation (quests/invite) and spending
  (→ AI right) are later slices.**
- **`ledger_entries`** (migration `0010`): append-only (id, user_id, unit `XP|COIN`, signed amount,
  reason, status `PENDING|CONFIRMED|REVERSED` default CONFIRMED, ref_type/ref_id, note, created_by,
  created_at). **Balance = sum of rows, never a single number; no UPDATE/DELETE policy ⇒ immutable**
  (§4 #3). RLS: self-read own rows + SERVICE/ADMIN; insert SERVICE/ADMIN. Unique (ref_type,ref_id)
  where ref_id not null → **idempotent** event grants (slice 2).
- **`EconomyService`** (`LedgerRepository` reuses `Currency`/`LedgerStatus` from `@mentor/types`):
  - `grant(userId, unit, amount, opts)` — append-only, idempotent (ref), returns fresh balance.
    `enforceLimits` (default true) on COIN earning → **min-XP (anti-Sybil) + daily/weekly coin caps**
    from the **config registry** (`economy.coin.{daily_cap,weekly_cap,min_xp_for_coin}`, sensitive,
    bounded) → `ECONOMY_LIMIT_EXCEEDED` (422).
  - `getSelfBalance/Ledger` (user-context RLS) · `getAdminBalance/Ledger` (SERVICE).
- **User API** (`/economy/balance`, `/economy/ledger`) — self-scoped, **gated by `economy.enabled`**
  (404 `ECONOMY_DISABLED` when off; the feature is dormant until enabled).
- **Admin manual adjust** (`AdminEconomyController`, admin module imports EconomyModule): 
  `GET /admin/users/:id/economy` (balance + recent ledger) · `POST …/economy/adjust` `{unit,amount,
  reason,note}` → `grant(enforceLimits:false)` (a correction **bypasses caps**), `@Audit('economy.adjust')`
  (before/after balance). Flag-independent (admin tool).
- **Admin UI:** "Ekonomi" card on the user detail page — balance (XP, Coin confirmed/pending) + adjust
  form (unit/amount/reason, SweetAlert2 confirm) + recent ledger. Types in `src/lib/types.ts`.
- Config catalog gained `economy.coin.*` keys (category "economy", sensitive, Zod bounds).

## How to use (usage)
```ts
// System/other modules (slice 2): credit on a verified action, idempotent + capped.
await economy.grant(userId, Currency.COIN, 10, { reason: "invite.converted", refType: "invite", refId });
```
```bash
# Admin: /config → economy.enabled=true → user detail "Ekonomi" → adjust (audited).
```

## Gotchas
- **Caps are rolling windows** (now−24h / now−7d), not calendar — simple, TZ-free; revisit if calendar
  semantics are needed.
- **Admin adjust bypasses caps** (`enforceLimits:false`) — it's a correction; organic earning (slice 2)
  passes the default `true`. Coverage: unit tests exercise the capped path directly.
- **Spending deferred:** no debit-for-AI yet (needs W3). Coin balance accrues; `coinConfirmed` is the
  spendable figure (PENDING reserved for forum reversible coin, Phase 2).
- Migration ordering: `0010` clean (0008 snapshot healed the baseline — see devnote 0018).
- **Guardrail:** never expose coin in a chat zone (§4 #3); ledger never edited/deleted; coin is
  non-monetary (no cash value surfaced anywhere).

## Related files & decisions
- `apps/api/src/modules/economy/**` (ledger.repository · economy.service · economy.controller) ·
  `database/schema.ts` (`ledger_entries`) · `drizzle/0010_w6_economy_ledger.sql`
- `apps/api/src/modules/admin/presentation/admin-economy.controller.ts` · `config.catalog.ts` (economy keys)
- `packages/validation/src/economy.ts` (`economyAdjustSchema`) · `@mentor/types` (`Currency`,`LedgerStatus`)
- `apps/admin/src/app/(general)/users/[id]/page.tsx` (Ekonomi card) · `src/lib/types.ts`
- **Verified:** unit 6 (economy) + 6 (config) + 10 (admin) + e2e 19 (incl. economy disabled-404,
  admin-adjust→user-balance→audit, invalid-400) green; admin typecheck+build green; lint clean; live
  (Claude_Preview) — flag on → adjust +30 COIN → balance/ledger/audit + UI all reflected.
- Decisions: slice 1 = substrate + admin adjust; earning automation + spending = later; ledger global
  per-user (org rollup via users.organizationId); economy config is global (per config-registry decision).

## Code-review findings (fixed / backlog)
- **(F3, fixed) Adjust amount bounds:** `economyAdjustSchema.amount` now bounded to ±`ECONOMY_ADJUST_MAX`
  (1,000,000) — fat-finger guard on admin corrections.
- **(F1, backlog — REQUIRED before slice 2 organic earning):** cap check + append are NOT atomic
  (separate tx) → concurrent organic grants can exceed daily/weekly caps (TOCTOU). Not exploitable now
  (admin adjust bypasses caps). When wiring quests/invite: do check+insert in one tx with a row lock
  (payments `FOR UPDATE` pattern) or accept a small bounded overflow + reconcile.
- **(F5, backlog) Flag on earning:** organic earning listeners (slice 2) must gate on `economy.enabled`;
  admin adjust intentionally bypasses.
- **(F4, backlog) Cap window semantics:** `coinEarnedSince` currently counts admin grants + PENDING coin
  toward the cap window; when earning lands, consider counting only organic CONFIRMED.
- **(F2, Phase 2 design) Reversal vs immutability:** the table is immutable (no UPDATE/DELETE policy) but
  `status` PENDING→CONFIRMED/REVERSED implies a row update. Forum reversible coin (Phase 2) must pick a
  mechanism: **negative compensating entries** (preferred, stays append-only) vs allowing status updates.
