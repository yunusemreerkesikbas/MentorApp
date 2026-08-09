# Vision Board Editor Polish — Design

> Route: `/hedef/pano` (`apps/web/src/app/[locale]/(app)/vision-board/board/`)
> Status: Approved 2026-08-08

## Context

The collage editor (Canva-style chrome: icon rail + detail panel + selection contextual toolbar)
has eight rough edges reported from a live screenshot review: a stray gray panel background,
duplicated frame controls between two surfaces, a layout-shifting contextual toolbar, missing
breathing room, a font picker that silently offers the same face twice, no progress feedback on
async work, no visual list of the images already placed on the board, and no drag-and-drop upload.

This is a polish pass on an existing, working feature — no new routes, no schema changes beyond
`VISION_TEXT_FONTS` gaining three literals (additive, non-breaking: existing saved boards keep
rendering with whatever font key they already have).

## 1. Remove the gray side-panel background

`board-editor-shell.tsx`'s `<motion.aside>` (the detail panel behind the icon rail) sets
`backgroundColor: "var(--color-surface-container)"` (`#F0EDEC`). Change to
`var(--color-surface)` (`#FFFFFF`) so it matches the canvas area; the existing `border-e` hairline
remains the only separation. The icon rail (`<nav>`) already uses `--color-surface` — no change
there.

## 2. Trim the toolbar/panel control duplication

**Diagnosis:** `BoardContextToolbar` (top, appears on selection) and `BoardSidePanel`'s `image`
category (side, opened via rail) both render `VISION_IMAGE_FRAMES` as icon pills — the toolbar
shows the first 3 of 5 plus a separate "Görsel çerçevesi" text button that opens the same panel.
Net effect: the same three options rendered twice with no added function, since opening either one
still requires the side panel for the full set + rotation/opacity sliders.

**Fix:** In `BoardContextToolbar`, replace the "Görsel çerçevesi" text button *and* the 3 inline
`VISION_IMAGE_FRAMES.slice(0, 3)` `ToolBtn`s with a single icon-only trigger (same visual pattern
as the existing text-color `SwatchTrigger`) that calls the existing `onOpenImageFrames` callback.
The side panel remains the single source of truth for the full frame gallery and the
rotation/opacity ranges. No other toolbar controls change — bold/italic/align/color for text and
rotate/opacity/layer/duplicate/delete for both kinds stay, since those have no side-panel
equivalent (they're the toolbar's actual job: fast, always-visible micro-edits).

## 3. Fix toolbar layout shift and width

**Diagnosis:** `BoardContextToolbar` mounts/unmounts via `AnimatePresence` directly inside a
`flex flex-col` container with no reserved space, so the canvas below jumps vertically when a
selection is made or cleared. The toolbar `div` also has no width constraint, so the column's
default `align-items: stretch` pulls it to the full row width — visually it "spans the whole row"
even though its content is much narrower.

**Fix:**
- Wrap the `AnimatePresence` block in a fixed-height container (`min-h-[52px]`, matching the
  toolbar's `h-11` buttons + `py-1` padding) so the reserved space exists whether or not a toolbar
  is currently mounted. No shift on mount/unmount.
- Add `w-fit` + `self-center` (or equivalent) to the toolbar's own class list so it sizes to its
  content and centers in the row instead of stretching. `overflow-x-auto` (already present) keeps
  handling the case where content is wider than the viewport.

## 4. Top breathing room on the left column

Add `pt-4` (DESIGN.md §4 grid step) to the icon rail's `<nav>` and to the detail panel's inner
`Panel` wrapper (`board-side-panel.tsx`), so content doesn't sit flush against the viewport edge.
4px-grid value, no magic number.

## 5. Real, distinct font choices for board text

**Diagnosis:** `VISION_TEXT_FONTS` has 4 literals but only 3 distinct renders today:
- `heading` resolves to `var(--font-heading)`, which `globals.css` aliases straight to
  `var(--font-body)` (both Nunito Sans) — `heading` and `body` are visually identical.
- `script` resolves to `var(--font-script, cursive)`. `--font-script` **is** wired correctly
  (Caveat, loaded via `next/font/google` in `apps/web/src/app/[locale]/layout.tsx`, applied to
  `<html>` via `script.variable`, explicitly scoped "used ONLY inside vision-board text items") —
  this one already works and needs no change.
- `serif` is a hardcoded system stack (`Georgia, 'Times New Roman', serif`) — works, but isn't a
  managed token and isn't a deliberate brand choice for the board.
- `board-export.ts` keeps a **second, parallel** `FONT_FAMILIES` map that the canvas exporter uses
  when drawing the downloaded PNG. It must stay in sync with `board-item-view.tsx`'s `FONT_STACKS`
  by hand (the file's own comments already flag this pattern for frame insets) — both maps are
  touched together in this change.

**Fix — expand to 7 distinct, Turkish-safe (`latin-ext`) Google Fonts**, following the exact
pattern already established for Caveat (root layout `next/font/google` call, own `--font-*`
variable, applied via `<html>` className, "vision-board only" comment):

| `VISION_TEXT_FONTS` key | Font | TR label | Status |
|---|---|---|---|
| `body` | Nunito Sans | Düz | unchanged |
| `heading` | **Poppins** (new load) | Kalın | was a silent duplicate of `body`; now genuinely distinct |
| `script` | Caveat | El Yazısı | unchanged, already correct |
| `serif` | **Playfair Display** (new load, replaces hardcoded Georgia) | Zarif | now a managed token |
| `rounded` | **Baloo 2** (new) | Yuvarlak | new literal |
| `condensed` | **Oswald** (new) | Dar | new literal |
| `classic` | **Merriweather** (new) | Klasik | new literal |

Each new font gets its own `--font-vision-<name>` CSS variable (not reusing `--font-heading` /
`--font-body`, which stay pinned to Nunito Sans for app chrome per DESIGN.md §3 — "one family" is a
rule about the *interface*, not about user-authored canvas content, the same reasoning that already
carved out `--font-script`). All loads use `subsets: ["latin", "latin-ext"]`.

Touch points:
- `packages/types/src/coaching.ts` — extend `VISION_TEXT_FONTS` tuple (additive; `VisionTextFont`
  type and the `z.enum` in `@mentor/validation` derive from it automatically).
- `apps/web/src/app/[locale]/layout.tsx` — add the 5 new `next/font/google` calls + variables on
  `<html>` className.
- `apps/web/src/components/vision-board/board-item-view.tsx` — update `FONT_STACKS`.
- `apps/web/src/components/vision-board/board-export.ts` — update `FONT_FAMILIES` to match.
- `apps/web/messages/{tr,en}.json` — add `font_rounded`, `font_condensed`, `font_classic` labels
  under `vision.board`; update TR copy for `font_heading` if needed ("Kalın").
- `board-side-panel.tsx`'s font `Row` already maps `VISION_TEXT_FONTS` generically — no structural
  change needed there, just renders the 3 new pills.

No backend/validation contract break: `VISION_BOARD_MAX_TEXTS` and the rest of the Zod schema are
untouched; the enum only grows.

## 6. Progress indicators on async actions

Reuse existing primitives — no new component:
- Mirror `@mentor/ui`'s `Button` internal `Spinner` (`LoaderCircle`, `animate-spin
  motion-reduce:animate-none`) inline in `board-editor-shell.tsx`'s custom `IconButton` and the
  hand-rolled save/publish buttons, shown while `saving` / `exporting` is true (swaps in for the
  icon, keeps the accessible label via existing `aria-label`/`title`).
- Image upload already loops multiple files sequentially in `addImages`. Track `{ done, total }`
  in state and render `@mentor/ui`'s `ProgressBar` (`value={done/total*100}`) under the
  `PrimaryAction` button in the side panel's `image` category while `uploading` is true, alongside
  the existing busy-label swap.
- No byte-level upload progress (would require switching `uploadBoardImage` from `fetch` to `XHR`
  for `progress` events) — out of scope; file-count progress is enough signal for the 1–8 image
  case this editor supports (`VISION_BOARD_MAX_IMAGES`).

## 7. Thumbnail strip of placed images in the side panel

In `board-side-panel.tsx`'s `image` category, render a wrapping grid of small thumbnails for every
`doc.items` entry with `kind === "image"` (reusing the item's `url`), placed below the
`PrimaryAction` upload button. Clicking a thumbnail calls a new `onSelectItem(id)` prop (threaded
from `BoardEditorShell`'s existing `handleSelect`) so the corresponding item becomes selected on
the canvas — same selection path a canvas click already uses, just a second entry point. The
currently-selected thumbnail gets a visible ring (`--color-focus-ring`-family outline) so the panel
and canvas selection stay legible as the same state.

## 8. Drag-and-drop image upload onto the canvas

Add `onDragOver` (`preventDefault` + `dataTransfer.dropEffect = "copy"`) and `onDrop`
(`preventDefault`, call the existing `addImages(event.dataTransfer.files)`) handlers to the
canvas-area wrapper `div` in `board-editor-shell.tsx` (the flex container around `<BoardFrame>`).
Track a local `isDraggingOver` boolean (set on `dragenter`/cleared on `dragleave`/`drop`) to render
a subtle dashed-outline overlay + tint using existing tokens (`--color-accent`,
`--color-progress-track`) while a file is over the drop zone — matches the "loading/feedback"
motion rule (state-driven, not decorative). Reuses `addImages`'s existing validation (type/size
checks, `VISION_BOARD_MAX_IMAGES` room check, toasts on rejection) — no new validation path.

## Testing

- `use-board-reducer.spec.ts` and `board-gesture-math.spec.ts` are unaffected (no reducer/gesture
  changes).
- `board-export-layout.spec.ts` unaffected (no layout-math changes).
- Add/extend a small spec for the new `FONT_FAMILIES`/`FONT_STACKS` parity if a existing test
  covers that mapping today; otherwise this is a visual change verified manually in-browser
  (screenshot before/after per item, per repo convention of testing the affected module only
  during development).
- New drag-and-drop and thumbnail-select interactions are manual/browser-verified (no dedicated
  unit test framework for DOM drag events in this repo's Vitest/Node setup); covered by existing
  `addImages` behavior which is exercised indirectly today.

## Out of scope

- Byte-level upload progress (XHR migration).
- Free-form/custom font name input.
- Any change to `board-templates.ts`, `board-palettes.ts`, sticker set, or the simulation route.
- Any change to the community-hub work already in progress on this branch (unrelated files).
