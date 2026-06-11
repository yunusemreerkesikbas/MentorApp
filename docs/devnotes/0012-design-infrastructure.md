# 0012 — Design Infrastructure (UI kit + responsive shell)

> Date: 2026-06-10 · Scope: @mentor/ui + apps/web · Related: DESIGN.md §6–§9

## What was done
- **@mentor/ui became a React component library** (react peer dep, react-library tsconfig):
  `Button / TextField / Card / Chip / ProgressBar / BackgroundBlobs` — built from DESIGN.md §6
  pixel-exact specs (Figma node ids cited in each component). Tokens (`theme.css` + `tokens.ts`) unchanged.
- **Fonts:** next/font League Spartan (headings) + Lato (body), **latin-ext** subsets → Turkish glyphs
  covered, self-hosted; wired via `--font-heading`/`--font-body` CSS vars.
- **Responsive app shell** (`app-nav.tsx` + `(app)/layout.tsx`): bottom tab bar (mobile, Nuton spec)
  ↔ **left sidebar ≥ 1024px** (DESIGN.md §8). Nav: Anasayfa·Plan·Analiz·Bilgi·Profil (§9), inline
  Feather-style icons, active `--color-main` / inactive `--color-secondary`.
- Placeholder pages for `/plan /analiz /bilgi /profil` (ComingSoon) — those routes belong to W1/W2;
  tracks replace the content, the shell stays.
- Auth screens/components refactored onto the primitives; decorative `BackgroundBlobs` on the root layout.
- `@source "../../../../packages/ui/src"` in `globals.css` → Tailwind scans the package source.

## How to use (usage)
- New screens: compose `@mentor/ui` primitives; never hand-roll buttons/fields/cards (no magic numbers).
- Adding a primitive: follow DESIGN.md §6 spec, cite the Figma node id in the JSDoc, export from `src/index.ts`.

## Gotchas
- **Figma MCP:** the desktop Dev Mode server is enabled, but this session's MCP client connected before
  that → live Figma needs the NEXT Claude session. Infra was built from DESIGN.md (extracted from the
  same file); first live session should produce the screen-mapping table (DESIGN.md §10).
- Utility classes used inside `@mentor/ui` require the `@source` directive in each consuming app's CSS
  (admin will need the same line when it adopts the kit).

## Related files & decisions
- `packages/ui/src/**` · `apps/web/src/components/{app-nav,form,coming-soon}.tsx` ·
  `apps/web/src/app/{layout,(auth)/layout,(app)/layout}.tsx` · DESIGN.md §10–§11
- Decision: UI/UX = **Option A** (adapt Nuton in code); breakpoints `lg`=1024 sidebar switch.
