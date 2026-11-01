# Puhu premium glasses: visual proposal

Date: 2026-11-01
Status: first visual proposal, awaiting owner feedback; assets only.

## Intent and direction

Use Puhu's spectacles as a distinctive membership symbol. Explored directions: classic gold-rim round glasses, feather-tipped superhero glasses (recommended), and a one-piece visor. The recommended shape retains the companion's round, friendly expression and echoes its blue ear feathers.

Palette follows DESIGN.md's premium identity: cape blue `#2F55D4`, night blue `#1E2A5A`, clasp gold `#F2B544` and pale gold `#FFD76A`. Rendered artwork uses highlights and shading derived from these colors.

## Deliverables

- `apps/web/public/visuals/premium-glasses.svg`: simplified 64 × 32 vector icon for membership chrome.
- `apps/web/public/visuals/premium-glasses.png`: standalone transparent emblem, 1774 × 887.
- `apps/web/public/mascot/puhu/puhu-premium-v2.png`: matching transparent mascot candidate, 1254 × 1254.

The existing `puhu-premium.png` and runtime premium components remain the active application assets. No subscription logic, entitlement checks or badge placements are changed by this visual proposal.

## Usage and limits

Render the glasses at their intrinsic 2:1 aspect ratio with `object-fit: contain`. Use the simplified SVG at 24–48 CSS px widths beside a display name: visual review found that the detailed raster's fine gold bevel weakens at small sizes. The vector keeps the same silhouette with solid blue fill and thicker gold rims, without filters or embedded images. The raster master is deliberately large for illustration review; prepare optimized delivery variants after the design is accepted. Use an accessible membership label when the emblem is the only status indicator; use empty alt text when adjacent text already says Premium. Do not place the mark on feed/comment avatars or conflate it with verification.

The mascot is a generative edit, so texture and silhouette can vary from the source. Review its edges on both light and dark surfaces before replacing the active mascot.

## Generation

Both images were generated with the built-in image_gen tool, using the existing mascot as reference. The second generation also references the standalone glasses design.

The companion SVG was authored directly as a native vector asset for small-size legibility. Browser visual review covers the vector at widths of 24, 32, 40 and 48 CSS px on the documented light and dark backgrounds; the PNG masters were checked for RGBA transparency. No application runtime code changed.

### Icon prompt

```text
Use case: logo-brand.
Asset type: a production membership status icon for Mentor, a warm exam-preparation companion app.
Input image 1 is a STYLE/CHARACTER REFERENCE only: the white owl Puhu wearing blue round glasses and a royal blue cape with a small gold clasp. Create ONLY its redesigned glasses as a standalone premium emblem, no owl.
Design: a compact pair of front-facing superhero spectacles. Two generously rounded, slightly oval open lens spaces joined by one strong short curved bridge. The outside top corners sweep gently upward into short rounded wing tips inspired by the owl's blue ear feathers. Friendly, quietly confident, not angry, no sharp spikes. Main body is deep sapphire / cape blue (#2F55D4 and #1E2A5A); an elegant warm gold (#F2B544 / #FFD76A) outer bevel communicates premium. Deliberately thick simple silhouette and ample open lens apertures so this reads at 24px. Symmetric and balanced. A pair of eyeglasses, not a face mask; do not add a solid forehead bar.
Style: crisp graphic emblem with restrained enamel-like highlights, nearly flat front view, no perspective, no heavy 3D extrusion. Gold must be broad enough to survive reduction but blue remains the dominant color. Completely clear / empty lens openings with actual alpha transparency, not white disks or blue filled lenses.
Composition: one pair only, horizontally centered, occupies 88% of canvas width, approximately 2:1 width to height overall silhouette, minimal safe padding. Genuine transparent background outside AND within the lens apertures.
Constraints: no pupils, eyes, eyebrows, owl, face, cape, shield, circle badge, crown, diamond, stars, sparkles, words, letters, watermark, cast shadow, glow, checkerboard or background. Use only the glasses as the entire icon.
```

### Mascot prompt

```text
Use case: precise-object-edit.
Asset type: transparent premium mascot variant for the Mentor app.
Input image 1 is the EDIT TARGET: the full white fluffy owl Puhu wearing round blue glasses and a flowing blue cape, one wing raised.
Input image 2 is the EXACT GLASSES DESIGN to wear: royal sapphire blue rounded glasses, warm gold rims, short paired feather-shaped upward outer temple flourishes.
Replace ONLY the original plain round blue eyeglasses in image 1 with the premium superhero spectacles from image 2. Fit the new glasses naturally to the owl's existing face and eye positions. Retain the same rounded eye apertures so the complete original large black/blue eyes and friendly expression remain visible. The new blue feather-like outer tips should be modest and stop short of the owl's actual feather ears. Render matching gold bevels with the same fine soft 3D lighting as the mascot.
Preserve invariants aggressively: same original white fluffy owl identity, round body, ear feathers, cheeks, happy open beak, bright original eyes, eye positions, raised wing pose, other wing, orange feet, chest blue heart, royal blue cape silhouette and fabric texture, gold star clasp, proportions, camera angle and overall framing. Do not add other accessories or redesign the owl. No extra stars, crowns, jewels or symbols.
Remove the reference checkerboard background completely. The output must be a clean full-body cutout with genuinely transparent alpha background, including the negative space around cape, feet, raised wing and feather tufts. Preserve all white fur with clean edges. Do not draw a checkerboard, floor, scenery, contact shadow or backdrop. Keep the complete cape and both feet within frame with comfortable padding.
No text, watermark or border. One owl only.
```

