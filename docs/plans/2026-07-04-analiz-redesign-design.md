# Analiz Page Redesign — Design (2026-07-04)

> Scope: `/analiz` — 3-mod insight-first layout (Gir / Gelişim / Yanlışlarım). Guardrail-bound:
> **personal progress only, no exam ranking, net computed server-side, photo categorizes never solves** (AGENTS §4).

## Decisions

- **Layout:** sticky summary band + segmented control + tab panels; URL `?tab=gir|gelisim|yanlislar` (default `gir`).
- **Gauge:** personal record distance from `ghost` + `trend[]` (Phase 1 FE); `personalRecordNet` from API (Phase 2).
- **Aesthetic:** DESIGN.md Nuton — light, pastel blobs, violet chip, `#55ACEE` progress — not dark/neon BI dashboards.
- **Removed:** persistent "Deneme kaydedildi" card, ProgressBar trend list, "Panele dön" link (main nav tab).
- **Coach bridge:** `/koc/chat?seed={i18n}` (Phase 1); optional `contextMockExamId` on chat (Phase 2 backlog).

## Phasing

- **Phase 1 — frontend only:** shell refactor, 3 tabs, form table + validation + toast, history list/drawer, sparkline, record gauge, ghost teaser, photo UX polish, skeleton, i18n.
- **Phase 2 — small backend:** `publisher_name` on mock exams + form fields; `personalRecordNet` on `GET /coaching/analysis`.
- **Phase 3 — epic (separate):** OCR auto-fill, weekly AI summary, delete/edit attempts, subject time series, plan integration.

## Visual assets (optional)

| Asset | Path | Prompt keywords |
|-------|------|-----------------|
| Hero bg | `apps/web/public/analiz/analiz-hero-bg.png` | soft light mobile hero, white base, blurred pastel blobs #9BC1FB #BDEBFF #FF2DAB 25%, top 45% empty, calm exam prep, no dark/neon |
| Empty state | `apps/web/public/analiz/analiz-empty-first.png` | minimal flat student entering scores, violet #BEA1FE blue #55ACEE, encouraging, no trophy |

CSS blob fallback when PNGs absent (see `analiz-hero-backdrop.tsx`).

## Guardrail checklist

- [ ] Net never computed on FE (display API values only)
- [ ] No cross-user ranking or percentile on this page
- [ ] Photo flow categorizes only — no solution copy
- [ ] Calm copy — no alarm-red shaming for low scores
- [ ] DESIGN tokens only; a11y (contrast, focus, 44px touch, reduced-motion)

## Related files

- Web: `apps/web/src/app/[locale]/(app)/analiz/_components/*`
- API: `apps/api/src/modules/coaching/*` (Phase 2)
- Feature doc: `docs/features/coaching.md`
