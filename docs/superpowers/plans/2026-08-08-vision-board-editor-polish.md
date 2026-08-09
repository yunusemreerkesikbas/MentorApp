# Vision Board Editor Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix eight rough edges in the `/hedef/pano` collage editor — stray gray panel background, duplicated frame controls, a layout-shifting toolbar, missing spacing, a broken font picker, no progress feedback, no image thumbnail list, and no drag-and-drop upload — without touching the reducer, gesture math, or template/sticker systems.

**Architecture:** Pure UI-layer changes inside the existing Canva-style editor (icon rail + detail panel + selection toolbar over a shared `BoardStage`/`BoardItemView` renderer). One task (font expansion) also touches the shared `@mentor/types` enum and the canvas PNG exporter, since text rendering is duplicated by design between the DOM (`board-item-view.tsx`) and the hand-rolled canvas exporter (`board-export.ts`).

**Tech Stack:** Next.js 16 / React 19 / Tailwind v4 (apps/web), `next/font/google`, framer-motion, `@mentor/ui`, `@mentor/types`, `@mentor/validation`, Vitest.

## Global Constraints

- UI values only from DESIGN.md tokens / CSS variables — no magic numbers (apps/web/AGENTS.md).
- App chrome (labels, buttons, nav) stays on the single Nunito Sans family (DESIGN.md §3) — new fonts in this plan apply **only** to user-authored vision-board text items, never to editor chrome, exactly like the existing `--font-script` precedent.
- Turkish glyph coverage required (`ç ğ ı İ ş ö ü`) — every new Google Font load uses `subsets: ["latin", "latin-ext"]`.
- `VISION_BOARD_MAX_TEXTS` / `VISION_BOARD_MAX_IMAGES` and the rest of the `@mentor/validation` Zod schema are untouched.
- Reduced motion: any new motion must respect `prefers-reduced-motion` (existing `useReducedMotion()` pattern in this file already does this — preserve it in edited JSX).
- Full suite + lint + typecheck run once at the end, right before considering this done (CI repeats it anyway); during each task, only the affected spec runs.
- Design spec: [`docs/superpowers/specs/2026-08-08-vision-board-editor-polish-design.md`](../specs/2026-08-08-vision-board-editor-polish-design.md).

---

### Task 1: Remove the gray side-panel background

**Files:**
- Modify: `apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-editor-shell.tsx:475-479`

**Interfaces:** None — pure style change, no prop/type changes.

- [ ] **Step 1: Change the detail panel's background token**

In `board-editor-shell.tsx`, find the `<motion.aside key="board-detail-panel" ...>` block:

```tsx
            className="relative flex max-h-[40vh] w-full shrink-0 flex-col border-b lg:max-h-none lg:w-64 lg:border-b-0 lg:border-e"
            style={{
              backgroundColor: "var(--color-surface-container)",
              borderColor: "rgba(17, 17, 17, 0.08)",
            }}
```

Change `backgroundColor` to `"var(--color-surface)"`:

```tsx
            className="relative flex max-h-[40vh] w-full shrink-0 flex-col border-b lg:max-h-none lg:w-64 lg:border-b-0 lg:border-e"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "rgba(17, 17, 17, 0.08)",
            }}
```

- [ ] **Step 2: Verify in the browser**

Start the web dev server, sign in, open `/vision-board/board` with an existing goal. Click any rail category (e.g. "Görsel"). Confirm the opened detail panel is now white, matching the canvas area, with only the hairline border separating it from the canvas — no beige/gray fill.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-editor-shell.tsx
git commit -m "fix(vision-board): remove gray fill from editor detail panel"
```

---

### Task 2: Trim the duplicated frame controls in the context toolbar

**Files:**
- Modify: `apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-context-toolbar.tsx`

**Interfaces:**
- Consumes: existing `BoardContextToolbarProps.onOpenImageFrames: () => void` (already threaded from `board-editor-shell.tsx`, unchanged).
- Produces: no new exports; `VISION_IMAGE_FRAMES` and `VisionImageFrame` imports are removed from this file (no longer used here).

- [ ] **Step 1: Remove the now-unused imports**

At the top of `board-context-toolbar.tsx`, change:

```tsx
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BringToFront,
  Copy,
  Italic,
  RotateCw,
  SendToBack,
  Trash2,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  VISION_IMAGE_FRAMES,
  VISION_TEXT_ALIGNS,
  type VisionBoardItem,
  type VisionImageFrame,
  type VisionTextAlign,
} from "@mentor/types";
```

to:

```tsx
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BringToFront,
  Copy,
  Frame,
  Italic,
  RotateCw,
  SendToBack,
  Trash2,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  VISION_TEXT_ALIGNS,
  type VisionBoardItem,
  type VisionTextAlign,
} from "@mentor/types";
```

- [ ] **Step 2: Replace the duplicated image-frame block with a single trigger**

Find this block (the image branch of the toolbar):

```tsx
      {selected.kind === "image" ? (
        <>
          <button
            type="button"
            onClick={onOpenImageFrames}
            className="inline-flex h-11 shrink-0 items-center rounded-full px-3 text-xs font-semibold hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-main)" }}
          >
            {t("image_frame")}
          </button>
          <Divider />
          {VISION_IMAGE_FRAMES.slice(0, 3).map((frame) => (
            <ToolBtn
              key={frame}
              label={t(`image_frame_${frame}`)}
              pressed={selected.frame === frame}
              onClick={() => onPatch({ frame: frame as VisionImageFrame })}
            >
              <span className="text-[10px] font-bold uppercase">
                {frame === "none" ? "—" : frame.slice(0, 1)}
              </span>
            </ToolBtn>
          ))}
        </>
      ) : null}
```

Replace it with:

```tsx
      {selected.kind === "image" ? (
        <FrameTrigger label={t("image_frame")} onClick={onOpenImageFrames} />
      ) : null}
```

- [ ] **Step 3: Add the `FrameTrigger` component**

Add this next to `SwatchTrigger` (same file, near the bottom, same visual pattern — an icon-only circular trigger that opens the side panel rather than re-rendering the full option set inline):

```tsx
function FrameTrigger({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      <Frame aria-hidden size={16} />
    </button>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Reload `/vision-board/board`, select a placed image. Confirm the toolbar now shows one frame icon button (no text label duplicate, no 3-icon row) instead of a text button plus 3 icons. Click it — the side panel opens on the "image" category showing the full 5-frame set, exactly as `onOpenImageFrames` already did. Confirm text selection (bold/italic/align/color) is unaffected.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @mentor/web exec tsc --noEmit`
Expected: no new errors (confirms the removed imports aren't used anywhere else in the file).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-context-toolbar.tsx
git commit -m "fix(vision-board): stop duplicating the image frame picker in the context toolbar"
```

---

### Task 3: Fix the context toolbar's layout shift and full-width stretch

**Files:**
- Modify: `apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-editor-shell.tsx:620-638`
- Modify: `apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-context-toolbar.tsx` (the root `motion.div`, edited in Task 2 already — locate by its `role="toolbar"`)

**Interfaces:** None — pure layout change, no prop/type changes.

- [ ] **Step 1: Reserve toolbar height in `board-editor-shell.tsx`**

Find:

```tsx
        <AnimatePresence initial={false}>
          {selected ? (
            <BoardContextToolbar
              key="context-toolbar"
              selected={selected}
              onPatch={patchSelected}
              onCheckpoint={checkpoint}
              onLayer={handleLayer}
              onDuplicate={duplicateSelected}
              onRemove={removeSelected}
              onOpenColor={openColor}
              onOpenImageFrames={() => {
                setColorTarget(null);
                setActivePanel("image");
                setDetailCollapsed(false);
              }}
            />
          ) : null}
        </AnimatePresence>
```

Wrap it in a fixed-height, centering container:

```tsx
        <div className="flex min-h-[52px] shrink-0 items-center justify-center">
          <AnimatePresence initial={false}>
            {selected ? (
              <BoardContextToolbar
                key="context-toolbar"
                selected={selected}
                onPatch={patchSelected}
                onCheckpoint={checkpoint}
                onLayer={handleLayer}
                onDuplicate={duplicateSelected}
                onRemove={removeSelected}
                onOpenColor={openColor}
                onOpenImageFrames={() => {
                  setColorTarget(null);
                  setActivePanel("image");
                  setDetailCollapsed(false);
                }}
              />
            ) : null}
          </AnimatePresence>
        </div>
```

`52px` = the toolbar's `h-11` (44px) buttons plus its `py-1` (4px top + 4px bottom) padding — matches the real rendered height so nothing jumps when it mounts or unmounts.

- [ ] **Step 2: Size the toolbar to its content in `board-context-toolbar.tsx`**

Find the root `motion.div`'s `className`:

```tsx
      className="mentor-scrollarea flex shrink-0 items-center gap-0.5 overflow-x-auto rounded-[var(--radius-card)] px-1 py-1"
```

Change to:

```tsx
      className="mentor-scrollarea flex w-fit max-w-full shrink-0 items-center gap-0.5 overflow-x-auto rounded-[var(--radius-card)] px-1 py-1"
```

(`w-fit` stops it stretching to the parent's cross-axis width; `max-w-full` plus the existing `overflow-x-auto` keeps it from overflowing the viewport when its content is wider than the screen.)

- [ ] **Step 3: Verify in the browser**

Reload `/vision-board/board`. With nothing selected, note the vertical position of the top toolbar row and the canvas below it. Click an item to select it — confirm the canvas does **not** jump/shift vertically when the contextual toolbar appears, and the toolbar itself is horizontally centered and only as wide as its buttons (not stretched edge-to-edge). Deselect (click empty canvas) — confirm the reserved space stays and nothing shifts back either.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-editor-shell.tsx apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-context-toolbar.tsx
git commit -m "fix(vision-board): reserve space for the context toolbar and stop it stretching full width"
```

---

### Task 4: Add top breathing room to the left column

**Files:**
- Modify: `apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-editor-shell.tsx:421-428`
- Modify: `apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-side-panel.tsx:332-334`

**Interfaces:** None — pure spacing change.

- [ ] **Step 1: Add top padding to the icon rail (desktop only)**

In `board-editor-shell.tsx`, find:

```tsx
      <nav
        aria-label={t("editor_nav")}
        className="mentor-scrollarea flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-2 lg:w-16 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:border-b-0 lg:border-e lg:px-1 lg:py-3"
        style={{
```

Change `lg:py-3` to explicit top/bottom so the new top value can't collide with it:

```tsx
      <nav
        aria-label={t("editor_nav")}
        className="mentor-scrollarea flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-2 lg:w-16 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:border-b-0 lg:border-e lg:px-1 lg:pb-3 lg:pt-4"
        style={{
```

(4px grid step per DESIGN.md §4: `pt-4` = 16px. Mobile keeps `py-2` since the rail is a horizontal bar there, not a "left column".)

- [ ] **Step 2: Add top padding to the detail panel's content**

In `board-side-panel.tsx`, find the `Panel` helper:

```tsx
function Panel({ children }: { children: ReactNode }) {
  return <div className="mentor-scrollarea flex flex-col gap-3 overflow-y-auto p-3">{children}</div>;
}
```

Change to:

```tsx
function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="mentor-scrollarea flex flex-col gap-3 overflow-y-auto px-3 pb-3 pt-4">
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Verify in the browser**

Reload `/vision-board/board` at a desktop width (≥1024px). Confirm the icon rail's first button and the opened detail panel's first control both sit with visible breathing room below the top edge, not flush against it. Resize to mobile width — confirm the horizontal top bar is unaffected (still `py-2`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-editor-shell.tsx apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-side-panel.tsx
git commit -m "fix(vision-board): add top spacing to the editor's left column"
```

---

### Task 5: Expand vision-board text fonts to 7 distinct, Turkish-safe faces

**Files:**
- Modify: `packages/types/src/coaching.ts` (the `VISION_TEXT_FONTS` tuple)
- Modify: `apps/web/src/app/[locale]/layout.tsx` (add 5 `next/font/google` loads)
- Modify: `apps/web/src/components/vision-board/board-item-view.tsx` (`FONT_STACKS`, exported)
- Modify: `apps/web/src/components/vision-board/board-export.ts` (`FONT_FAMILIES`, exported)
- Modify: `apps/web/messages/tr.json` and `apps/web/messages/en.json` (3 new labels, 1 relabel)
- Create: `apps/web/src/components/vision-board/board-text-fonts.spec.ts`

**Interfaces:**
- Consumes: `VISION_TEXT_FONTS` from `@mentor/types` (the tuple this task extends).
- Produces: `export const FONT_STACKS: Record<VisionBoardTextItem["font"], string>` from `board-item-view.tsx`; `export const FONT_FAMILIES: Record<VisionBoardTextItem["font"], string>` from `board-export.ts`. Both keyed by the same 7 literals: `"body" | "heading" | "script" | "serif" | "rounded" | "condensed" | "classic"`.

- [ ] **Step 1: Write the failing parity test**

Create `apps/web/src/components/vision-board/board-text-fonts.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { VISION_TEXT_FONTS } from "@mentor/types";
import { FONT_STACKS } from "./board-item-view";
import { FONT_FAMILIES } from "./board-export";

/**
 * The DOM renderer (`board-item-view.tsx`) and the canvas PNG exporter (`board-export.ts`) each
 * keep their own font map. If one adds a font key the other misses, the on-screen board and the
 * downloaded PNG silently disagree on what a font choice looks like.
 */
describe("vision board font maps", () => {
  it("board-item-view and board-export define exactly the keys in VISION_TEXT_FONTS", () => {
    const expected = [...VISION_TEXT_FONTS].sort();
    expect(Object.keys(FONT_STACKS).sort()).toEqual(expected);
    expect(Object.keys(FONT_FAMILIES).sort()).toEqual(expected);
  });

  it("has 7 distinct font entries", () => {
    expect(VISION_TEXT_FONTS).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter @mentor/web exec vitest run board-text-fonts`
Expected: FAIL — `FONT_STACKS`/`FONT_FAMILIES` aren't exported yet (import error), and `VISION_TEXT_FONTS` only has 4 entries.

- [ ] **Step 3: Extend the shared enum**

In `packages/types/src/coaching.ts`, find:

```ts
export const VISION_TEXT_FONTS = ["body", "heading", "script", "serif"] as const;
```

Change to:

```ts
export const VISION_TEXT_FONTS = [
  "body",
  "heading",
  "script",
  "serif",
  "rounded",
  "condensed",
  "classic",
] as const;
```

This is additive and non-breaking: `VisionTextFont` and the `z.enum(VISION_TEXT_FONTS)` in `packages/validation/src/coaching.ts` derive from this tuple automatically — no other change needed in either file. Existing saved boards using `"body" | "heading" | "script" | "serif"` keep validating and rendering.

- [ ] **Step 4: Load the 5 new fonts in the root layout**

In `apps/web/src/app/[locale]/layout.tsx`, find:

```tsx
import { Caveat, Nunito_Sans } from "next/font/google";
```

Change to:

```tsx
import { Baloo_2, Caveat, Merriweather, Nunito_Sans, Oswald, Playfair_Display, Poppins } from "next/font/google";
```

Find the existing `script` font block:

```tsx
/* Handwriting face, used ONLY inside vision-board text items — never in app chrome, which stays on
   the single DESIGN.md family. A collage needs a voice that is not the interface's. latin-ext for
   the Turkish glyphs, same as above. */
const script = Caveat({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-script",
});
```

Add 5 more font declarations right after it, same comment convention:

```tsx
/* The rest of the vision-board's font picker — same rule as Caveat above: used ONLY inside
   vision-board text items, never app chrome. Each gets its own token so the app's own
   --font-heading / --font-body stay pinned to Nunito Sans (DESIGN.md §3). */
const visionHeading = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vision-heading",
});
const visionSerif = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vision-serif",
});
const visionRounded = Baloo_2({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vision-rounded",
});
const visionCondensed = Oswald({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vision-condensed",
});
const visionClassic = Merriweather({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vision-classic",
});
```

Find where the variables are applied:

```tsx
    <html lang={locale} className={`${sans.variable} ${script.variable}`}>
```

Change to:

```tsx
    <html
      lang={locale}
      className={`${sans.variable} ${script.variable} ${visionHeading.variable} ${visionSerif.variable} ${visionRounded.variable} ${visionCondensed.variable} ${visionClassic.variable}`}
    >
```

- [ ] **Step 5: Update and export `FONT_STACKS`**

In `apps/web/src/components/vision-board/board-item-view.tsx`, find:

```ts
const FONT_STACKS: Record<VisionBoardTextItem["font"], string> = {
  body: "var(--font-body)",
  heading: "var(--font-heading)",
  script: "var(--font-script, cursive)",
  serif: "Georgia, 'Times New Roman', serif",
};
```

Change to:

```ts
export const FONT_STACKS: Record<VisionBoardTextItem["font"], string> = {
  body: "var(--font-body)",
  heading: "var(--font-vision-heading, sans-serif)",
  script: "var(--font-script, cursive)",
  serif: "var(--font-vision-serif, serif)",
  rounded: "var(--font-vision-rounded, sans-serif)",
  condensed: "var(--font-vision-condensed, sans-serif)",
  classic: "var(--font-vision-classic, serif)",
};
```

- [ ] **Step 6: Update and export `FONT_FAMILIES`**

In `apps/web/src/components/vision-board/board-export.ts`, find:

```ts
const FONT_FAMILIES: Record<VisionBoardTextItem["font"], string> = {
  body: '"Nunito Sans", sans-serif',
  heading: '"Nunito Sans", sans-serif',
  script: '"Caveat", cursive',
  serif: 'Georgia, "Times New Roman", serif',
};
```

Change to:

```ts
export const FONT_FAMILIES: Record<VisionBoardTextItem["font"], string> = {
  body: '"Nunito Sans", sans-serif',
  heading: '"Poppins", sans-serif',
  script: '"Caveat", cursive',
  serif: '"Playfair Display", Georgia, serif',
  rounded: '"Baloo 2", sans-serif',
  condensed: '"Oswald", sans-serif',
  classic: '"Merriweather", serif',
};
```

- [ ] **Step 7: Run the test and confirm it passes**

Run: `pnpm --filter @mentor/web exec vitest run board-text-fonts`
Expected: PASS (both assertions).

- [ ] **Step 8: Add the 3 new translation labels**

In `apps/web/messages/tr.json`, find (around line 1927-1931):

```json
      "font": "Yazı tipi",
      "font_body": "Düz",
      "font_heading": "Başlık",
      "font_script": "El yazısı",
      "font_serif": "Serif",
```

Change to:

```json
      "font": "Yazı tipi",
      "font_body": "Düz",
      "font_heading": "Kalın",
      "font_script": "El yazısı",
      "font_serif": "Zarif",
      "font_rounded": "Yuvarlak",
      "font_condensed": "Dar",
      "font_classic": "Klasik",
```

In `apps/web/messages/en.json`, find the same line numbers:

```json
      "font": "Font",
      "font_body": "Plain",
      "font_heading": "Heading",
      "font_script": "Handwriting",
      "font_serif": "Serif",
```

Change to:

```json
      "font": "Font",
      "font_body": "Plain",
      "font_heading": "Bold",
      "font_script": "Handwriting",
      "font_serif": "Elegant",
      "font_rounded": "Rounded",
      "font_condensed": "Condensed",
      "font_classic": "Classic",
```

(`board-side-panel.tsx`'s font `Row` already does `VISION_TEXT_FONTS.map((font) => <Pill ... label={t(`font_${font}`)} ... />)` — no code change needed there, it will render the 3 new pills automatically once the keys exist.)

- [ ] **Step 9: Typecheck and full web build sanity**

Run: `pnpm --filter @mentor/web exec tsc --noEmit`
Expected: no errors (confirms `packages/types` and `packages/validation` still line up, and every `Record<VisionBoardTextItem["font"], ...>` in the app is exhaustive).

- [ ] **Step 10: Verify in the browser**

Reload `/vision-board/board`, add a text item, open its side panel. Confirm 7 font pills render with 7 visibly distinct typefaces when selected (Poppins bold sans, Caveat script, Playfair Display serif, Baloo 2 rounded, Oswald condensed, Merriweather serif, Nunito Sans plain). Download the board (export) and confirm the PNG's text matches what was on screen for at least one non-default font (e.g. set a text item to "Dar"/condensed, download, open the PNG).

- [ ] **Step 11: Commit**

```bash
git add packages/types/src/coaching.ts apps/web/src/app/[locale]/layout.tsx apps/web/src/components/vision-board/board-item-view.tsx apps/web/src/components/vision-board/board-export.ts apps/web/src/components/vision-board/board-text-fonts.spec.ts apps/web/messages/tr.json apps/web/messages/en.json
git commit -m "feat(vision-board): expand text font picker to 7 distinct Turkish-safe faces"
```

---

### Task 6: Progress indicators on save, publish, export, and upload

**Files:**
- Modify: `apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-editor-shell.tsx`
- Modify: `apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-side-panel.tsx`

**Interfaces:**
- Consumes: `@mentor/ui`'s `ProgressBar` (`{ value: number; className?: string }`, already exists).
- Produces: `BoardSidePanelProps` gains `uploadProgress?: { done: number; total: number } | null` (replacing the plain `uploading?: boolean`, still passed from `board-editor-shell.tsx`).

- [ ] **Step 1: Track upload progress as `{ done, total }` instead of a boolean**

In `board-editor-shell.tsx`, find:

```tsx
  const [uploading, setUploading] = useState(false);
```

Change to:

```tsx
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
```

Find the `addImages` callback:

```tsx
  const addImages = useCallback(
    async (files: FileList) => {
      const room =
        VISION_BOARD_MAX_IMAGES - state.doc.items.filter((i) => i.kind === "image").length;
      if (room <= 0) {
        toast.error({ title: t("limit_images") });
        return;
      }
      setUploading(true);
      try {
        for (const file of Array.from(files).slice(0, room)) {
          if (!isSupportedBoardImage(file)) {
            toast.error({ title: t("image_unsupported") });
            continue;
          }
          if (!isWithinBoardImageLimit(file)) {
            toast.error({ title: t("image_too_large") });
            continue;
          }
          const uploaded = await uploadBoardImage(file);
```

Change to (adding the counter, incremented once per file regardless of outcome so the bar always reaches 100%):

```tsx
  const addImages = useCallback(
    async (files: FileList) => {
      const room =
        VISION_BOARD_MAX_IMAGES - state.doc.items.filter((i) => i.kind === "image").length;
      if (room <= 0) {
        toast.error({ title: t("limit_images") });
        return;
      }
      const queued = Array.from(files).slice(0, room);
      setUploadProgress({ done: 0, total: queued.length });
      try {
        for (const [index, file] of queued.entries()) {
          if (!isSupportedBoardImage(file)) {
            toast.error({ title: t("image_unsupported") });
            setUploadProgress({ done: index + 1, total: queued.length });
            continue;
          }
          if (!isWithinBoardImageLimit(file)) {
            toast.error({ title: t("image_too_large") });
            setUploadProgress({ done: index + 1, total: queued.length });
            continue;
          }
          const uploaded = await uploadBoardImage(file);
```

Find the rest of the loop body (right after the `dispatch({ type: "add", ... })` call that follows `uploaded`) and add the progress tick there too — locate:

```tsx
            item: {
              ...createImageItem(
                crypto.randomUUID(),
                uploaded.key,
                state.doc.items,
                uploaded.aspectRatio,
              ),
              url: uploaded.url,
            },
          });
        }
      } catch {
        toast.error({ title: t("image_upload_failed") });
      } finally {
        setUploading(false);
      }
    },
    [dispatch, state.doc.items, t, toast],
  );
```

Change to:

```tsx
            item: {
              ...createImageItem(
                crypto.randomUUID(),
                uploaded.key,
                state.doc.items,
                uploaded.aspectRatio,
              ),
              url: uploaded.url,
            },
          });
          setUploadProgress({ done: index + 1, total: queued.length });
        }
      } catch {
        toast.error({ title: t("image_upload_failed") });
      } finally {
        setUploadProgress(null);
      }
    },
    [dispatch, state.doc.items, t, toast],
  );
```

Every place `uploading` was read now reads `uploadProgress != null` — find:

```tsx
                      onUploadImage={() => fileInput.current?.click()}
```

Locate the `BoardSidePanel` usage's `uploading={uploading}` prop:

```tsx
                    <BoardSidePanel
                      category={activePanel}
                      doc={state.doc}
                      selected={selected}
                      uploading={uploading}
```

Change `uploading={uploading}` to `uploadProgress={uploadProgress}`.

- [ ] **Step 2: Add an inline spinner to `IconButton` and the save/publish buttons**

In `board-editor-shell.tsx`, add the import:

```tsx
import { LoaderCircle } from "lucide-react";
```

(add it into the existing `lucide-react` import block, alphabetically between `ImagePlus` and `LayoutTemplate`).

Find the `IconButton` function at the bottom of the file:

```tsx
function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-container)] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      style={{ color: "var(--color-main)" }}
    >
      {children}
    </button>
  );
}
```

Change to (adds an optional `busy` prop that swaps the icon for a spinner, mirroring `@mentor/ui`'s `Button` spinner):

```tsx
function IconButton({
  label,
  disabled,
  busy,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy || undefined}
      title={label}
      disabled={disabled || busy}
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-container)] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      style={{ color: "var(--color-main)" }}
    >
      {busy ? (
        <LoaderCircle aria-hidden size={17} className="animate-spin motion-reduce:animate-none" />
      ) : (
        children
      )}
    </button>
  );
}
```

Find the download/share `IconButton` calls:

```tsx
            <IconButton
              label={t("download")}
              disabled={exporting}
              onClick={() => void exportBoard("download", docForRender)}
            >
              <Download aria-hidden size={17} />
            </IconButton>
            <IconButton
              label={t("share")}
              disabled={exporting}
              onClick={() => void exportBoard("share", docForRender)}
            >
              <Share2 aria-hidden size={17} />
            </IconButton>
```

Change to:

```tsx
            <IconButton
              label={t("download")}
              disabled={exporting}
              busy={exporting}
              onClick={() => void exportBoard("download", docForRender)}
            >
              <Download aria-hidden size={17} />
            </IconButton>
            <IconButton
              label={t("share")}
              disabled={exporting}
              busy={exporting}
              onClick={() => void exportBoard("share", docForRender)}
            >
              <Share2 aria-hidden size={17} />
            </IconButton>
```

Find the save button:

```tsx
            <button
              type="button"
              disabled={saving}
              onClick={() => void save().then((ok) => ok && toast.success({ title: t("saved") }))}
              className="h-11 rounded-full px-3 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ color: "var(--color-main)" }}
            >
              {t("save")}
            </button>
```

Change to:

```tsx
            <button
              type="button"
              disabled={saving}
              aria-busy={saving || undefined}
              onClick={() => void save().then((ok) => ok && toast.success({ title: t("saved") }))}
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ color: "var(--color-main)" }}
            >
              {saving ? (
                <LoaderCircle
                  aria-hidden
                  size={15}
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t("save")}
            </button>
```

Find the publish button:

```tsx
              <button
                type="button"
                disabled={saving}
                onClick={() => void publish()}
                className="h-11 rounded-full px-3.5 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ backgroundColor: "var(--color-btn)" }}
              >
                {t("publish")}
              </button>
```

Change to:

```tsx
              <button
                type="button"
                disabled={saving}
                aria-busy={saving || undefined}
                onClick={() => void publish()}
                className="inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ backgroundColor: "var(--color-btn)" }}
              >
                {saving ? (
                  <LoaderCircle
                    aria-hidden
                    size={15}
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : null}
                {t("publish")}
              </button>
```

- [ ] **Step 3: Show a determinate progress bar during multi-image upload**

In `board-side-panel.tsx`, add the import:

```tsx
import { ProgressBar } from "@mentor/ui";
```

Change `BoardSidePanelProps`:

```ts
export interface BoardSidePanelProps {
  category: BoardPanelCategory;
  doc: VisionBoardDoc;
  selected: VisionBoardItem | null;
  uploading?: boolean;
```

to:

```ts
export interface BoardSidePanelProps {
  category: BoardPanelCategory;
  doc: VisionBoardDoc;
  selected: VisionBoardItem | null;
  uploadProgress?: { done: number; total: number } | null;
```

Update the destructured props and the `image` category branch. Find:

```tsx
export function BoardSidePanel({
  category,
  doc,
  selected,
  uploading,
  onAddText,
```

Change to:

```tsx
export function BoardSidePanel({
  category,
  doc,
  selected,
  uploadProgress,
  onAddText,
```

Find:

```tsx
  if (category === "image") {
    return (
      <Panel>
        <PrimaryAction
          label={uploading ? t("image_uploading") : t("add_image_cta")}
          busy={uploading}
          onClick={onUploadImage}
        />
```

Change to:

```tsx
  if (category === "image") {
    return (
      <Panel>
        <PrimaryAction
          label={uploadProgress ? t("image_uploading") : t("add_image_cta")}
          busy={uploadProgress != null}
          onClick={onUploadImage}
        />
        {uploadProgress && uploadProgress.total > 1 ? (
          <ProgressBar value={(uploadProgress.done / uploadProgress.total) * 100} />
        ) : null}
```

- [ ] **Step 4: Verify in the browser**

Reload `/vision-board/board`. Trigger save — confirm a small spinner appears next to "Kaydet" while the request is in flight and disappears on completion. Trigger publish — same. Select an image and click download/share — confirm the icon swaps to a spinner while exporting. Upload 2+ images at once via the file picker — confirm the progress bar appears under "Görsel yükle" and fills as each file finishes, then disappears.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-editor-shell.tsx apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-side-panel.tsx
git commit -m "feat(vision-board): add progress feedback to save, publish, export, and upload"
```

---

### Task 7: Show a thumbnail strip of placed images in the side panel

**Files:**
- Modify: `apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-side-panel.tsx`
- Modify: `apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-editor-shell.tsx`
- Modify: `apps/web/messages/tr.json` and `apps/web/messages/en.json` (1 new label)

**Interfaces:**
- Consumes: `handleSelect: (id: string | null) => void` (already defined in `board-editor-shell.tsx`).
- Produces: `BoardSidePanelProps` gains `selectedId: string | null` and `onSelectItem: (id: string) => void`.

- [ ] **Step 1: Add the thumbnail grid to the image panel**

In `board-side-panel.tsx`, update `BoardSidePanelProps` — find:

```ts
  selected: VisionBoardItem | null;
  uploadProgress?: { done: number; total: number } | null;
```

Change to:

```ts
  selected: VisionBoardItem | null;
  selectedId: string | null;
  uploadProgress?: { done: number; total: number } | null;
```

and add `onSelectItem: (id: string) => void;` next to `onAddSticker` in the same interface:

```ts
  onAddSticker: (asset: (typeof VISION_STICKERS)[number]) => void;
```

becomes:

```ts
  onAddSticker: (asset: (typeof VISION_STICKERS)[number]) => void;
  onSelectItem: (id: string) => void;
```

Update the destructured props (find `selected, uploadProgress, onAddText,` in the function signature) to also pull `selectedId` and `onSelectItem`:

```tsx
export function BoardSidePanel({
  category,
  doc,
  selected,
  selectedId,
  uploadProgress,
  onAddText,
  onUploadImage,
  onAddSticker,
  onSelectItem,
  onApplyTemplate,
```

In the `image` category branch, after the progress bar block added in Task 6, add the thumbnail grid before the existing `{selected?.kind === "image" ? ... }` block:

```tsx
        {uploadProgress && uploadProgress.total > 1 ? (
          <ProgressBar value={(uploadProgress.done / uploadProgress.total) * 100} />
        ) : null}
        {doc.items.some((item) => item.kind === "image") ? (
          <div className="flex flex-wrap gap-1.5">
            {doc.items
              .filter((item) => item.kind === "image")
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={t("select_image")}
                  aria-pressed={item.id === selectedId}
                  onClick={() => onSelectItem(item.id)}
                  className="h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-card)] focus-visible:outline-none"
                  style={{
                    outline:
                      item.id === selectedId
                        ? "2px solid var(--color-focus-ring)"
                        : "1px solid rgba(0,0,0,0.08)",
                    outlineOffset: "1px",
                  }}
                >
                  {item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small panel thumbnail, not an export target
                    <img
                      src={item.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{ backgroundColor: "var(--color-surface-container)" }}
                    />
                  )}
                </button>
              ))}
          </div>
        ) : null}
```

- [ ] **Step 2: Wire the new props from `board-editor-shell.tsx`**

Find the `BoardSidePanel` usage:

```tsx
                    <BoardSidePanel
                      category={activePanel}
                      doc={state.doc}
                      selected={selected}
                      uploadProgress={uploadProgress}
                      uploading={uploading}
```

(Note: the `uploading={uploading}` line here should already be gone after Task 6 Step 1 — if it's still present, remove it; `uploadProgress={uploadProgress}` alone is correct.)

Add `selectedId={state.selectedId}` and `onSelectItem={handleSelect}`:

```tsx
                    <BoardSidePanel
                      category={activePanel}
                      doc={state.doc}
                      selected={selected}
                      selectedId={state.selectedId}
                      uploadProgress={uploadProgress}
                      onAddText={addText}
                      onUploadImage={() => fileInput.current?.click()}
                      onAddSticker={addSticker}
                      onSelectItem={handleSelect}
                      onApplyTemplate={(id) =>
```

- [ ] **Step 3: Add the translation label**

In `apps/web/messages/tr.json`, near `"image_panel_hint"`, add:

```json
      "select_image": "Görseli seç",
```

In `apps/web/messages/en.json`, same spot:

```json
      "select_image": "Select image",
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @mentor/web exec tsc --noEmit`
Expected: no errors — confirms `BoardSidePanelProps` is fully satisfied at its one call site.

- [ ] **Step 5: Verify in the browser**

Reload `/vision-board/board`, add 2-3 images to the board, open the "Görsel" category. Confirm a thumbnail row appears below the upload button (and progress bar, if visible) showing each placed image. Click a thumbnail — confirm the matching item becomes selected on the canvas (selection outline appears, context toolbar shows its controls) and the clicked thumbnail gets a focus-ring outline. Click a different thumbnail — confirm the outline moves.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-side-panel.tsx apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-editor-shell.tsx apps/web/messages/tr.json apps/web/messages/en.json
git commit -m "feat(vision-board): list placed images as selectable thumbnails in the side panel"
```

---

### Task 8: Drag-and-drop image upload onto the canvas

**Files:**
- Modify: `apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-editor-shell.tsx`
- Modify: `apps/web/messages/tr.json` and `apps/web/messages/en.json` (1 new label)

**Interfaces:**
- Consumes: existing `addImages(files: FileList): Promise<void>` (unchanged signature — reused as-is).

- [ ] **Step 1: Add drag-over state and handlers**

In `board-editor-shell.tsx`, find:

```tsx
  const [previews, setPreviews] = useState<PreviewMap>({});
```

Add right after it:

```tsx
  const [previews, setPreviews] = useState<PreviewMap>({});
  const [isDraggingOver, setIsDraggingOver] = useState(false);
```

Find the canvas wrapper:

```tsx
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto">
          <div className="w-full max-w-full">
            <BoardFrame
```

Change to (add drag handlers on the outer wrapper, and a visual overlay that only shows while dragging):

```tsx
        <div
          className="relative flex min-h-0 flex-1 items-start justify-center overflow-auto"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setIsDraggingOver(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setIsDraggingOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDraggingOver(false);
            if (event.dataTransfer.files.length) void addImages(event.dataTransfer.files);
          }}
        >
          {isDraggingOver ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-2 z-10 rounded-[var(--radius-card)]"
              style={{
                border: "2px dashed var(--color-accent)",
                backgroundColor: "var(--color-progress-track)",
                opacity: 0.35,
              }}
            />
          ) : null}
          <div className="w-full max-w-full">
            <BoardFrame
```

- [ ] **Step 2: Add the drop-zone hint label (accessibility / discoverability)**

In `apps/web/messages/tr.json`, near `"image_panel_hint"`, add:

```json
      "drop_hint": "Görseli buraya bırak",
```

In `apps/web/messages/en.json`, same spot:

```json
      "drop_hint": "Drop image here",
```

Use it as a visible label inside the overlay so drag-and-drop is discoverable, not just a hidden behavior. Update the overlay from Step 1 to:

```tsx
          {isDraggingOver ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-[var(--radius-card)]"
              style={{
                border: "2px dashed var(--color-accent)",
                backgroundColor: "var(--color-progress-track)",
                opacity: 0.85,
              }}
            >
              <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
                {t("drop_hint")}
              </span>
            </div>
          ) : null}
```

(Dropping `opacity: 0.35` on the whole box would also fade the text — use full opacity on the box and let the pastel `--color-progress-track` background carry the softness on its own, same technique the existing text-plate transparency handling in `board-item-view.tsx` uses.)

- [ ] **Step 3: Verify in the browser**

Reload `/vision-board/board`. Drag an image file from the OS file manager over the canvas area — confirm a dashed-outline tinted overlay with "Görseli buraya bırak" appears while hovering, and disappears when the file is dragged back out without dropping. Drop the file — confirm it's added to the board exactly as clicking "Görsel yükle" would (respecting the same type/size/room checks — try dropping an unsupported file type and confirm the existing `image_unsupported` toast still fires).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/[locale]/(app)/vision-board/board/_components/board-editor-shell.tsx apps/web/messages/tr.json apps/web/messages/en.json
git commit -m "feat(vision-board): support drag-and-drop image upload onto the canvas"
```

---

### Task 9: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the affected unit tests**

Run: `pnpm --filter @mentor/web exec vitest run board-text-fonts board-export-layout use-board-reducer board-gesture-math`
Expected: all PASS.

- [ ] **Step 2: Full suite, lint, typecheck**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: all green.

- [ ] **Step 3: End-to-end browser walkthrough**

On `/vision-board/board`, re-verify all 8 items in one pass: white detail panel, single frame trigger in the toolbar, no layout shift on selection, top spacing on the left column, 7 distinct fonts with matching PNG export, spinners on save/publish/export and a progress bar on multi-image upload, thumbnail strip with working selection, and drag-and-drop upload with hover feedback.

- [ ] **Step 4: Append a timeline entry to the feature doc**

Add a dated entry to `docs/features/vision-board.md` describing this polish pass (gotchas: the two font maps that must stay in sync; the reserved toolbar height). If `docs/features/vision-board.md` doesn't exist yet, check `docs/features/` for the closest matching doc name before creating a new one (per `AGENTS.md`'s "append a timeline entry to the matching feature doc" rule).
