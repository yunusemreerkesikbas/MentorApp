# Leaderboard / Effort Board Redesign — Design (2026-07-04)

> Scope decided with the user (frontend-design + ui-ux-pro-max + web-design-guidelines + ponytail +
> brainstorming). Feature: `topluluk` effort board ("Emek Panosu" → `EffortBoard`). Guardrail-bound:
> **effort/XP only, never exam results; calm, anti-shaming, no alarm-red, no result ranking** (AGENTS §4).

## Decisions

- **Placement:** new full page `/[locale]/topluluk/siralama` (full podium experience) **+** a compact
  summary in the drawer/right-column with a "Tümünü gör →" link.
- **Aesthetic:** light + calm brand, elevated. Borrow *structure* from references (podium, your-rank
  emphasis, encouraging banner, motion) — **not** dark/neon gaming. DESIGN.md tokens only.
- **Included:** podium (top-3), your-standing card, level ring, weekly-reset countdown, encouraging
  banner, real avatars + percentile band.
- **Deferred (Phase 3):** Today/Week/All-time tabs, ▲▼ rank-movement arrows (need history snapshot).

## Phasing

- **Phase 1 — frontend only (no backend).** Uses existing `GET /v1/community/summary`.
  - Route `topluluk/siralama/page.tsx` (thin server) → `LeaderboardScreen` (client, fetches summary).
  - Header (← back · "Sıralama" · exam chip · weekly-reset countdown pill).
  - Encouraging banner (positive framing from `me.rank`; generic until percentile lands).
  - Podium top-3 (#1 centre, crown, calm gold/silver/bronze rings; initials avatars for now).
  - Your-standing card (rank, avatar, XP, mini level ring, "Sen").
  - Full ranked list (refined `Row`), reuse `StatSnapshot` + `BadgeStrip` for level/badges.
  - Motion: one orchestrated entrance (framer-motion, already a dep), `prefers-reduced-motion` safe.
  - Compact: "Tümünü gör →" link added to `EffortBoard`.
  - i18n: `topluluk.rank_*` keys (tr + en).
- **Phase 2 — small backend (2 changes).**
  1. `LeaderboardEntry.avatarUrl?: string | null` — `economy.getXpLeaderboard/getXpStanding` join
     `users.avatar_storage_key` → resolve URL (UsersService avatar logic). Update `@mentor/types`
     (`packages/types/src/community.ts`) + regen openapi/api-client.
  2. `LeaderboardView.totalParticipants: number` — count of distinct XP earners in the window →
     percentile `(total - rank) / total` computed client-side for the encouraging band.
- **Phase 3 — larger backend (separate).** Window switch (today/all-time) + previous-rank snapshot
  table for ▲▼ (frame ▼ gently to stay anti-shaming).

## Tokens / colours

Palette: `--color-main / --color-secondary / --color-cta / --color-chip / --color-progress`,
`--font-heading` (League Spartan), `--shadow-card`, `--color-focus-ring`. Medal accents (muted):
gold `#C9A227`, silver `#9AA3AF`, bronze `#BA7517`. No new magic numbers.

## AI background (optional, user opted in)

Podium atmosphere image → `apps/web/public/leaderboard/podium-bg.png` (9:16 + 16:9), light/airy,
top ~40% empty for text, feathered edges. Prompt captured in chat.

## Guardrail checklist (binding)

- [ ] XP/effort only — no net/exam ranking anywhere.
- [ ] All copy encouraging; low ranks framed positively; no red/alarm.
- [ ] ▼ movement deferred; if added later, gentle framing.
- [ ] Loading / empty (no XP this week) / economy-off / error states covered.
- [ ] DESIGN tokens only; a11y (contrast, focus, 44px touch, reduced-motion).
