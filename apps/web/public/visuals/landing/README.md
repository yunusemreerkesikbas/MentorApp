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
| `desk-puhu-*.webp` | "Sabah masası": the Defterlerim desk Puhu's sprites (`mascot/puhu/desk/`): `left`, `right`, `blink` eye frames and both feet, all on the set's shared canvas so they stack |
| `desk-board.webp` | "Sabah masası": the filled goal board, 1620 × 1080 shrunk to 810. Cork, the Kolaj template's photo slots, the app's stickers. The goal card is left empty for the page's text |
| `desk-recap-*.webp` | "Sabah masası": smaller copies of the weekly story's art (`visuals/weekly-recap-2023/`, `img/character/nebula-diver.png`) |

The four board photos are the owner's Puhu-world art (originals in the gitignored
`art-source.local/landing-board/`). The board was baked by screenshotting an SVG of the board in
Chromium, with each photo first cut to its slot, then encoded with sharp. To change the board,
re-bake it the same way; the slot geometry is `templateSlots("collage")`.

Every file ships twice: `.webp` and an `.avif` of the same name (about half the bytes). The scene
asks for AVIF first; swap both when replacing art. Encoded with sharp:
`sharp(file).avif({ quality: 55, effort: 7 })`.

Pipeline: generated on flat `#FF00FF`, keyed like `scripts/key-alpha.mjs` (edge-only despill), WebP.
Replacing the facade means re-measuring the window map: the windows are DOM boxes over the art.
