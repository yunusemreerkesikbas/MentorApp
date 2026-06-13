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

## Code-review fixes (PR #3)
- **(M1, fixed) Seans timer interval leak:** the focus→break transition created a *nested*
  `setInterval` inside a `setState` updater (impure updater + React StrictMode double-invoke leaked a
  second interval). Reworked to a single per-phase ticking effect driven by an absolute end-timestamp
  (`phaseEndsAtRef`); the focus→break roll-over happens in the timer callback (not the effect body),
  cleanup tears the interval down on every phase change/unmount. `?preset=` now seeds `useState`
  directly (dropped the sync `setState`-in-effect; deep-link default only, no live re-sync).
- **(L1, fixed) `as unknown as Dto` casts:** generated client types mutation responses as `void`
  (API DTOs are `type` aliases → no Swagger response schema). Centralized the assertion in typed
  `lib/` wrappers (`study-sessions.ts`, extended `plan-tasks.ts`); components are now cast-free.
  Root fix (Swagger response classes API-wide) → backlog.
- **(unrelated, fixed) Pre-existing branch typecheck breaks** in `profil/notification-settings.tsx`:
  wrong relative import depth for `components/form` (3→4 levels) + `applicationServerKey` typed
  `Uint8Array<ArrayBufferLike>` (now built over a concrete `ArrayBuffer` to satisfy `BufferSource`).
- **Known (not this PR):** repo-wide `void load()` fetch-on-mount pattern trips the strict
  `react-hooks/set-state-in-effect` rule (plan/analiz shells, notification-settings) — pre-existing
  lint debt; resolve as a separate data-fetching refactor.
