# Puhu mascot assets

Runtime path for web: `/mascot/puhu/{variant}.png`

## Required files

Copy approved PNG/WebP exports here before wiring components:

| File                   | Variant                     | Status                           |
| ---------------------- | --------------------------- | -------------------------------- |
| `puhu-default.png`     | Neutral / default           | Present                          |
| `puhu-happy.png`       | Success, celebration        | Present                          |
| `puhu-host.png`        | Weekly story host / welcome | Present                          |
| `puhu-encouraging.png` | Pink heart, nudges          | Present                          |
| `puhu-surprised.png`   | Info, alerts                | Present                          |
| `puhu-proud.png`       | Trophy, milestones          | Present                          |
| `puhu-sleepy.png`      | Night, rest                 | Present (file; wire when needed) |
| `puhu-premium.png`     | Premium taste               | Present (file; wire when needed) |
| `koc-hero.png`         | Moment hero (Koç hub)       | Present                          |
| `thinking`             | AI loading                  | **P0 — not yet designed**        |
| `gentle-error`         | Soft error toast            | **P0 — not yet designed**        |

## Theme lamp scene (`lamp/`)

Art for the sidebar theme toggle (`@/components/theme-lamp`).

| File                       | Content                                         | Canvas    | Content box       |
| -------------------------- | ----------------------------------------------- | --------- | ----------------- |
| `lamp-shade.png`           | Pendant shade, unlit, hollow mouth, **no cord** | 320 × 282 | trimmed           |
| `puhu-lamp-rest.png`       | Owl, both wings down, eyes open, looking ahead  | 320 × 320 | 265 × 274 @ 27,17 |
| `puhu-lamp-reach.png`      | Owl, right wing raised up, eyes open            | 320 × 320 | 283 × 274 @ 27,17 |
| `puhu-lamp-blink.png`      | Owl, both wings down, eyes closed               | 320 × 320 | 265 × 274 @ 27,17 |
| `puhu-lamp-gaze-left.png`  | Same pose as rest, pupils toward viewer's left  | 320 × 320 | 265 × 274 @ 27,17 |
| `puhu-lamp-gaze-right.png` | Same pose as rest, pupils toward viewer's right | 320 × 320 | 265 × 274 @ 27,17 |

The owl files are **whole-body sprites, not cut-out layers** — the component crossfades between
them instead of rotating a wing or sliding pupils, because an image generator cannot hold a shared
canvas across runs. They share one canvas and must **not** be trimmed individually: trimming crops
each one differently and the crossfade would jump. Note `reach` is the same box as `rest` plus 18px
of raised wing on the right, which is why `OWL_ART` measures the *resting* body — see
`lamp-choreography.ts`. `lamp-shade.png` hangs on its own and is trimmed.

Gaze changes hide behind a blink so two pupil positions never dissolve through each other.

### Regenerating

Generate on a solid **magenta (`#FF00FF`)** background — no colour in Puhu's palette is close to
it, so the key cannot eat his pupils — then run the pipeline:

```bash
# only if the generator handed back a JPEG wearing a .png extension
powershell -File apps/web/scripts/to-png.ps1 -In raw.jpg -Out raw.png

node apps/web/scripts/key-alpha.mjs raw.png out.png --key=ff00ff --hard=70 --soft=150 --max=320
node apps/web/scripts/inspect-png.mjs out.png   # read the content box back into OWL_ART
```

Add `--trim` for the shade only. Keep `--max` identical across every owl sprite so they stay aligned,
and re-measure `OWL_ART` / `SHADE_ART` from `inspect-png.mjs` whenever the art changes.

## Size scale (DESIGN.md §8.2)

| Token | px  | Use via `PuhuImage`     |
| ----- | --- | ----------------------- |
| `sm`  | 40  | Inline, toast           |
| `md`  | 72  | Bubble, dialog          |
| `lg`  | 120 | Empty / nudge (default) |

Subject soft-3D scenes live in `/visuals/` (sibling folder), not here.

## Source

Design sheet and sticker variants from product design. Stitch references: `.stitch/assets/`.

## Usage

```tsx
import { PuhuImage } from "@/components/puhu-image";

<PuhuImage variant="encouraging" size="md" />;
```

Alt text empty when decorative; provide `aria-label` on parent interactive region.
