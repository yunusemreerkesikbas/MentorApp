# 0044 — W2 · Seans circular timer + custom duration (`/seans`)

> Date: 2026-06-18 · Scope: web (`apps/web`), `@mentor/ui`, API coaching · Related: [0037](./0037-w2-web-plan-seans-ui-polish.md), DESIGN.md

## What was done
- **`CircularTimerRing`** in `@mentor/ui` — SVG progress ring, drag/touch dial (5–120 dk, 5 dk steps), keyboard +/-, `setup` vs `countdown` modes.
- **`/seans` refactor** — ring-centered layout; preset chips snap dial; **Duraklat/Devam**; zorunlu mola fazı kaldırıldı (mola = kullanıcı duraklatması).
- **API** — `preset: "custom"` + `focusMinutes`; `study_sessions.planned_focus_minutes` column (migration `0016`).

## How to use (usage)
```bash
pnpm --filter @mentor/ui build   # after UI changes
pnpm --filter @mentor/api db:migrate   # applies 0016_study_sessions_planned_focus.sql
pnpm --filter @mentor/web dev
# http://localhost:3000/seans
# Deep links: /seans?preset=50_10 · /seans?minutes=35
```

**Start session API:**
- Fixed preset: `{ "preset": "25_5" }`
- Custom dial: `{ "preset": "custom", "focusMinutes": 35 }` → response includes `plannedFocusMinutes: 35`

## Gotchas
- **Dial locked during active session** — only pause/complete/abandon; prevents accidental duration change.
- **Timer at 0** does not auto-finalize — user must tap **Seansı bitir** (streak = conscious complete).
- **`focusElapsed` pauses** with the timer; does not increment after countdown hits 0.
- **Migration required** before custom preset in production; e2e assumes column exists.
- **Preset chips** still show break labels (`25/5 dk`) for familiarity; break phase is no longer enforced in UI.

## Related files & decisions
- `packages/ui/src/components/circular-timer-ring.tsx`
- `apps/web/src/app/(app)/seans/_components/{seans-shell,session-timer-ring,session-controls,session-done-state,use-session-timer}.tsx`
- `packages/validation/src/coaching.ts`, `apps/api/src/modules/coaching/application/session.service.ts`
- Decision: no forced Pomodoro break — user-controlled pause; ambient sound deferred to Phase 2.
