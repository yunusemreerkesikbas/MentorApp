# Design system evolve (Nuton → Mentor)

**Date:** 2026-07-12 · **Register:** product · **Scope:** system first (pages later)

## Decision

Evolve DESIGN.md and `@mentor/ui` without reinventing Nuton. Keep monochrome palette, Nunito Sans,
black CTA, 10px radius, and the blue-tinted shadow family. Add surface hierarchy, hover elevation,
visual language (Puhu + `visuals/`), rich motion with reduced-motion guardrails, and EmptyState
wiring. Final art is uploaded by design — agents wire paths and placeholders only.

## Locked choices

| Topic | Choice |
|---|---|
| Scope | System first; Panel/Plan/Analiz/Profil redesign = next sprint |
| Nuton | Evolve (not Refresh / Reinvent) |
| Visuals | Hybrid: Puhu companion + subject soft-3D in `public/visuals/` (flat files) |
| Motion | Rich layers (micro/chrome/content/ambient/moment) + mandatory reduced-motion |
| Asset production | Designer uploads; no agent-generated final PNG/WebP |

## Shape

- **DESIGN.md** — surfaces, typography notes (desktop sidebar sentence case, `tabular-nums`),
  `shadow-card-hover`, visual language §, motion scale, empty/loading, asset backlog.
- **Tokens** — `--shadow-card-hover`, `--color-accent-soft`; document `--color-surface-container`.
- **Web** — `PuhuImage` size tokens `sm|md|lg` (40/72/120); `EmptyState`; `public/visuals/` README.
- **BackgroundBlobs** — optional ambient drift; static under `prefers-reduced-motion`.

## Out of scope

- Page layout redesigns
- Generating final art
- Dark mode / new brand hue / font swap
- Per-page rich motion polish (document only this phase)

## Next sprint

Wire `EmptyState` into Plan/Analiz empties; Panel companion moments; page-level motion polish after
`plan-empty.webp` / `analiz-empty.webp` (and missing Puhu variants) land.
