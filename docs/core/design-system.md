# Design System & `@mentor/ui` Package

> Architecture and usage guide for `@mentor/ui` and `apps/web` styling.
> Full visual specification (tokens, colors, typography, scenes, motion): **[`DESIGN.md`](../../DESIGN.md)**.

---

## 1. Single Source of Tokens

All design tokens are defined as CSS custom properties in [`packages/ui/src/theme.css`](../../packages/ui/src/theme.css) and imported by `apps/web/src/app/globals.css` (Tailwind v4 `@theme` bridge).

- **Typography:** **Nunito** (`--font-sans`, variable `200–1000`, `latin-ext`) for UI and display; **Caveat** (`--font-hand`, `600/700`) for taped paper notes and handwritten plates.
- **Themes:**
  - **Light (default):** Warm paper canvas (`#FAF6F0`), solid white cards (`#FFFFFF`), border (`#E6DEC8`).
  - **Dark (`html.dark`):** Deep slate canvas (`#0F141C`), card (`#171F2C`), border (`#2A364B`). Toggled via `ThemeLamp` (`mentor:theme` localStorage + `mentor_theme` SSR cookie).
  - **Scoped Scene Themes:** `.landing-city-theme`, `.room-stage`, `.weekly-recap-theme`, `.premium-paywall-theme`, `.achievement-scene-theme`, `.plan-coach-night`, and `.weekly-chest-night` lock their own atmospheric palettes and ignore `html.dark`.

---

## 2. Shared Primitives (`@mentor/ui`)

Exported from [`packages/ui/src/index.ts`](../../packages/ui/src/index.ts):

| Primitive        | Description                                                                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`         | Tactile buttons (`primary` sky-blue play-ledge `#55ACEE` with `4px` `#3B8FD0` bottom edge and `#0F2233` navy ink; `secondary` / `outline` / `ghost` / `danger`). Min `44px` touch height. |
| `Card`           | Solid `--color-surface` container (`20px` radius, `1px` `--color-border`, optional interactive hover lift).                                                                               |
| `Chip`           | Pill badge (`rounded-full`, `12px` semibold) for statuses, exam families, and tags.                                                                                                       |
| `Field`          | Label + input wrapper (`14px` inner radius, focus ring, `aria-describedby` error wiring).                                                                                                 |
| `SubmitButton`   | Form submit button with loading spinner and disabled guard.                                                                                                                               |
| `FormError`      | Accessible alert banner (`role="alert"`) for Companion-register form errors.                                                                                                              |
| `SectionHeading` | Standardized section header (`17px–18px` bold) with optional subtitle and right-aligned action slot.                                                                                      |
| `Logo`           | Typographic **`PuhuKoç`** mark in Nunito weight `1000` with Puhu's animated/blinking eye in the `o`.                                                                                      |

---

## 3. Core Styling Rules

1. **No magic hex or pixel values:** Always use CSS variables (`var(--color-*)`, `var(--radius-*)`) or their mapped Tailwind classes.
2. **100% Opaque Overlays:** Modals, bottom sheets, dropdowns, and popovers must use solid `var(--color-surface)` — never translucent backgrounds that bleed underlying text.
3. **Solar Iconography:** Use Solar Linear at rest and Solar Bold for active/selected states. Keep glyphs bare (no unnecessary pastel tile boxes).
4. **Zero-CLS Loading:** Pair every client-fetched view with a dimensionally matched skeleton (`animate-pulse` on `--color-surface-alt`).
5. **Reduced Motion:** Always honor `prefers-reduced-motion: reduce` (`useReducedMotion()` in Framer Motion, or CSS `@media (prefers-reduced-motion: reduce)`).
