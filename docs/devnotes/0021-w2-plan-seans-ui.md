# 0021 — W2 Plan + Seans UI

> Date: 2026-06-13 · Scope: web (`plan`, `seans`) · Related: devnotes 0014, 0013, roadmap W2-a

## What was done
- Replaced `/plan` ComingSoon with full CRUD (list by date, create, toggle done, delete).
- Added `/seans` Pomodoro UI: preset select, client timer, `POST/PATCH study-sessions` finalize.
- `apps/web/src/lib/plan-tasks.ts` — list with `?date=` (generated client omits query param).
- Panel deep link to `/seans` unchanged; optional `?preset=25_5|50_10`.

## How to use (usage)
```bash
pnpm dev   # web :3000 — sign in, visit /plan or /seans
```
- **Plan:** arrow buttons change day; add task form at bottom; Sil removes a task.
- **Seans:** pick 25/5 or 50/10, Başla → API start; Seansı bitir / Erken bırak → PATCH finalize.

## Gotchas
- Plan list uses manual URL for `?date=` until OpenAPI/orval exposes the query param.
- Seans page wraps `useSearchParams` in `<Suspense>` (Next.js requirement).
- Timer is client-side UX only; streak uses `actualFocusSeconds` sent on finalize.

## Related files & decisions
- `apps/web/src/app/(app)/plan/_components/plan-shell.tsx`
- `apps/web/src/app/(app)/seans/_components/seans-shell.tsx`
- `apps/web/src/lib/plan-tasks.ts`
- Decision: reuse `@mentor/ui` PlanListItem/ProgressBar patterns from panel `today-plan.tsx`.
