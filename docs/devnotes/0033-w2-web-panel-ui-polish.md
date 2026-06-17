# 0033 — W2 · Web Panel UI polish (`apps/web` /panel)

> Date: 2026-06-16 · Scope: web (apps/web) · Related: DESIGN.md, devnote 0013/0032,
> Profil sprint unlocks countdown. Frontend-only; no API change.

## What was done
- **Shared motion** — [`stagger-motion.ts`](../../apps/web/src/lib/stagger-motion.ts) (`staggerListVariants` /
  `staggerItemVariants`); Profil imports shared util (`profil-motion.ts` removed).
- **`PanelShell`** — framer-motion header fade + grid stagger; `useEffect` fetch pattern (eslint-safe);
  aside/main columns animate in sequence.
- **`CountdownPlaceholder`** — contextual copy; CTA link → `/profil` when `examType` missing; editorial-gap
  message when type set but no calendar seed.
- **`StartSessionCta`** — extracted; primary CTA `Link` with Button tokens (no nested `<button>`).
- **`TodayPlan`** — progress bar pulse on completion change; task list stagger; Nuton chip empty state.
- **`MoodCheckin`** — `SectionHeading`, busy overlay on picker, encouragement message fade-in.

## How to use (usage)
```bash
pnpm --filter @mentor/web dev   # http://localhost:3000/panel
# Set exam type on /profil → countdown card; motion respects prefers-reduced-motion
```

## Gotchas
- **StartSessionCta** uses `<Link>` styled as primary button — valid HTML (no button inside link).
- **TodayPlan** still owns local task state; parent `refreshAfterTaskChange` updates streak/motivational
  line only (task list full sync = backlog).
- **Motion** — `useReducedMotion()` skips stagger/keyframes; shared variants in `lib/stagger-motion.ts`.

## Related files & decisions
- `apps/web/src/lib/stagger-motion.ts`
- `apps/web/src/app/(app)/panel/_components/{panel-shell,countdown-placeholder,start-session-cta,today-plan,mood-checkin}.tsx`
- `apps/web/src/app/(app)/profil/_components/profil-shell.tsx` (shared motion import)
- Decisions: Link-as-CTA for /seans; no `@mentor/ui` skeleton primitive this slice.
