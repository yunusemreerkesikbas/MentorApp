# PuhuKoç social launch kit

15 launch pieces (feed, story, reel, X, LinkedIn) and 6 Premium pieces (PF1, PF2, PS1, PS2, PR1, PR2) rendered with Remotion.
Spec and posting order: [docs/plans/2026-11-07-social-launch-kit-design.md](../../docs/plans/2026-11-07-social-launch-kit-design.md#posting-order-no-dates).

## Run

- `npm ci`: install.
- `npm run studio`: preview and tweak every piece in the browser.
- `npm run render`: render everything to `out/<id>/` (PNG or MP4 + cover, plus `caption.txt`).
  Render a few with `npm run render -- --only F1,R2`. The copy check runs first and stops on a rule break.
- `npm run compare`: check F1–F3, S1–S3, PF1 and PF2 against the approved canvas in `reference/`.
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
