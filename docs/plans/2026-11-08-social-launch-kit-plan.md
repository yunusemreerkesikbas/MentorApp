# Social launch kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `marketing/social/`, a standalone Remotion project. One command renders the 15
launch-kit pieces (PNG stills, MP4 Reels with cover PNGs, and a `caption.txt` per piece) into
`out/`.

**Architecture:** A single Remotion project renders both stills (`<Still>` + `renderStill`) and
Reels (`<Composition>` + `renderMedia`).
- **Pure data in plain TS modules:** piece list, sizes, copy, captions, art paths, the copy
  rules. Vitest tests these without a browser.
- **React components:** one per piece, built from small shared parts (Frame, Logo, Phone…).
- **`scripts/render.ts`:** bundles once, refuses to run if any copy breaks the rules, then
  renders.
- **`scripts/compare.ts`:** pixel-diffs the six designed pieces against reference PNGs of the
  approved canvas.

**Tech Stack:** Node ≥22, npm (own lockfile), TypeScript, React 19, Remotion 4 (`remotion`,
`@remotion/cli`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/google-fonts`), Vitest,
tsx, sharp.

**Spec:** [docs/plans/2026-11-07-social-launch-kit-design.md](2026-11-07-social-launch-kit-design.md)
(approved by the owner 2026-11-08). Read it first. It holds the copy for the new pieces, the
asset table, the phone recipe and the anti-goals.

## Global Constraints

- Everything lives in `marketing/social/`. Do not touch `apps/`, `packages/`,
  `pnpm-workspace.yaml`, turbo or CI. Install with `npm` inside `marketing/social/` only.
- Pin exact versions (`npm i -E`). All `@remotion/*` packages and `remotion` share one version.
  Add no dependencies beyond the Tech Stack list.
- Copy rules, enforced by `checkCopy`:
  - no "AI" (write "yapay zekâ"), no "Son şans", no "Kaçırma", no "Duolingo"
  - no em dash
  - at most one "!" per sentence
  - exams always written `KPSS · YKS · LGS · ALES · DGS`
- Never use CSS `textTransform`. Turkish copy is typed in its final case, because
  `uppercase` turns "i" into "I", not "İ".
- Sizes: feed 1080×1350, story and reel 1080×1920, landscape 1200×675. Reels run at 30 fps,
  H.264.
- Safe zones:
  - Story: the top and bottom 250 px stay free.
  - Reel: text sits inside x 60–900 and y 250–1500.
  - Feed: 56 px margins.
  - Landscape: 48 px margins.
- Colours: use `C` from `src/brand.ts` (spec "Brand and format constraints"). Fonts: Nunito
  700/800/900/1000 and Caveat 700, subsets `latin` and `latin-ext`.
- Motion is snappy, with springs that overshoot (squash, pop, stamp). No slow fades. Cut on a
  15-frame (0.5 s) beat grid.
- Exports use `EXPORT_PROPS` (`guides: false`, `safe: false`). The dashed link and poll
  guides never appear in `out/`.
- Commits: the owner commits only on request. At each "Commit" step, ask the owner. Without a
  go-ahead, leave the changes uncommitted. Work on the current branch.

## Review Focus

1. **Copy typed in caps** ("KAÇIRMA", "SON ŞANS") must still be caught. `checkCopy` lowercases
   with the `tr` locale. Task 1 tests the caps cases and greps `src/` for `textTransform`.
2. **The dashed "Bağlantı çıkartması buraya" guide must not reach a posted Story.** Task 1 pins
   `EXPORT_PROPS`. In Task 3, the S1–S3 compare runs against references rendered with guides
   off, so a leaked guide fails the diff.
3. **A renamed or missing art file** should fail fast, not blank an image halfway through a
   batch. Task 1 tests that every `ART` path exists under `public/`.
4. **Reel timing:** the end card must hold at least 2 s, and the cover frame must fall inside
   the video. Task 1 tests the timings in `PIECES`.
5. **Copy edited later with a banned phrase** must stop the render before any rendering
   happens. Task 1 tests `checkAll` with bad samples. Task 2 verifies that `npm run render`
   exits 1 on an injected "AI".

---

### Task 1: Project skeleton, rules and assets

**Files:**
- Create: `marketing/social/package.json`, `tsconfig.json`, `.gitignore` (`node_modules/`,
  `out/`), `props-safe.json` (`{"guides":false,"safe":true}`)
- Create: `marketing/social/src/brand.ts`, `src/pieces.ts`, `src/art.ts`, `src/copy.ts`,
  `src/captions.ts`, `src/copy-check.ts`
- Create: `marketing/social/public/art/` (16 files), `reference/` (6 PNGs + `canvas/`)
- Test: `marketing/social/test/copy-check.test.ts`, `test/pieces.test.ts`, `test/art.test.ts`

**Interfaces:**
- Produces:
  - `src/brand.ts`:
    - `C` with keys `blue #2F55D4`, `yellow #FFE082`, `navy #0F2233`, `night #0B1636`,
      `nightDeep #07122A`, `tint #DCE6FF`, `tint2 #E3EAFF`, `tintInk #1F3C99`,
      `screen #F4F7FF`, `cream #FAF6F0`, `dot #E6DEC8`, `paper #FFFDF8`, `inkBlue #1A5FA3`,
      `grey #4B5563`, `mutedOnNight #C9D4EA`, `sky #9CCBF5`, `pupil #55ACEE`
    - `EXAMS = 'KPSS · YKS · LGS · ALES · DGS'`, `SITE = 'puhukoc.com'`,
      `HANDLE = '@puhukoc'`, `FONT_SUBSETS = ['latin', 'latin-ext'] as const`
  - `src/pieces.ts`:
    - `type PieceId = 'F1'|'F2'|'F3'|'F4'|'F5'|'F6'|'S1'|'S2'|'S3'|'S4'|'R1'|'R2'|'R3'|'X1'|'L1'`
    - `type Format = 'feed'|'story'|'reel'|'landscape'`
    - `SIZES: Record<Format, {width: number; height: number}>`
    - `type Piece = { id: PieceId; format: Format; title: string; cards?: number; video?: { fps: 30; durationInFrames: number; endCardFrom: number; coverFrame: number } }`
    - `PIECES: Piece[]`, `compositionIds(p: Piece): string[]`, `BEAT = 15`
    - `type GuideProps = { guides: boolean; safe: boolean }`,
      `EXPORT_PROPS: GuideProps`, `STUDIO_PROPS: GuideProps`
  - `src/art.ts`: `ART` (keys `p1 p2 p3 phone mindBlown nightShift facepalm cryingLaughing
    masa w2 nightCity readPuhu happy proud encouraging night` → `art/<file>` paths),
    `type ArtKey = keyof typeof ART`
  - `src/copy.ts`: `COPY: Partial<Record<PieceId, Record<string, string>>>`, starting as `{}`.
    Each piece task adds its entry.
  - `src/captions.ts`: `type Caption = { text: string; alt: string | string[] }`,
    `CAPTIONS: Partial<Record<PieceId, Caption>>` (`{}`),
    `HASHTAGS = '#kpss #yks #lgs #ales #dgs #sınavahazırlık #dersçalış #puhukoç'`
  - `src/copy-check.ts`: `checkCopy(text: string): string[]` and
    `checkAll(copy: typeof COPY, captions: typeof CAPTIONS): { where: string; problem: string }[]`.
    `where` is `"F1.head"` or `"F1.caption"`.

- [ ] **Step 1: Scaffold and install**

`package.json` (`"type": "module"`, `"private": true`) scripts:
`"studio": "remotion studio src/index.ts"`, `"render": "tsx scripts/render.ts"`,
`"compare": "tsx scripts/compare.ts"`, `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`.
The tsconfig uses `strict`, `jsx: react-jsx`, `module: ESNext`, `moduleResolution: Bundler`
and `target: ES2022`.

Run in `marketing/social/`:
`npm i -E remotion @remotion/cli @remotion/bundler @remotion/renderer @remotion/google-fonts react react-dom`
then `npm i -D -E typescript @types/react @types/react-dom @types/node vitest tsx sharp`.
Expected: `npm ls remotion @remotion/cli @remotion/bundler @remotion/renderer @remotion/google-fonts`
shows one Remotion version for all five.

- [ ] **Step 2: Copy art and references**

From `art-source.local/social/keyed/`, copy these into `public/art/` under the same names:
`p1-referee-whistle.png`, `p2-over-glasses.png`, `p3-wink-peek.png`,
`phone-3d-screen-hole.png`, `sticker-mind-blown.png`, `sticker-night-shift.png`,
`sticker-facepalm.png` and `sticker-crying-laughing.png`.

From `apps/web/public/`, copy into `public/art/`:
- `visuals/landing/room-masa.webp` → `room-masa.webp`
- `visuals/waitlist/w2.webp` → `w2.webp`
- `visuals/onboarding/welcome-scene-4-end.webp` → `night-city.webp`
- `mascot/puhu/desk/read-left.png` → `read-puhu.png`
- `mascot/puhu/puhu-{happy,proud,encouraging,night}.png`, keeping their names

Copy `art-source.local/social/reference/{F1,F2,F3,S1,S2,S3}.png` to `reference/`. Copy
`art-source.local/social/canvas/*` to `reference/canvas/`. These are the approved artboards.
The canvas `/_blob/<id>` map is in the spec's Art table.
Expected: 16 files in `public/art/`, 6 PNGs in `reference/`.

- [ ] **Step 3: Write the failing tests**

```ts
// test/copy-check.test.ts
expect(checkCopy('Yerini kap!')).toEqual([]);
expect(checkCopy('Hadi! Başla!')).toEqual([]);            // one "!" per sentence
expect(checkCopy('Hadi başla!!')).toHaveLength(1);
expect(checkCopy('AI koçun hazır')).toHaveLength(1);
expect(checkCopy('MAIL kutun')).toEqual([]);              // word boundary
expect(checkCopy('yapay zekâ koçun')).toEqual([]);
expect(checkCopy('Son şans, kaçırma')).toHaveLength(2);
expect(checkCopy('SON ŞANS, KAÇIRMA')).toHaveLength(2);   // tr-locale lowercase
expect(checkCopy('Puhu — yanında')).toHaveLength(1);      // em dash
expect(checkAll({ F1: { head: 'AI yasak!!' } }, { F1: { text: 'Kaçırma', alt: 'x' } }))
  .toEqual(expect.arrayContaining([
    expect.objectContaining({ where: 'F1.head' }),
    expect.objectContaining({ where: 'F1.caption' }),
  ]));
expect(checkAll(COPY, CAPTIONS)).toEqual([]);             // the real copy stays clean
// no textTransform anywhere under src/ (read every file, expect no match of /textTransform/)
```

```ts
// test/pieces.test.ts
const byId = (id: PieceId) => PIECES.find(p => p.id === id)!;
expect(PIECES.map(p => p.id)).toEqual(['F1','F2','F3','F4','F5','F6','S1','S2','S3','S4','R1','R2','R3','X1','L1']);
expect(SIZES).toEqual({ feed:{width:1080,height:1350}, story:{width:1080,height:1920}, reel:{width:1080,height:1920}, landscape:{width:1200,height:675} });
expect(compositionIds(byId('F4'))).toEqual(['F4-1','F4-2','F4-3','F4-4','F4-5']);
expect(compositionIds(byId('F1'))).toEqual(['F1']);
expect(byId('R1').video).toEqual({ fps:30, durationInFrames:300, endCardFrom:180, coverFrame:120 });
expect(byId('R2').video).toEqual({ fps:30, durationInFrames:360, endCardFrom:270, coverFrame:210 });
expect(byId('R3').video).toEqual({ fps:30, durationInFrames:270, endCardFrom:195, coverFrame:120 });
// for every piece with video: duration - endCardFrom >= 60, 0 <= coverFrame < duration, endCardFrom % BEAT === 0
expect(EXPORT_PROPS).toEqual({ guides:false, safe:false });
expect(STUDIO_PROPS).toEqual({ guides:true, safe:false });
expect(FONT_SUBSETS).toContain('latin-ext');
```

```ts
// test/art.test.ts: every ART value exists as a file under public/
for (const p of Object.values(ART)) expect(existsSync(join('public', p))).toBe(true);
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `npm test`. Expected: FAIL, because the modules do not exist yet.

- [ ] **Step 5: Implement the six `src/` modules with the values above**

`checkCopy` lowercases with `toLocaleLowerCase('tr')` before matching the banned phrases. It
matches `AI` case-sensitively with `\bAI\b`. It splits sentences after `.`, `!`, `?` or `…`
followed by whitespace, and counts the "!" in each sentence.

- [ ] **Step 6: Run the tests and typecheck**

Run: `npm test && npm run typecheck`. Expected: all pass.

- [ ] **Step 7: Commit** (see Global Constraints)

```bash
git add marketing/social
git commit -m "Social kit: project skeleton, copy rules, art"
```

---

### Task 2: Render pipeline, shared parts and F1 end to end

**Files:**
- Create: `src/fonts.ts`, `src/phone-matrix.ts`, `src/diff.ts`, `src/index.ts`, `src/Root.tsx`
- Create: `src/components/Frame.tsx`, `SafeZones.tsx`, `Logo.tsx`, `Sparkle.tsx`, `Phone.tsx`,
  `MasaChip.tsx`
- Create: `src/pieces/F1.tsx`, `scripts/render.ts`, `scripts/compare.ts`
- Modify: `src/copy.ts` (F1 entry), `src/captions.ts` (`formatCaption`, F1 caption)
- Test: `test/phone-matrix.test.ts`, `test/diff.test.ts`, `test/captions.test.ts`

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces:
  - `fonts.ts`: `nunito: string`, `caveat: string` (fontFamily values from
    `@remotion/google-fonts` `loadFont`, with `FONT_SUBSETS`)
  - `phone-matrix.ts`:
    - `PHONE = { width: 470, height: 922, screenWidth: 378, screenHeight: 822, radius: 48 }`
    - `BASE_MATRIX: number[]`, holding the 16 numbers from the spec's Phone mockup section
    - `screenMatrix(phoneWidth: number): string`, which returns `matrix3d(...)`
  - `Frame({ format, background, color, safe, children })`: sets the canvas size from `SIZES`,
    `overflow: hidden`, Nunito, and the `SafeZones` overlay.
  - `SafeZones({ format, show })`: translucent red bands for the format's safe zone.
  - `Logo({ size, color, pupil })`: the Bakış wordmark. Copy the SVG circles from any canvas
    file.
  - `Sparkle({ x, y, size, color })`: the 4-point star path from the canvas.
  - `Phone({ width, screen, popOut?, screenBg, style? })`:
    - draws the screen box (378×822, radius 48, `screenBg`, `overflow: hidden`) with
      `transform: screenMatrix(width)` and `transform-origin: 0 0`
    - puts the phone `<Img>` (`width` × `width·922/470`) on top
    - adds an optional unclipped `popOut` layer with the same matrix above it
    - `style` is for position, rotation and the drop-shadow filter
  - `MasaChip({ count, fontSize })`: the "Masada N kişi" pill with a green dot.
  - `diffRatio(a: Uint8Array, b: Uint8Array, delta: number): number`: the share of RGBA pixels
    whose largest channel difference is more than `delta`. Throws if the lengths differ.
  - `formatCaption(c: Caption): string`
  - `Root.tsx`:
    - `COMPONENTS: Partial<Record<PieceId, React.FC<any>>>`
    - registers a `<Still>` or `<Composition>` per `compositionIds`, only for ids present in
      `COMPONENTS`
    - `defaultProps = { ...STUDIO_PROPS, card? }`, where F4 passes `card: n`
  - CLI: `npm run render -- [--only F1,S1]` and `npm run compare -- [--only F1]`.

- [ ] **Step 1: Write the failing tests**

```ts
// test/phone-matrix.test.ts
const nums = (s: string) => s.slice(9, -1).split(',').map(Number);
nums(screenMatrix(470)).forEach((v, i) => expect(v).toBeCloseTo(BASE_MATRIX[i], 6));
const s1 = [1.97177,-0.282196,0,-0.000239064,-0.0154825,2.10933,0,2.01634e-05,0,0,1,0,66.8149,138.401,0,1];
nums(screenMatrix(1000)).forEach((v, i) => expect(v).toBeCloseTo(s1[i], 3));
```

```ts
// test/diff.test.ts (4 pixels = 16 bytes)
const a = new Uint8Array(16).fill(100);
expect(diffRatio(a, a.slice(), 48)).toBe(0);
const b = a.slice(); b[0] = 200;           // one pixel off by 100
expect(diffRatio(a, b, 48)).toBe(0.25);
const c = a.slice(); c[0] = 110;           // off by 10, under delta
expect(diffRatio(a, c, 48)).toBe(0);
expect(() => diffRatio(a, new Uint8Array(12), 48)).toThrow();
```

```ts
// test/captions.test.ts
expect(formatCaption({ text: 'Merhaba', alt: 'Puhu' })).toBe(
  `Merhaba\n\n${HASHTAGS}\n\nAlt metin:\nPuhu\n`);
expect(formatCaption({ text: 'M', alt: ['a', 'b'] })).toBe(
  `M\n\n${HASHTAGS}\n\nAlt metin:\n1. a\n2. b\n`);
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test`. Expected: FAIL on the three new files.

- [ ] **Step 3: Implement `phone-matrix.ts`, `diff.ts` and `formatCaption`**

`screenMatrix(w)` multiplies entries 0, 1, 4, 5, 12 and 13 (0-based) by `w/470`. All other
entries stay as they are.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test`. Expected: PASS.

- [ ] **Step 5: Build the shared components, `fonts.ts`, `index.ts` (`registerRoot`) and
  `Root.tsx`**

Use Remotion `<Img src={staticFile(ART.x)}>` for every image. It holds the render until the
file loads and fails loudly if the file is missing.

- [ ] **Step 6: Port F1 from `reference/canvas/Main.dc.html`**

Rebuild the markup with `Frame`, `Logo`, `Sparkle`, `Phone` (`width 470`,
`style: left 580, top 636, rotate 4deg, drop-shadow 0 36px 46px rgba(6,14,40,.45)`,
`popOut` = the masa image at `left 7, top 60, 359×219`) and `MasaChip`. Keep every position,
size and colour from the file. `{{bg}}` becomes `C.blue`. Put the visible strings in
`COPY.F1`, copied verbatim from the canvas file.

Add the F1 caption: 1–3 lines in the energetic voice, plus Turkish alt text describing the
image. Example tone: "Puhu düdüğü çaldı: yalnız çalışmak artık yasak. Masada yerin hazır,
çok yakında puhukoc.com'da."

- [ ] **Step 7: Write `scripts/render.ts`**

1. Run `checkAll(COPY, CAPTIONS)`. If it finds problems, print each `where: problem` and exit
   with code 1 before bundling.
2. `bundle({ entryPoint: 'src/index.ts' })` once, then `getCompositions(serveUrl, { inputProps: EXPORT_PROPS })`.
3. For each `PIECES` entry that matches `--only`:
   - Stills: `renderStill` each composition id to `out/<PieceId>/<compositionId>.png`.
   - Reels: `renderMedia` (`codec: 'h264'`) to `out/<id>/<id>.mp4`, then `renderStill` at
     `coverFrame` to `out/<id>/<id>-cover.png`.
   - If the piece has a caption, write `formatCaption` output to `out/<id>/caption.txt`.
   - If the piece has no registered composition, print a warning and skip it.

- [ ] **Step 8: Write `scripts/compare.ts`**

For each of `F1 F2 F3 S1 S2 S3` that matches `--only` and has `out/<id>/<id>.png`:
1. Load the out PNG and `reference/<id>.png` with sharp (`.ensureAlpha().raw()`).
2. Print `<id> <ratio> ok|FAIL` using `diffRatio(…, 48)`.
3. Exit 1 if any ratio is above `0.03`.

- [ ] **Step 9: Verify F1 end to end**

Run: `npm run render -- --only F1 && npm run compare -- --only F1`.
Expected: `out/F1/F1.png` (1080×1350) and `out/F1/caption.txt` exist, and compare prints
`F1 <≤0.03> ok`.

Open the PNG next to `reference/F1.png`. If the ratio is over the line, fix the port; do not
raise the threshold.

- [ ] **Step 10: Verify the copy gate**

Temporarily change one `COPY.F1` string to contain "AI", then run
`npm run render -- --only F1`. Expected: exit code 1, with `F1.<key>` listed, and no
bundling. Revert the change.

- [ ] **Step 11: Run tests and typecheck, then commit** (see Global Constraints)

Run: `npm test && npm run typecheck`. Expected: PASS.

```bash
git add marketing/social
git commit -m "Social kit: render pipeline and F1"
```

---

### Task 3: The other designed pieces (S1, F2, F3, S2, S3)

**Files:**
- Create: `src/components/TapedNote.tsx`, `src/components/LinkGuide.tsx`
- Create: `src/pieces/S1.tsx`, `F2.tsx`, `F3.tsx`, `S2.tsx`, `S3.tsx`
- Modify: `src/Root.tsx` (register them), `src/copy.ts`, `src/captions.ts`

**Interfaces:**
- Consumes: `Frame`, `Logo`, `Sparkle`, `Phone`, `MasaChip`, `ART`, `C`, `COPY`, `nunito`,
  `caveat`.
- Produces:
  - `TapedNote({ style, tape: { left: number; width: number; rotate: number }, children })`:
    a paper card `C.paper` with a yellow tape strip at opacity 0.85.
  - `LinkGuide({ show, label = 'Bağlantı çıkartması buraya', style })`: renders nothing when
    `show` is false.
  - `S1.tsx` exports the parts R1 animates, each with its canvas position as the default:
    - `PovHeadline({ popPov, slamHead, stampDedin })`: three scale values, 1 = rest
    - `KankaBubble({ scale, rotate })`
    - `PeekPuhu({ y })`: vertical offset in px
    - `StoryPhone({ y, screen: 'video' | 'puhu', wipe, guides, progress })`: `wipe` 0..1
      draws the "Yerini kap!" marker; `progress` 0..1 fills the video bar
    - The default export composes them at rest.

- [ ] **Step 1: Port the five artboards from `reference/canvas/`**

| Piece | File | Values |
|---|---|---|
| S1 | `A-Story.dc.html` | phone width 1000 (`screenMatrix(1000)`) |
| F2 | `C-Post.dc.html` | `{{blue}}` = `C.blue` |
| F3 | `B-Post.dc.html` | `{{night}}` = `C.night` |
| S2 | `B-Story.dc.html` | `{{lamp}}` = `C.yellow` |
| S3 | `C-Story.dc.html` | `{{blue}}` = `C.blue` |

`<sc-if value="{{linkGuide}}">` becomes `<LinkGuide show={guides} …>`. Copy the strings
verbatim into `COPY`. That includes F3's "Tüm sınavlara tek puhu yeter", which is the owner's
own edit; keep it exactly. For S1's video screen (used only by R1): background `#111827`, a
white play triangle in a 120 px circle, and a white progress bar along the bottom.

- [ ] **Step 2: Add the five captions with alt text**

- [ ] **Step 3: Render and compare all six designed pieces**

Run: `npm run render -- --only F1,F2,F3,S1,S2,S3 && npm run compare`.
Expected: six lines ending in `ok`, every ratio ≤ 0.03. Because the references have guides
off, a leaked guide in S1–S3 fails here.

- [ ] **Step 4: Check the safe zones**

Run `npx remotion still src/index.ts S1 out/check/S1-safe.png --props=./props-safe.json`, and
the same for S2 and S3.
Expected: no text and no link-sticker area inside the red top and bottom 250 px bands. The
S1 masa card is allowed there; it is decor.

- [ ] **Step 5: Run tests and typecheck, then commit** (see Global Constraints)

Run: `npm test && npm run typecheck`. Expected: PASS.

```bash
git add marketing/social
git commit -m "Social kit: designed stories and posts"
```

---

### Task 4: New feed pieces F4 (5 cards), F5, F6

**Files:**
- Create: `src/pieces/F4.tsx`, `F5.tsx`, `F6.tsx`
- Modify: `src/Root.tsx`, `src/copy.ts`, `src/captions.ts`

**Interfaces:**
- Consumes: `Frame`, `Logo`, `Sparkle`, `Phone`, `MasaChip`, `TapedNote`, `ART`, `C`.
- Produces: `ExamBadge({ exam: string; size: number; rotate: number })`, exported from
  `F5.tsx`: a round stamp with a white fill, an 8 px `C.navy` ring, and the exam name in
  Nunito 1000 `C.blue`. R3 reuses it.

- [ ] **Step 1: Settle the feature claims**

Run: `git grep -n "Gizli Kahraman" -- apps/web/src apps/api/src`.
- If committed code has a hit, card 3 uses the spec line with the nickname.
- If there is no hit, use the spec fallback: "Akşam · Haftanın özeti hazır. Ne kadar
  çalıştığını Puhu not etti."

Then check each claim the kit makes in `sinav-kocluk-roadmap.md`: daily plan, study table,
weekly summary, human koç (F4 cards 1–4, and the same three in L1). Any claim the roadmap does
not list for the first release goes back to the owner before export. Note each result in a
short comment at the top of `F4.tsx`.

- [ ] **Step 2: Build F4 as one `CarouselCard({ card })` component**

Direction A: `C.blue` ground, white Nunito 1000, yellow accents, sparkles. Each card has:
- the time word at 150 px in `C.yellow`
- the line at 56 px white
- a `Phone` (width 470, rotated 4–6°, cut off by the bottom edge) showing that card's screen,
  with two or three big elements

| Card | Content |
|---|---|
| 1 | Carousel title "Puhu'yla bir gün" above "Sabah". Screen: "Bugün" with three checklist rows. |
| 2 | Screen: F1's screen with the masa pop-out. |
| 3 | Screen: "Bu hafta" with a big total time and the nickname chip, or the fallback. |
| 4 | Screen: a koç message bubble "Bu hafta harika gidiyorsun." with a plain avatar circle. Use no real names or photos. |
| 5 | No phone. "Yerini kap!" at 196 px in yellow, `puhukoc.com`, a "ÇOK YAKINDA" pill, and P1 bursting in from the side. |

All copy comes verbatim from the spec's F4 row.

- [ ] **Step 3: Build F5 and F6 (direction C)**

Ground for both: cream `C.cream` with the 36 px dot grid. Headline text 110–126 px, Caveat
notes at 54–70 px in `C.inkBlue`.

**F5:**
- "Hangi sınava hazırlanıyorsun?" plus five `ExamBadge`s at 220 px with rotations between −6°
  and 6°, laid out as 3 + 2.
- `ART.encouraging` points at the badges, with the note "yorumlara yaz, Puhu sayıyor."
- Logo and handle at the bottom.

**F6:**
- Two side-by-side paper panels (`TapedNote`, about 476 px wide each).
- Left: "Tek başına çalışırken ben:" with `ART.nightShift`.
- Right: "Masada Puhu'larla ben:" with `ART.cryingLaughing`.
- A small logo at the bottom.

- [ ] **Step 4: Add the captions**

F4's `alt` is an array of 5 strings. F5's caption asks for the exam in the comments.

- [ ] **Step 5: Render and check margins**

Run: `npm run render -- --only F4,F5,F6`, then `npx remotion still src/index.ts F5 out/check/F5-safe.png --props=./props-safe.json`.
Expected: `out/F4/F4-1.png` … `F4-5.png`, `out/F5/F5.png` and `out/F6/F6.png`, all
1080×1350. No text crosses the 56 px margin bands.

Look at each PNG: one dominant headline, and no text over a face.

- [ ] **Step 6: Run tests and typecheck, then commit** (see Global Constraints)

Run: `npm test && npm run typecheck`. Expected: PASS. `checkAll` still returns `[]`.

```bash
git add marketing/social
git commit -m "Social kit: carousel, exam question and meme posts"
```

---

### Task 5: S4 poll Story, X1 and L1

**Files:**
- Create: `src/pieces/S4.tsx`, `X1.tsx`, `L1.tsx`
- Modify: `src/Root.tsx`, `src/copy.ts`, `src/captions.ts`

**Interfaces:**
- Consumes: `Frame`, `Logo`, `Phone`, `LinkGuide` (with `label="Anket çıkartması buraya"`),
  `ART`, `C`, `screenMatrix`.

- [ ] **Step 1: Build S4**

- Diagonal split: `C.night` above the line from (0, 1250) to (1080, 650), `C.blue` below.
- Title "Sen hangi / çalışma tipisin?" at 110 px white, starting at y ≥ 280.
- `ART.night` labelled "Gece kuşu" in the night half; `ART.happy` labelled "Sabahçı" in the
  day half.
- Poll guide box 620×220 centred, between y 1380 and 1600, toggled by `guides`.

- [ ] **Step 2: Build X1**

F1 in landscape, 1200×675:
- Headline left: "YALNIZ ÇALIŞMAK" at 96 px, "YASAK!" at 130 px in yellow.
- Exam row, and `puhukoc.com @puhukoc` at the bottom left.
- Phone (width 300, rotated 4°) with the masa pop-out, plus P1 mirrored at about 330 px,
  both on the right.
- All inside 48 px margins.

- [ ] **Step 3: Build L1**

Calm Companion register: no sparkles, no stamps.
- `C.night` ground, with `ART.w2` filling the right half (`object-fit: cover`).
- Left column: the spec title at 64 px white, the body at 26 px in `C.mutedOnNight`, and
  `puhukoc.com`.

- [ ] **Step 4: Add the captions**

The L1 caption uses the calmer register, with the same rules.

- [ ] **Step 5: Render and check safe zones**

Run: `npm run render -- --only S4,X1,L1`, then render S4 and X1 with `--props=./props-safe.json`.
Expected:
- S4 is 1080×1920 with nothing in the 250 px bands.
- X1 and L1 are 1200×675 with nothing past the 48 px margins.
- No guide box in `out/S4/S4.png`.

- [ ] **Step 6: Run tests and typecheck, then commit** (see Global Constraints)

```bash
git add marketing/social
git commit -m "Social kit: poll story, X and LinkedIn cards"
```

---

### Task 6: Motion helpers, end card and R1

**Files:**
- Create: `src/motion.ts`, `src/components/EndCard.tsx`, `src/pieces/R1.tsx`
- Modify: `src/Root.tsx`, `src/copy.ts`, `src/captions.ts`
- Test: `test/motion.test.ts`

**Interfaces:**
- Consumes: the `S1.tsx` parts (`PovHeadline`, `KankaBubble`, `PeekPuhu`, `StoryPhone`),
  `Logo`, `BEAT`, `PIECES`.
- Produces:
  - `SNAPPY`: a spring config.
  - `pop(frame: number, fps: number, at: number): number`: scale, 0 before `at`.
  - `slam(frame, fps, at): number`: scale, from ≥1.6 down to 1.
  - `slideUp(frame, fps, at, distance): number`: translateY, from `distance` to 0.
  - `shake(frame, at): number`: degrees, decaying to 0 within 12 frames.
  - `EndCard({ ground, ink, pupil, puhu?: ArtKey, enter: number })`: Logo 96 px, `SITE`
    64 px, `HANDLE` 36 px and a yellow "ÇOK YAKINDA" pill, each popping in from `enter`.

- [ ] **Step 1: Write the failing motion tests**

```ts
const fps = 30, at = 30, f = (fn: (x: number) => number, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => fn(from + i));
expect(pop(at - 1, fps, at)).toBe(0);
expect(Math.max(...f(x => pop(x, fps, at), at, at + 20))).toBeGreaterThanOrEqual(1.05); // overshoot
expect(Math.abs(pop(at + 14, fps, at) - 1)).toBeLessThanOrEqual(0.03);                    // settles fast
expect(slam(at, fps, at)).toBeGreaterThanOrEqual(1.6);
expect(Math.abs(slam(at + 12, fps, at) - 1)).toBeLessThanOrEqual(0.03);
expect(slideUp(at - 1, fps, at, 400)).toBe(400);
expect(Math.min(...f(x => slideUp(x, fps, at, 400), at, at + 20))).toBeLessThan(0);    // overshoots past 0
expect(Math.abs(slideUp(at + 14, fps, at, 400))).toBeLessThanOrEqual(12);
expect(shake(at + 12, at)).toBeCloseTo(0, 1);
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- motion`. Expected: FAIL.

- [ ] **Step 3: Implement `motion.ts`**

Build on Remotion `spring` and `interpolate`. Tune `SNAPPY` (damping, stiffness, mass) until
the overshoot and settle tests pass. Those tests are what "energetic" means.

- [ ] **Step 4: Run them and confirm they pass**

Run: `npm test -- motion`. Expected: PASS.

- [ ] **Step 5: Build R1 on the beat grid (frames)**

| Frame | What happens |
|---|---|
| 0 | `pop` the "POV:" pill |
| 15 | `slam` "“Son bir video”" |
| 30 | stamp "dedin." with `slam` |
| 45 | `slideUp` the phone, showing the video screen; the progress bar fills over 45–135 |
| 60 | `slideUp` P2 from behind the phone |
| 90 | `pop` the bubble, plus `shake` |
| 135 | flip the screen to the Puhu screen (a quick 6-frame squash) |
| 150 | marker `wipe` 0→1 over 9 frames |
| 180 | `EndCard` (`ground C.blue`, `puhu: 'p2'`; switch to the P6 phone-hug art if the owner delivers it) |
| 180–300 | hold |

- [ ] **Step 6: Add the R1 copy and caption**

- [ ] **Step 7: Render R1 and check it**

Run: `npm run render -- --only R1`, then `npx remotion ffprobe out/R1/R1.mp4`.
Expected: 10.00 s, 1080×1920, h264, 30 fps, plus `out/R1/R1-cover.png`. The cover shows the
headline, Puhu and the bubble, with the key text between y 285 and 1635.

Then render stills at frames 0, 50, 95, 140, 200 with
`npx remotion still src/index.ts R1 out/check/R1-<n>.png --frame=<n>` and look at them. Text
must stay inside x 60–900 and y 250–1500.

- [ ] **Step 8: Run tests and typecheck, then commit** (see Global Constraints)

```bash
git add marketing/social
git commit -m "Social kit: motion helpers and the POV reel"
```

---

### Task 7: R2 "Masa doluyor" and R3 "Rozet ritmi"

**Files:**
- Create: `src/pieces/R2.tsx`, `src/pieces/R3.tsx`
- Modify: `src/Root.tsx`, `src/copy.ts`, `src/captions.ts`

**Interfaces:**
- Consumes: `pop`, `slam`, `slideUp`, `shake`, `EndCard`, `MasaChip`, `ExamBadge`, `ART`,
  `C`, `BEAT`.

- [ ] **Step 1: Build R2 (A ground, 360 frames)**

| Frame | What happens |
|---|---|
| 0 | `MasaChip count={0}` |
| 30, 60, 90, 120 | `ART.happy`, `ART.proud`, `ART.encouraging` and `ART.night` each `pop` into a 2×2 arrangement; the chip count steps 1→4 on the same frames |
| 150 | the four fly out and `ART.masa` `slam`s in |
| 180 | "YALNIZ ÇALIŞMAK" + "YASAK!" stamp across with `slam` + `shake` |
| 270 | `EndCard` |
| 270–360 | hold |

- [ ] **Step 2: Build R3 (C cream ground, 270 frames)**

| Frame | What happens |
|---|---|
| 15, 30, 45, 60, 75 | the five `ExamBadge`s stamp in with `slam` |
| 90 | the mind-blown, night-shift and facepalm stickers `pop` beside them |
| 105 | "Hangisi senin?" |
| 150 | "Yorumlara yaz." |
| 195 | `EndCard` on `C.cream` with navy ink |
| 195–270 | hold |

- [ ] **Step 3: Add the copy and captions for R2 and R3**

- [ ] **Step 4: Render and check**

Run: `npm run render -- --only R2,R3`, then `npx remotion ffprobe` on both MP4s.
Expected: R2 lasts 12.00 s and R3 9.00 s, both 1080×1920 h264 at 30 fps, with cover PNGs.
Spot-check the stills at frames 125 and 200 (R2) and 80 and 160 (R3) against the Reel safe
zone.

- [ ] **Step 5: Run tests and typecheck, then commit** (see Global Constraints)

```bash
git add marketing/social
git commit -m "Social kit: table and exam badge reels"
```

---

### Task 8: Complete captions, full render, owner review

**Files:**
- Create: `marketing/social/README.md`, `test/captions-complete.test.ts`
- Modify: `src/captions.ts` (fill any gaps)

- [ ] **Step 1: Write the completeness test**

```ts
for (const p of PIECES) {
  const c = CAPTIONS[p.id];
  expect(c, p.id).toBeDefined();
  expect(c!.text.split('\n').filter(Boolean).length).toBeLessThanOrEqual(3);
  if (p.id === 'F4') expect(c!.alt).toHaveLength(5);
  else expect(typeof c!.alt === 'string' && c!.alt.length > 0).toBe(true);
}
```

- [ ] **Step 2: Run the tests**

Run: `npm test`. Expected: PASS, or fill the missing captions until it does.

- [ ] **Step 3: Write the README**

Keep it under 30 lines. Cover:
- install: `npm ci`
- `npm run studio`
- `npm run render [-- --only …]`
- `npm run compare`
- where to edit copy (`src/copy.ts`, `src/captions.ts`)
- how to swap in P5/P6 art
- the posting order (link to the spec)

- [ ] **Step 4: Full render and checks**

Run: `npm run render && npm run compare && npm test && npm run typecheck`.
Expected:
- `out/` holds 15 folders, each with its files and a `caption.txt`.
- compare prints six `ok` lines.
- tests and typecheck pass.

- [ ] **Step 5: Owner review**

Send the owner the `out/` contents: a contact sheet of the stills plus the three MP4s. Fix
what they flag, then re-run Step 4.

- [ ] **Step 6: Commit** (see Global Constraints)

```bash
git add marketing/social
git commit -m "Social kit: captions, README, full render"
```
