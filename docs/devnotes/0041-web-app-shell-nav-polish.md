# 0041 — Web app shell + nav polish (`apps/web`)

> Date: 2026-06-16 · Scope: web (apps/web) · Related: DESIGN.md §6/§8, B2C UI polish series.
> Frontend-only; no API change.

## What was done
- **`isNavActive`** (`lib/nav-active.ts`) — fixes `/panel` falsely matching `/plan` prefix.
- **`AppNav`** — DESIGN 63px tab bar + safe-area inset; active top indicator (main color, no accent
  fill); sidebar active `bg-white/80`; `aria-current`, focus rings, 44px touch targets; slightly
  bolder active icon stroke.
- **`(app)/layout`** — min-h-screen shell bg; content padding clears tab bar + safe area on mobile.

## How to use (usage)
```bash
pnpm --filter @mentor/web dev
# Authenticated routes — nav visible; /panel vs /plan active states distinct
```

## Gotchas
- **Secondary routes** (`/seans`, `/abonelik`) — not in tab bar; no item highlighted (by design).
- **6 tab items** on mobile — dense but matches product nav; labels truncate on narrow screens.
- Koç remains in nav (product choice; Figma template shows 4 items).

## Related files & decisions
- `apps/web/src/lib/nav-active.ts`
- `apps/web/src/components/app-nav.tsx`
- `apps/web/src/app/(app)/layout.tsx`
- Decisions: prefix-safe active match; Nuton active = `#111` not accent fill.
