# 0042 — Web B2C UI polish cross-cutting sweep (`apps/web`)

> Date: 2026-06-16 · Scope: web (apps/web) · Related: UI polish series 0032–0041.
> Verification + small consistency fixes; no API change.

## What was done
- **Full verify:** `pnpm --filter @mentor/web typecheck` · `lint` · `build` — all green.
- **`lib/app-shell.ts`** — shared mobile tab bar offset classes (63px + safe-area); used by layout
  and koç composer sticky bar (replaces hardcoded `bottom-16`).
- **Dead code:** removed unused `components/coming-soon.tsx` (all routes now have real screens).
- **Nav regression fix** (0041): `isNavActive` — `/panel` no longer highlights Plan.

## Polish series index (0032–0041)
| Devnote | Route / area |
|---|---|
| 0032 | Profil |
| 0033 | Panel |
| 0034 | Koç |
| 0035 | Landing |
| 0036 | Auth |
| 0037 | Plan + Seans |
| 0038 | Analiz |
| 0039 | Bilgi + landing editorial |
| 0040 | Abonelik |
| 0041 | App shell / nav |

## How to use (usage)
```bash
pnpm --filter @mentor/web typecheck && pnpm --filter @mentor/web lint && pnpm --filter @mentor/web build
```

## Gotchas
- **Economy/invite UI** still backlog — not part of this sweep.
- **Koç composer** sticky offset must stay aligned with `MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS` when tab bar height changes.

## Related files & decisions
- `apps/web/src/lib/{app-shell,nav-active,stagger-motion}.ts`
- `apps/web/src/components/app-nav.tsx`
- `apps/web/src/app/(app)/layout.tsx`
- `apps/web/src/app/(app)/koc/_components/coach-composer.tsx`
