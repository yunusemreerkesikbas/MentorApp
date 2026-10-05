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

## Auth hang scene (`auth/`)

Login-sheet companion. Puhu peeks over the sheet rim; sprites crossfade like the lamp set.
Same canvas, **do not trim individually**. `--max=384`.

| File                   | Content                                              | Canvas    | Content box        |
| ---------------------- | ---------------------------------------------------- | --------- | ------------------ |
| `hang-rest.png`        | Eyes open, looking ahead, both wings on the rim      | 384 × 384 | 228 × 181 @ 78,15  |
| `hang-blink.png`       | Neutral closed lids, same hang                       | 384 × 384 | 228 × 181 @ 78,15  |
| `hang-gaze-left.png`   | Pupils toward viewer's left                          | 384 × 384 | 228 × 181 @ 78,15  |
| `hang-gaze-right.png`  | Pupils toward viewer's right                         | 384 × 384 | 228 × 181 @ 78,15  |
| `hang-look-down.png`   | Looking down at the form                             | 384 × 384 | 230 × 180 @ 77,17  |
| `hang-cover.png`       | Both wings cover both lenses (password)              | 384 × 384 | 232 × 173 @ 76,16  |

`cover` is wider/shorter because the wings leave the rim and come up to the glasses — same
reason lamp `reach` does not share `rest`'s box. Measure the **resting** hang body for layout;
let `cover` overflow that box.

Layout pins the **wing / baked-rim band** (canvas row 160 on `hang-rest`, not the
alpha-box bottom at y=195) to the sheet edge. The sheet **face** (background,
radius, shadow) sits in front of the body copy and behind a clip-path wing copy —
that hides the straight cut under Puhu and leaves only the hands on the rim.

Login and signup wire the set via `useAuthHang` (`auth-shell.tsx`). Name/email focus →
`look-down`, password focus → `cover`, idle blink/gaze otherwise.

Pipeline (from a magenta `#FF00FF` export):

```bash
node apps/web/scripts/key-alpha.mjs raw.png out.png --key=ff00ff --hard=70 --soft=150 --max=384
```

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

## Desk reading scene (`desk/`)

Defterlerim's desk Puhu (`(app)/notebooks/_components/desk-puhu.tsx`): he sits on the stack of
books with a teal book open in both wings, reads left page then right page, looks up when a
notebook is lifted, waves when a new one lands, and swings his feet over the top book's edge.

| File             | Content                                                            | Canvas    |
| ---------------- | ------------------------------------------------------------------ | --------- |
| `read-left.png`  | Reading, pupils on the left page; the base the others are cut from | 360 × 384 |
| `read-right.png` | Same, pupils on the right page                                     | 360 × 384 |
| `blink.png`      | Same, eyes closed                                                  | 360 × 384 |
| `peek-left.png`  | Same, pupils up and toward the viewer's left                       | 360 × 384 |
| `peek-right.png` | Same, pupils up and toward the viewer's right                      | 360 × 384 |
| `wave.png`       | One wing waving, the book in the other, smiling                    | 360 × 384 |
| `foot-left.png`  | The left foot alone                                                | 360 × 384 |
| `foot-right.png` | The right foot alone                                               | 360 × 384 |

None of the body frames have feet: both feet are their own layers on the same canvas, drawn over
the body and swung in CSS about the pivots in `DESK_PUHU_ART`. Belly was painted in where the feet
overlapped it, so a swing never uncovers a hole. The eye frames are `read-left` with only what
changed around the glasses pasted in, so cutting between them moves the eyes and nothing else.

Built from six image-generator edits of one render (magenta background, same canvas and pose,
feet hanging clear of the body), named as the table minus feet (`read-left.png` … `wave.png`):

```bash
node apps/web/scripts/desk-puhu-sprites.mjs path/to/raw-frames --max=384
```

The script crops all of them with one box, keys them through `key-alpha.mjs` and prints the canvas,
`seat` and the two foot pivots. Copy those into `DESK_PUHU_ART` whenever the art changes. The raw
frames are not in the repo; keep them with the design files so the set can be rebuilt.

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
