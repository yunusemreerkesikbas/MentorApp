# Landing scene ("Işıklı şehir")

The `/` landing's night city. These files only work as a set, so they share a folder (same reason as
`../onboarding/`). Positions and sizes are in `src/app/[locale]/_components/landing/city-scene.ts`.

| File | What |
|---|---|
| `city-far.webp` | L1, far skyline (transparent above the roofline) |
| `city-mid.webp` | L2, mid-distance rooftops |
| `city-facade.webp` | L3, Puhu's apartment block: 8 windows and a door |
| `city-front.webp` | L4, foreground roof corner and branches |
| `room-*.webp` | What each window shows: puhu, koc, plan, masa, topluluk, analiz |
| `stars.svg` | Night sky stars |

| `careers.webp` | The ten career Puhus at the desk, 5 across and 2 down (order in `city-stage.css`) |
| `puhu-undecided.webp` | "Henüz karar vermedim" (a cropped sticker pose until a seated one is drawn) |

Every file ships twice: `.webp` and an `.avif` of the same name (about half the bytes). The scene
asks for AVIF first; swap both when replacing art. Encoded with sharp:
`sharp(file).avif({ quality: 55, effort: 7 })`.

Pipeline: generated on flat `#FF00FF`, keyed like `scripts/key-alpha.mjs` (edge-only despill), WebP.
Replacing the facade means re-measuring the window map: the windows are DOM boxes over the art.
