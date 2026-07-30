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
