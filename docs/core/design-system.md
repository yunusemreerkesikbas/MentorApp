# Design System (`@mentor/ui`)

> The shared UI primitive library + DESIGN.md token implementation. Package: `packages/ui`.
> Token source of truth: [`DESIGN.md`](../../DESIGN.md). Applied by all B2C web screens.

## Overview

`@mentor/ui` is the compiled React primitive library that implements the Nuton/DESIGN.md tokens
(Tailwind v4 `@theme` + TS). Every feature's web UI imports from it — no magic hex/numbers in feature
code, only CSS-var tokens. The package is consumed as **compiled `dist/`** (not source), so it must be
rebuilt before `apps/web` typecheck sees new exports.

## Architecture (key decisions)

- **Tokens, not numbers:** colors/spacing/radius/typography come from `theme.css` (`@theme`) → CSS vars.
  Thumb pastels are the only accepted hex outside the token file (DESIGN accents).
- **Fonts:** Nunito Sans latin-ext (Turkish glyphs), loaded once in the root layout.
- **Responsive shell:** mobile tab bar (63px + safe-area inset) ↔ desktop sidebar; the same primitives
  adapt. Active nav = main-color indicator, not accent fill (anti-alarm per §0).
- **Motion:** shared `stagger-motion.ts` (stagger + `useReducedMotion`) reused across hero/features/CTA
  and card entrances — no per-screen motion code.
- **Data cards (§4 #1):** official facts (dates) render in a **data card** (source + verification
  metadata), never paraphrased — `DataCard` is the primitive that enforces this.

## Tutorials / Guides

```bash
pnpm --filter @mentor/ui build      # REQUIRED before web typecheck sees new/changed exports
pnpm --filter @mentor/web dev       # http://localhost:3000
```

- **Add a primitive:** create `packages/ui/src/components/<name>.tsx`, export from `index.ts`, rebuild.
  Cite its DESIGN.md/Nuton basis in the file. Broadly reusable widgets live here; only stateful
  containers are page-local in `apps/web`.
- **Consume:** `import { Card, Button, Chip, TextField, SectionHeading } from '@mentor/ui'`.

## Primitives (selection)

| Primitive | Purpose |
|---|---|
| `Card` · `Button` · `Chip` · `TextField` · `SectionHeading` | core building blocks |
| `DataCard` | §4 #1 data-card render (official facts, sourced) |
| `CountdownCard` | calm countdown (blue accent — no alarm-red) |
| `StreakBadge` | anti-shaming streak display |
| `PlanListItem` | adapts Nuton list item (335×56) |
| `MoodPicker` | 1–5 radiogroup |
| `ProgressBar` | trend bars (no chart library — DESIGN has no chart primitive) |
| `CircularTimerRing` | SVG progress ring + drag/touch dial (5–120 dk) for `/seans` |
| `FormError` | shared inline error (no magic `--color-error` / hex) |
| `ToastProvider` · `useToast` | Stitch overlay stack (max 3, portal `z-[100]`, auto-dismiss, mobile top-center / desktop top-right) |
| `DialogProvider` · `useDialog` | Stitch modal (single dialog, portal backdrop `z-[60]` / panel `z-[70]`; presets `confirm` / `info` / `promo`) |
| `BottomSheetProvider` · `useBottomSheet` | Stitch bottom sheet (portal backdrop `z-[40]` / panel `z-[50]`; layouts `action` \| `filter`; presets `actionSheet()` / `filterSheet()`) |
| `Skeleton` · `SkeletonGroup` | **Animation-only** loading shimmer (`mentor-skeleton-shimmer`) + enter fade (`mentor-skeleton-enter`); page composes layout in `*-content-skeleton.tsx` |

## Skeleton pattern (animation global · layout per page)

**Rule:** From first paint until the data request resolves, the UI shows a **screen-specific skeleton**
that mirrors the loaded layout. **Animation is global and identical project-wide**; only layout differs
per page.

- **Global (theme.css):** `.mentor-skeleton-shimmer`, `.mentor-skeleton-enter` — shimmer gradient +
  mount fade; static fill under `prefers-reduced-motion`. **Do not reimplement these in app CSS.**
- **Package helpers:** `Skeleton` (applies shimmer class only), `SkeletonGroup` (`role="status"`,
  `aria-busy`), `skeletonStaggerStyle(index)` for row offset, exported class constants
  `MENTOR_SKELETON_SHIMMER_CLASS`, `MENTOR_SKELETON_ENTER_CLASS`.
- **Page-owned:** each feature builds its mirror layout in
  `apps/web/src/app/[locale]/(app)/<feature>/_components/*-content-skeleton.tsx` — sizes, radii, row
  count, card chrome stay local. Wire from shell/view when `loading === true`.
- **Do not** bake screen-specific shapes into `@mentor/ui`; do not use centered spinners for content
  loading (product register).

```tsx
// Page layout (plan-content-skeleton.tsx)
<SkeletonGroup label={t("loading")} className="mt-3 flex flex-col">
  <Skeleton className="h-4 w-[68%] rounded-[var(--radius-card)]" />
</SkeletonGroup>

// Shell (while fetch pending)
if (loading) return <PlanListSkeleton />;
```

## API

N/A (UI package, not REST).

## Geliştirmeler (timeline)

- **Design infrastructure** — `@mentor/ui` React primitives, fonts (latin-ext), responsive shell
  (tab bar ↔ sidebar), DESIGN.md tokens implemented as Tailwind v4 `@theme` + TS. *(0012.)*
- **Typography smoothing** — web now uses one Nunito Sans latin-ext family for both
  `--font-heading` and `--font-body`; this replaces the League Spartan/Lato pair that looked rough
  in dense Turkish UI. Related: `DESIGN.md`, `apps/web/src/app/[locale]/layout.tsx`,
  `packages/ui/src/theme.css`, `packages/ui/src/tokens.ts`. *(2026-07-05.)*
- **Toast overlay primitive** — `packages/ui/src/components/toast/` (`ToastProvider`, `useToast`,
  `ToastItem`, `ToastViewport`); variants `success` | `error` | `info` | `coach`; max 3 stack;
  auto-dismiss + progress bar; tokens `--color-error-container`, `--color-surface-translucent`.
  Web: `ToastProviderShell` in `[locale]/layout.tsx`; feature code uses `useMentorToast()` from
  `apps/web/src/lib/mentor-toast.ts` (i18n dismiss + Puhu/error leading). Supports `duration`,
  `puhuVariant`, and `leading` overrides via `useMentorToast()`. *(0063.)*
- **Dialog / modal primitive** — `packages/ui/src/components/dialog/` (`DialogProvider`, `useDialog`,
  `DialogPanel`, `DialogViewport`); layouts `standard` | `promo`; promise presets `confirm()` →
  `boolean`, `info()` → `void`, `promo()` → `"primary" | "link" | "dismiss"`. Web:
  `DialogProviderShell` nested inside `ToastProviderShell` in `[locale]/layout.tsx`; feature code uses
  `useMentorDialog()` from `apps/web/src/lib/mentor-dialog.ts` (i18n close + error icon / Puhu hero).
  *(0064.)*
- **Bottom sheet primitive** — `packages/ui/src/components/bottom-sheet/` (`BottomSheetProvider`,
  `useBottomSheet`, `BottomSheetPanel`, `BottomSheetViewport`); layouts `action` | `filter`;
  promise presets `actionSheet()` → `actionId | "cancel"`, `filterSheet()` → `"apply" | "cancel"`.
  Mobile: slide-up ~60vh, drag handle, rounded top 16px. Desktop (`lg:`): centered max 480px, no
  handle (DESIGN.md). Web: `BottomSheetProviderShell` inside `DialogProviderShell`; feature code uses
  `useMentorBottomSheet()` from `apps/web/src/lib/mentor-bottom-sheet.ts`. *(0067.)*
- **Skeleton animation primitives** — `packages/ui/src/components/skeleton/` + `theme.css`
  (`.mentor-skeleton-shimmer`, `.mentor-skeleton-enter`). Animation/a11y global; each web screen
  owns `*-content-skeleton.tsx` layout. *(0068.)*

## Gotchas / Known issues

- **`@mentor/ui` is consumed as compiled `dist/`** — after editing/adding a component you **must
  rebuild** (`pnpm --filter @mentor/ui build`) before `apps/web` typecheck picks it up.
- **No chart primitive** in DESIGN.md → trend/analysis UIs use `ProgressBar` bars, not a chart library.
- **Overlay primitives:** `Toast`, `Dialog`, and `BottomSheet` are implemented; `drawer` (notifications
  use a bespoke panel), `popover`, `coach-bubble` still pending or bespoke (Stitch designs in `.stitch/`).
- **`TextField` is single-line** → multi-line input (forum composer) uses a token-styled `<textarea>`.
- **Toast:** rebuild `@mentor/ui` after changes; mount `ToastProvider` once at root (not per layout);
  viewport portals to `document.body` at `z-[100]`; `dismissLabel` is required on raw `useToast().show()`
  — use `useMentorToast()` in web for i18n defaults, `puhuVariant`, and `duration`.
- **Dialog:** single open dialog (no stack); toast stays above dialog (`z-[100]` vs `z-[60]`/`z-[70]`);
  `confirm()` resolves `false` on cancel/ESC (backdrop disabled); use `useMentorDialog()` for i18n +
  default error icon / Puhu hero; `@mentor/ui` requires `react-dom` peer for portal viewports.
- **Bottom sheet:** single open sheet; z below dialog so delete confirm stacks correctly; scroll lock
  via `html.mentor-sheet-open`; desktop uses centered panel (not bottom-anchored); drag handle is
  visual-only in MVP (no swipe dismiss).

## Related

- [`DESIGN.md`](../../DESIGN.md) (token source of truth)
- Standards: [frontend.md](../standards/frontend.md) · [vercel-react-best-practices](../../AGENTS.md)
- Consumers: [web-shell.md](../features/web-shell.md) · all `docs/features/*.md` web sections
- Stitch design bundle: `.stitch/` (overlay prompts)
