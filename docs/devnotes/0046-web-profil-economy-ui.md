# 0046 — Web · Profil Economy UI (Earn Hub Slice 1)

> Date: 2026-06-18 · Scope: web `/profil` + `@mentor/types` economy contracts · Related: roadmap §3/§7,
> AGENTS §4 (#3/#4), workstreams W3/W6. Builds on [0032](./0032-w3-web-profil-ui.md),
> [0045](./0045-w3-coin-ai-chat-spend.md), [0021](./0021-w6-light-economy.md).

## What was done
- **Shared types:** `EconomyBalance`, `QuestProgressView`, `InviteCodeView`, `RedeemInviteResult` in
  `packages/types/src/economy.ts`.
- **`lib/economy.ts`:** typed wrappers for `GET balance/quests/invite`, `POST invite/redeem`; `isEconomyDisabled()`.
- **Profil earn hub:** `EconomySection` + balance / quests / invite cards — XP + confirmed coin, onboarding quests,
  invite share + redeem. **`economy.enabled=false` → section hidden** (404 probe on balance).
- **Exam save refetch:** `ExamSettingsCard` `onSaved` bumps `refreshKey` → quests/balance reload (profile-setup quest).
- **`/koc` gate copy:** points to profil earn path; `PAYMENT_PREMIUM_REQUIRED` also gets “Profilime git” CTA.
- **Ledger UI deferred** to slice 2.

## How to use (usage)
```bash
pnpm --filter @mentor/types build
pnpm --filter @mentor/web dev   # http://localhost:3000/profil
# Admin: PATCH /v1/admin/config/economy.enabled { "value": true }
# Then profil shows earn hub; /koc coin path usable when balance ≥ chat cost
```

## Gotchas
- **Coin only on profil hub** (§4 #3) — not in `/koc` composer/transcript; label “Onaylı hak”, not monetary copy.
- **Hidden when flag off** — no dormant card; page looks like pre-0046 profil until admin flips `economy.enabled`.
- **`GET /quests` auto-grants** — refetch after exam save or invite redeem to refresh balance.
- **OpenAPI responses still `void`** — web uses typed `http<T>()` like `coach.ts`.
- **Probe UX:** `probing` state renders nothing (no loading flash when `economy.enabled` is off); parallel `Promise.all` for balance/quests/invite; skip refetch when flag already known off.

## Related files & decisions
- `packages/types/src/economy.ts` · `apps/web/src/lib/economy.ts`
- `apps/web/src/app/(app)/profil/_components/economy-*.tsx`, `profil-shell.tsx`, `exam-settings-card.tsx`
- `apps/web/src/app/(app)/koc/_components/coach-access-gate.tsx`
- Decisions: full earn hub (no ledger v1); hide (not dormant) when economy off.
