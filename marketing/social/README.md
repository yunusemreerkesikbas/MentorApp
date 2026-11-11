# PuhuKoç social launch kit

15 launch pieces (feed, story, reel, X, LinkedIn), 6 Premium pieces (PF1, PF2, PS1, PS2, PR1, PR2), the promo film T1
and the feature ads (wave 1: IF1–IF6, IS1–IS6, IR1), rendered with Remotion.
Feature ads spec: [docs/plans/2026-11-10-feature-ads-design.md](../../docs/plans/2026-11-10-feature-ads-design.md). T1's spec: [docs/plans/2026-11-08-promo-video-design.md](../../docs/plans/2026-11-08-promo-video-design.md).
Spec and posting order: [docs/plans/2026-11-07-social-launch-kit-design.md](../../docs/plans/2026-11-07-social-launch-kit-design.md#posting-order-no-dates).

## Run

- `npm ci`: install.
- `npm run studio`: preview and tweak every piece in the browser.
- `npm run render`: render everything to `out/<id>/` (PNG or MP4 + cover, plus `caption.txt`).
  Render a few with `npm run render -- --only F1,R2`. The copy check runs first and stops on a rule break.
- `npm run render -- --only T1`: the 62 s promo film "Ekrana dalış" (music and effects) to `out/T1/`.
  Its scenes live in `src/t1/`: `timeline.ts` holds every scene and beat, `sfx.ts` places and levels the
  effects (sources and licences in `art-source.local/social/gen/sfx-sources.md`).
- `npm run compare`: check F1–F3, S1–S3, PF1, PF2, IF1 and IS2 against the approved canvas in `reference/`.
- `npm test` and `npm run typecheck` before you post.

## Edit

- On-image text: `src/copy.ts`. Post text, hashtags and alt text: `src/captions.ts`.
- Art lives in `public/art/` and is listed in `src/art.ts`.
- ChatGPT + Kling prompts for the same pieces: [PROMPTS.md](PROMPTS.md).
- Premium: when Premium can be bought, set `PREMIUM_SALE_OPEN = true` in `src/copy.ts` and re-render
  `--only PF1,PF2,PS1,PS2,PR1,PR2`. Feed posts and the reels never say ÇOK YAKINDA (they stay on the profile).

## P5 / P6 art

When the owner's art arrives as a keyed PNG:
1. Save it to `public/art/` and add a key in `src/art.ts` (e.g. `p5: "art/p5-speed-study.png"`).
2. P5: swap `ART.readPuhu` for `ART.p5` in `src/pieces/S3.tsx`.
3. P6: add `"p6"` to `END_CARD_PUHU` in `src/art.ts` (a test checks it has no cropped edge), then set `puhu="p6"` on the `EndCard` in `src/pieces/R1.tsx`.
4. `npm run render -- --only S3,R1`.

## Feature ads ("Puhu iş başında" + POV)

- A feed post is `SeriesFeed` (`src/components/Series.tsx`) plus one Puhu and one feature element; a POV
  story is `PovStory` (`src/components/Pov.tsx`) plus one Puhu and the card's rows. Pieces live in
  `src/pieces/IF.tsx`, `IS.tsx` and `IR1.tsx`. The number in an id is the feature (1 odak seansı, 2 haftalık
  plan, 3 Yanlış Defterim, 4 deneme analizi, 5 masa, 6 haftalık lakap).
- New Puhus come from Higgsfield (recipe and credits in the spec). When the render has a studio backdrop
  (gradient, floor shadow) instead of flat magenta, key it with
  `node art-source.local/social/tools/key-studio.mjs in.png out.png` from the repo root, then scale it to
  1400 px into `public/art/`.
- In a story, a full-body Puhu starts at y 760 or lower so it never covers the "dedin." line.
- `caption.txt` of these pieces ends with the paid fields: "Reklam başlığı" (40 characters at most) and "Buton".
