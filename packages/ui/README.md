# @mentor/ui

The shared **design system** — DESIGN.md (Nuton-based) tokens from a single source.

- `theme.css` — Tailwind v4 `@theme` (web/admin `@import "@mentor/ui/theme.css"`).
- `tokens.ts` — framework-agnostic TS (later RN/mobile uses the same source).
- UI primitives (Button/Card/Field — DESIGN.md §6) added later.

**Rule:** no magic numbers; all UI values come from here. Canonical guide: [`../../AGENTS.md`](../../AGENTS.md).
