# 0038 — W2 · Web Analiz UI polish (`apps/web` /analiz)

> Date: 2026-06-16 · Scope: web (apps/web) · Related: [0022](./0022-w2-mock-exam-analysis.md),
> [0033](./0033-w2-web-panel-ui-polish.md), DESIGN.md. Frontend-only; no API change.

## What was done
- **`AnalizShell`** — header fade + staggered sections; eslint-safe load (`LoadState` union, no sync
  setState in effect); `needs_exam_type` gate with CTA → `/profil` (not error-only).
- **Last result** — Nuton chip badge + `AnimatePresence` enter; net from API only (unchanged rule).
- **Trend** — always-visible card with chip empty state; staggered `ProgressBar` rows; calm subtitle
  (no ranking).
- **Subject averages** — row hover surface; tabular nums for nets/counts.
- **No exam seed** — editorial-gap empty state (calendar/subjects missing).
- **Nav** — “Panele dön” link with 44px touch target.

## How to use (usage)
```bash
pnpm --filter @mentor/web dev   # http://localhost:3000/analiz
# Set examType on /profil → form loads; POST saves mock exam → trend updates
```

## Gotchas
- **Net never computed on FE** — display `totalNet` / trend values from API only (0022).
- **Trend UI** still `ProgressBar` bars — no chart library (by design).
- **`LoadState`** separates `needs_exam_type` from API errors for clearer UX.

## Related files & decisions
- `apps/web/src/app/(app)/analiz/_components/analiz-shell.tsx`
- Decisions: mirror Panel/Plan motion + chip empty states; exam-type gate matches CountdownPlaceholder CTA pattern.
