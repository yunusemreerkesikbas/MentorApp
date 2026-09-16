# Onboarding visual assets

## Welcome scenes ("Puhu'nun bir günü")

`welcome-scene-{1..4}.mp4` with `-start.webp` / `-end.webp`, wired in `src/lib/onboarding-assets.ts`
(`WELCOME_SCENES`). Slides 1 and 3 are single-image clips; 2 (AI coach) and 4 (city of lights) run
from a start frame to an end frame.

How they are made from the Kling exports (720×1280, 24 fps):

1. Keep the top 1200 rows. The free export's "KlingAI" watermark sits at y 1225-1265.
2. Encode H.264 at ~1.2 Mbps, no audio (≈750 KB per 5 s).
3. `-start.webp` / `-end.webp` are the encoded clip's first and last frames (WebP q80), so the poster
   matches the first decoded frame and reduced motion can show the end state.

A watermark-free export can replace a clip; keep the 720×1200 frame and regenerate both posters.
Source PNG/MP4 files do not belong in `public/`.

## Career Puhu (soft 3D)

`public/mascot/career-3d/{career_group}.webp`: 320px tiles cropped from the 2×5 model sheet, on a
white ground. Place them with `mix-blend-multiply` (dark theme: normal blend on a rounded tile).

## Clouds

`cloud-left.webp`, `cloud-right.webp`: the route cover that closes over the screen when onboarding
hands you to the panel (`lib/cloud-transition.tsx`). Keyed out of the magenta-screen art in
`public/img/cloud-*.png` — drop the green channel where it sits far below red and blue, pull it back
up at the fringe, then crop to the alpha bounds and save at 1200px wide.

Puhu motion frames live in `public/mascot/puhu/motion/` on one 1024×1024 canvas.
