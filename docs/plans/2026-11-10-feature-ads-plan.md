# Feature ads, wave 1: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans (the owner said
> "Evet, başla"; native, inline execution as with the earlier kit plans). Steps use checkbox syntax.

**Goal:** render the 11 wave-1 pieces of "Puhu iş başında + POV" from the social kit.

**Architecture:** two shared templates (`SeriesFeed`, `PovStory`) hold everything a piece has in
common; a piece is copy, one Puhu and one feature element. The Reel animates the same parts with
the kit's motion helpers. Nothing outside `marketing/social/` changes.

**Tech stack:** Remotion 4.0.541, React 19, TypeScript, vitest, sharp (all already installed).

**Spec:** [2026-11-10-feature-ads-design.md](2026-11-10-feature-ads-design.md). Canvas boards
`F-Koruma-Post`, `F-POV-Story`, `F-Koruma-Video` in `art-source.local/social/canvas/`.

## Global constraints

- Copy rules of the launch kit: no "AI", "Son şans", "Kaçırma", no em dash, at most one "!" per
  sentence. `npm run render` runs the copy check first.
- Tokens from `src/brand.ts` only. Ground `C.blue`, type Nunito 1000/900.
- Story text and the link zone stay out of the top and bottom 250 px. Reel text stays inside
  `REEL_TEXT` / `REEL_CENTRE`.
- Feed posts and the Reel carry no "ÇOK YAKINDA".
- Notification chips use generic glyphs (chat, heart, play, bell). No platform logos.
- No commits: the owner commits.

## Review focus

1. A long quote or bubble line overflows its box. Each piece sets its own type size where the
   default does not fit; the contact sheet is checked by eye.
2. A Puhu PNG with a wide prop (palm, map, magnifier) sits off the end card's axis. `art.test.ts`
   measures it; set `END_CARD_SHIFT`.
3. A sticker guide leaks into an export. `LinkGuide` already hides itself in every render.
4. The series pill changes F1. F1 keeps its own badge; `compare` still passes for F1.
5. Small art in a large slot. `art.test.ts` already fails on mascot art under 600 px.

---

### Task 1: art, ids, timing

**Files:** copy `art-source.local/social/keyed/{b1-koruma,b2-navigasyon,b3-dedektif}.png` to
`public/art/`; modify `src/art.ts`, `src/pieces.ts`, `test/pieces.test.ts`.

**Produces:** `ART.koruma | navigasyon | dedektif`; `"koruma"` in `END_CARD_PUHU`; piece ids
`IF1 IF2 IF3 IF5 IF6` (feed), `IS1 IS2 IS3 IS5 IS6` (story), `IR1` (reel,
`{ fps: 30, durationInFrames: 240, endCardFrom: 180, coverFrame: 150 }`).

- [ ] Extend the piece-list test with the 11 ids after `T1`, and pin IR1's timing. Run: fails.
- [ ] Add the art, keys, ids and `PIECES` rows. Run `npm test`: the list, timing and art tests
      pass; set `END_CARD_SHIFT.koruma` to what the axis test reports.

### Task 2: copy and captions

**Files:** modify `src/copy.ts`, `src/captions.ts`, `test/captions.test.ts`.

**Produces:** `COPY.IF1 … COPY.IR1`; `Caption` gains optional `tags` (replaces the default
hashtag line) and `ad: { headline: string; button: string }`; `formatCaption` prints a
"Reklam başlığı" and "Buton" line when `ad` is set; `SERIES_TAGS`.

- [ ] Test: `formatCaption({ text: "M", alt: "a", tags: "#x", ad: { headline: "H", button: "B" } })`
      equals `"M\n\n#x\n\nAlt metin:\na\n\nReklam başlığı: H\nButon: B\n"`; a headline over 40
      characters fails a new check over `CAPTIONS`. Run: fails.
- [ ] Add the copy from the spec's wave-1 table and a caption, alt text and ad fields for each
      of the 11 pieces. Run `npm test`: caption and copy checks pass.

### Task 3: series feed template and IF1, IF2, IF3, IF5, IF6

**Files:** create `src/components/Series.tsx`, `src/pieces/IF.tsx`; modify `src/pieces/F1.tsx`
(export `F1Art({ badge, safe })`, `F1` keeps `T.badge`), `src/Root.tsx`.

**Produces:** `SeriesFeed({ copy, puhu, headSize?, safe, children })`, `NotifChip`, `TimerPill`,
`SERIES_PILL = "PUHU İŞ BAŞINDA"`.

- [ ] Build `SeriesFeed` to the `F-Koruma-Post` board (positions are in the board file), then
      IF1 from it. IF2: route card with three stops. IF3: taped "ARANIYOR" card with the app's
      sample question. IF5: `F1Art` with the series pill. IF6: yellow nickname card.
- [ ] Render the board with `art-source.local/social/tools/render.mjs` (`bg=#2F55D4`) into
      `reference/IF1.png`, add `IF1` to `scripts/compare.ts`. `npm run render -- --only IF1,F1`
      then `npm run compare`: both at or under 0.03.

### Task 4: POV story template and IS1, IS2, IS3, IS5, IS6

**Files:** create `src/components/Pov.tsx`, `src/pieces/IS.tsx`; modify `src/Root.tsx`.

**Produces:** `PovStory({ copy, puhu, quoteSize?, bubbleSize?, guides, safe, children })`,
`PovCard({ title, chip, children })`, `CardRow({ tag, text, meta })`.

- [ ] Build `PovStory` to the `F-POV-Story` board, then IS2 from it. Reference
      `reference/IS2.png` rendered with `linkGuide=false`; add `IS2` to compare.
- [ ] IS1 (facepalm sticker, timer rows), IS3 (detective, notebook rows), IS5 (referee, masa
      scene), IS6 (host, nickname strip). `npm run compare`: IS2 at or under 0.03.

### Task 5: IR1

**Files:** create `src/pieces/IR1.tsx`; modify `src/Root.tsx`.

- [ ] Beats on the 15-frame grid: hook 0, Puhu and "DUR!" 45, message 90 (headline 96 and 111,
      timer 126), end card 180 with `puhu="koruma"` and the line "Kapıda Puhu var!" as `tag`.
- [ ] `npm run render -- --only IR1`; check frames 30, 60, 150, 210 by eye.

### Task 6: full check

- [ ] `npm test`, `npm run typecheck`, `npm run render -- --only <the 11 ids>`,
      `npm run compare`. Build a contact sheet and review every piece against the spec's
      anti-goals and safe zones. Update `README.md` (piece count, the keyer for studio grounds).
