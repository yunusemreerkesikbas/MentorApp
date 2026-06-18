# 0037 — W2 · Web Plan + Seans UI polish (`apps/web` /plan, /seans)

> Date: 2026-06-16 · Scope: web (apps/web) · Related: [0033](./0033-w2-web-panel-ui-polish.md),
> DESIGN.md. Frontend-only; no API change.

## What was done
- **`PlanShell`** — header fade + staggered date/tasks sections; Nuton chip empty state; progress bar
  pulse on completion change; task list stagger; “Panele dön” nav link; focus rings on actions.
- **`SeansShell`** — header motion; `AnimatePresence` phase transitions (idle → focus/break → done);
  `SectionHeading` for preset picker; chip tap feedback; timer enter animation; done state with chip
  badge (no emoji); eslint-safe preset fetch (`active` flag); 44px touch links.

## How to use (usage)
```bash
pnpm --filter @mentor/web dev
# http://localhost:3000/plan · http://localhost:3000/seans
# Panel → “Çalışmaya başla” → /seans; plan CRUD on /plan
```

## Gotchas
- **Timer** still client-side between API start/finalize — unchanged from daily-loop slice.
- **Phase animation** uses `AnimatePresence mode="wait"` — reduced-motion skips motion props.
- **Plan empty state** on `/plan` does not duplicate “İlk görevini ekle” CTA (form is below).

## Related files & decisions
- `apps/web/src/app/(app)/plan/_components/plan-shell.tsx`
- `apps/web/src/app/(app)/seans/_components/seans-shell.tsx`
- Decisions: mirror Panel `TodayPlan` empty/progress patterns; encouraging done copy without exclamation overload.
