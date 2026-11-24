# Feature ads, wave 2: implementation plan

> Inline execution (owner, 2026-11-23: "tek oturumda"). Steps use checkbox syntax.

**Goal:** export wave 2's 12 organic pieces and their paid twins with captions.

**Architecture (owner, 2026-11-23):** posts and carousels are canvas boards exported to PNG by
`art-source.local/social/tools/render.mjs`; paid twins are props on the same boards. Only the
four Reels are built in the kit (`marketing/social`, Remotion), because they move.

**Spec:** [2026-11-23-feature-ads-wave2-design.md](2026-11-23-feature-ads-wave2-design.md).

## Global constraints

- Posts and carousels 1080×1350; Reels 1080×1920, 8 s, `{ fps: 30, durationInFrames: 240,
  endCardFrom: 180, coverFrame: 150 }`, silent.
- Shared layer, world colours, art sources and copy rules as in the spec. No "AI", "ücretsiz",
  "sınırsız", invite-only or KVKK wording.
- Paid twin = `hook` (A/B/C headline from the spec's table) + `paid` (footer becomes an
  "App Store · Google Play" placeholder slot). Carousels take `slide`.
- Nothing posted, scheduled or committed; the owner does that.

## Review focus

1. Hook B/C headlines are longer than A: each hook has its own size; every paid PNG is checked
   by eye for fit.
2. Placeholder badge on an organic export, or organic footer on a paid one.
3. Carousel slide counts match the alt texts in `caption.txt`.

---

### Task 1: boards for the nine undesigned pieces, then stop for approval

- [x] Boards in a new canvas row under D2: `D2-Defter-Post` (DFY) and, for each feature, a
      carousel board with `slide` prop showing slides 1–2 (`D2-Pano-Car`, `D2-Album-Car`,
      `D2-Hikaye-Car`, `D2-Defter-Car`), plus `D2-Reels` (a frame strip per Reel at 0, 1.5, 3,
      4.5, 6 s). Render each locally; publish (re-read live `canvas.json` first).
- [x] **Stop until the owner approves.**

### Task 2: paid props on the four posts

- [x] Add `hook` and `paid` props to `D2-Pano-Post`, `D2-Album-Post`, `D2-Hikaye-Post`,
      `D2-Defter-Post`. Render A/B/C × paid for each; check fit.

### Task 3: all carousel slides

- [x] Fill the remaining slides on the four carousel boards (DCP 5, DCK 7, DCH 5, DCY 4) and
      the paid slide 1 / last-slide footer.

### Task 4: export with captions

- [x] A small script renders every board/prop combination into
      `art-source.local/social/out/D2/<id>/` and writes `caption.txt` (text, hashtags, alt per
      slide, paid headline ≤ 40, button "Şimdi Yükle", UTM link).

### Task 5: the four Reels in the kit

- [x] `DRP DRK DRH DRY` in `marketing/social` from the approved frame strips; copy check and
      piece-list test cover them; `npm test`, `npm run typecheck`, render.

### Task 6: check and hand over

- [x] Contact sheet of every export; claims checked against the launch config; owner reviews. Owner approved the final reels (DRH, DRY at 12 s) on 2026-11-23.
