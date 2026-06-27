# Puhu mascot assets

Runtime path for web: `/mascot/puhu/{variant}.png`

## Required files

Copy approved PNG exports here before wiring components:

| File | Variant | Status |
|------|---------|--------|
| `default.png` | Neutral / default | Pending export |
| `happy.png` | Success, celebration | Pending export |
| `encouraging.png` | Pink heart, nudges | Pending export |
| `surprised.png` | Info, alerts | Pending export |
| `proud.png` | Trophy, milestones | Pending export |
| `sleepy.png` | Night, rest | Pending export |
| `winking.png` | Onboarding, avatar | Pending export |
| `thinking.png` | AI loading | **P0 — not yet designed** |
| `gentle-error.png` | Error toast | **P0 — not yet designed** |

## Source

Design sheet and sticker variants from product design. Stitch references: `.stitch/assets/`.

## Usage in code (future)

```tsx
// Example — coach bubble
<img src="/mascot/puhu/encouraging.png" alt="" width={72} height={72} aria-hidden />
```

Alt text empty when decorative; provide `aria-label` on parent interactive region.
