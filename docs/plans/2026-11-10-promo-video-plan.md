# Promo video T1 "Ekrana dalış" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also load the `remotion-best-practices` skill (router) and its `remotion-markup` reference before writing scene code.

**Goal:** Add kit piece `T1`, the 58 s 9:16 promo film "Ekrana dalış", to the Remotion kit in
`marketing/social/`, rendered with `npm run render -- --only T1` into an MP4, a cover PNG and
`caption.txt`.

**Architecture:** T1 is one reel composition built from 17 scene components on a named
`Track`, a music `Audio`, an overlay track for cross-cut transitions (flashes, streaks) and a
sound-effect track. All timing lives in one data module, `src/t1/timeline.ts` (scene windows,
beat events, clip cuts), which Vitest checks without a browser; scenes read their local
frame from the `Sequence` they sit in. Kling clips go through one `ClipScene` part that
crops the KlingAI mark by scaling 6 % from the top centre.

**Tech Stack:** the kit's own (npm with its own lockfile, TypeScript, React 19, Remotion
4.0.541, Vitest, tsx, sharp) plus `@remotion/media` 4.0.541 for `<Video>` and `<Audio>`.

**Spec:** [docs/plans/2026-11-08-promo-video-design.md](2026-11-08-promo-video-design.md).
Read it first: the scene table (frames 01–17) holds what happens on screen, the copy and the
sources. Storyboard: social canvas, board `Promo-Storyboard.dc.html` (local copy
`art-source.local/social/canvas/`). Kit conventions: [README](../../marketing/social/README.md)
and the earlier [kit plan](2026-11-08-social-launch-kit-plan.md).

## Global Constraints

- Work only in `marketing/social/` (plus `art-source.local/` for raw captures). Do not touch
  `apps/`, `packages/`, turbo or CI. Install with npm inside `marketing/social/`.
- All `@remotion/*` packages and `remotion` stay on one exact version (4.0.541). Add
  `@remotion/media` with `npx remotion add @remotion/media`; no other new dependency.
- Film: 1080×1920, 30 fps, H.264, **58 s = 29 bars at 120 BPM = 1740 frames**, `endCardFrom:
  1680`, beat `BEAT = 15` frames. The music drop lands on frame 240 (scene 05).
- Copy rules (`checkCopy`): no "AI" (write "yapay zekâ"), no "Son şans", "Kaçırma",
  "Duolingo", no em dash, at most one "!" per sentence, exams written
  `KPSS · YKS · LGS · ALES · DGS`. No "ÇOK YAKINDA" and no "PREMIUM" anywhere in T1.
- Never CSS `textTransform`; Turkish copy is typed in its final case ("BU HAFTAKİ LAKABIN").
- Reel safe zone: text inside x 60–900 and y 250–1500; centred blocks above y 900 may span
  x 60–1020. On a clip scene words sit on the plain wall in the top third.
- Remotion rules (skill): animate only from `useCurrentFrame()` with `interpolate()` /
  `spring()` (the kit's `pop`, `slam`, `slideUp`, `shake`); no CSS `transition` or
  `animation`. Keep `useCurrentFrame()` in the smallest component that needs it. In new code
  prefer the CSS `scale`, `translate`, `rotate` properties over a `transform` string. Every
  `Sequence`, `Audio` and `Video` gets a literal `name`.
- Puhu motion is snappy and exaggerated: anticipation, overshoot, short holds. One or two
  things move per beat. Nothing calm or floaty.
- Night grounds are `#0D0E25` with 4-point sparkles; handwritten notes use Caveat.
- Clips play through `<Video>` from `@remotion/media`. If a clip fails to decode in a render,
  switch that one to the kit's `OffthreadVideo` (as in `src/pieces/PR1.tsx`), same props.
- Nothing is committed unless the owner asks. Each task ends with a checkpoint instead
  (`git status` shows only that task's files). If the owner asks to commit, branch from
  `master` first.

## Review Focus

1. **The KlingAI mark shows on a clip scene.** The mark sits at y 96–98 %, x 78–96 % of every
   Kling clip; after the 6 % top-centre scale it must start below y 1920. Pinned by the
   `ClipScene` geometry test in Task 4.
2. **A clip runs out before its scene ends** (a black or frozen gap), because of a trim or
   speed mismatch. Pinned by the clip-cut test in Task 4: every cut fills its scene window
   exactly and never reads past 5,04 s.
3. **Words over a busy part of a clip or outside the safe zone.** Each scene task renders its
   check stills with the safe-zone overlay (`--props='{"safe":true}'`) and the step lists what
   to look for.
4. **Real user data in the frame 08 screen captures.** Task 3 captures only a fresh local dev
   account filled by the dev seed, and its check step looks for names, e-mails and avatars.
5. **"ÇOK YAKINDA", "PREMIUM" or a reward number sneaking into T1.** Pinned by the copy test
   in Task 1 and the EndCard test in Task 10 (the kit's `EndCard` already renders nothing for
   `tag={null}`, so it needs no change); the chest scene's check step looks for an XP or Coin
   number.

---

### Task 1: Register T1, the timeline, the copy and the music

**Files:**
- Modify: `marketing/social/src/pieces.ts`, `marketing/social/src/Root.tsx`,
  `marketing/social/src/art.ts`, `marketing/social/src/copy.ts`,
  `marketing/social/src/captions.ts`, `marketing/social/package.json` (+ lockfile),
  `marketing/social/test/pieces.test.ts`, `marketing/social/test/art.test.ts`
- Create: `marketing/social/src/t1/timeline.ts`, `marketing/social/src/t1/T1.tsx`,
  `marketing/social/public/audio/t1-music.mp3` (copy of `art-source.local/social/gen/promo-music.mp3`),
  `marketing/social/test/t1-timeline.test.ts`, `marketing/social/test/t1-copy.test.ts`

**Interfaces:**
- Produces:
  - `PieceId` gains `"T1"`; `PIECES` ends with
    `{ id: "T1", format: "reel", title: "Tanıtım · Ekrana dalış", video: { fps: 30, durationInFrames: 1740, endCardFrom: 1680, coverFrame: 475 } }`.
  - `src/t1/timeline.ts`:
    - `type SceneId = "01" | … | "17"`
    - `type Scene = { id: SceneId; name: string; from: number; durationInFrames: number }`
    - `const SCENES: readonly Scene[]` (frames, global)
    - `const sceneOf = (id: SceneId): Scene`
    - `const EVENTS: Record<SceneId, Record<string, number>>` (frames, scene-local; filled
      scene by scene in Tasks 5–10, start with `{}` for each)
  - `SOUND` map in `src/art.ts`: `{ t1Music: "audio/t1-music.mp3" }`.
  - `COPY.T1`: every on-screen string below. `CAPTIONS.T1`: caption + alt.
  - `export function T1({ safe }: PieceProps)` in `src/t1/T1.tsx`, registered in `COMPONENTS`.

Scene windows (seconds; from the spec's structure table):

| id | name | from–to | | id | name | from–to |
|---|---|---|---|---|---|---|
| 01 | Kanca | 0–1,5 | | 10 | Puhu'nun odası | 28–32 |
| 02 | Bildirim | 1,5–2,5 | | 11 | Defter | 32–36 |
| 03 | K1 dalış | 2,5–6 | | 12 | Masa | 36–40 |
| 04 | Sınavlar | 6–8 | | 13 | Topluluk | 40–44 |
| 05 | Albüm | 8–12 | | 14 | Sandık | 44–48 |
| 06 | Pano | 12–16 | | 15 | Lakap | 48–52 |
| 07 | Şehrin üstünde | 16–20 | | 16 | Senin odan | 52–54,5 |
| 08 | Ekranlar | 20–24 | | 17 | Final | 54,5–58 |
| 09 | Odalar | 24–28 | | | | |

`COPY.T1` (exact strings; the spec's copy section says which are the app's own):

```ts
T1: {
  hookA: "“Son bir video”", hookB: "dedin.", notifName: "Puhu", notif: "Kanka, bu 7. son.",
  come: "Gel, sana bir şey göstereyim!",
  exams1: "Sınavın hangisi olursa olsun,", exams2: "Puhu yanında!", exams: "KPSS · YKS · LGS · ALES · DGS",
  albumQ1: "Doktor mu, mühendis mi?", albumQ2: "Sen hangisisin?",
  stSaglik: "Dr. Puhu", stMuhendislik: "Müh. Puhu", stHukuk: "Av. Puhu", stYazilim: "Kodcu Puhu", stEgitim: "Öğretmen Puhu",
  stIsletme: "Patron Puhu", stSosyal: "Sunucu Puhu", stSanat: "Ressam Puhu", stFen: "Prof. Puhu", stMimarlik: "Mimar Puhu",
  planla: "PLANLA", board1: "Hedefini", board2: "duvara as!",
  pol1: "kampüs", pol2: "kod", pol3: "Konya", pol4: "mezuniyet",
  goalLabel: "HEDEFİM", goal: "Bilgisayar Mühendisi", city: "Konya", note: "kampüste görüşürüz!",
  magic1: "Haftanı", magic2: "Puhu kursun!", card1: "Türkçe 25 dk", card2: "Matematik 40 dk", card3: "Tekrar 15 dk",
  screens: "Denemeni gir, sıradaki konunu gör.", spell: "abrakadabra, hafta hazır", next: "Sıradaki: Geometri",
  odaklan: "ODAKLAN", rooms: "Odanı seç, süreni kur, başla!", roomEv: "Ev", roomKafe: "Kafe", roomKutuphane: "Kütüphane", dial: "25:00",
  finish: "Bitir, serini büyüt!", timerEnd: "00:00", xp: "+5 XP", streak: "4 gün seri", mola: "Mola hazır",
  nb1: "Yanlış soruların", nb2: "artık kaybolmaz!", nbName: "Matematik Defteri", nbTape: "Matematik",
  q1: "3x − 5 = 2x + 4 ise x kaçtır?", n1: "işlem hatası!", q2: "%20'si 45 olan sayı kaçtır?", n2: "oranı ters kurdum",
  q3: "2⁵ · 2³ kaçtır?", n3: "üsler toplanır!", page1: "1 / 3", page2: "2 / 3", page3: "3 / 3",
  review: "Bugün 2 tekrar", solved: "ÇÖZDÜM",
  birlikte: "BİRLİKTE", masa: "Arkadaşlarınla aynı masada çalış.",
  ask1: "Takıldın mı?", ask2: "Topluluğa sor, Puhu’ya yaz.",
  zeynepName: "Zeynep", zeynep: "Paragrafta hep son soruda takılıyorum.",
  canName: "Can", can: "Önce soru kökünü oku, sonra metne dön.", clap: "12 alkış",
  puhuName: "Puhu", puhu: "Seanslarına baktım: bugün 10 paragraf yeter.",
  days: "5 gün masadaydın!", devirdin: "Haftayı devirdin!", chest: "Sandığın hazır!",
  story1: "Hafta bitti mi?", story2: "Hikâyen hazır!", nickLabel: "BU HAFTAKİ LAKABIN",
  nick1: "Seri Canavarı", nick2: "Korkusuz Denemeci", nick3: "Odak Makinesi",
  nickMsg: "Tek oturuşta 50 dakika! Seni durdurmak imkânsız.",
  light1: "Işığın yanıyorsa,", light2: "yalnız değilsin.",
  end1: "PLANLA.", end2: "ODAKLAN.", end3: "PUHU İLE.",
},
```

`CAPTIONS.T1` (owner reviews it in Task 12): text
`"“Son bir video” dedin, Puhu seni içeri çekti. 📱\nPlanla, odaklan, Puhu ile çalış: puhukoc.com"`;
alt: one paragraph describing the film in order (phone at night, Puhu dives into the screen,
career stickers, vision board, Puhu's plan magic over the night city, focus rooms, mistake
notebook, the four Puhus at the table, community messages, the weekly chest and nickname card,
the lit window and "PLANLA. ODAKLAN. PUHU İLE.").

- [ ] **Step 1: Write the failing tests**

`test/pieces.test.ts`: append `"T1"` to the expected id list (after `"PR2"`; rename the test to
"…then the 6 Premium pieces, then T1") and add:
```ts
it("pins the promo film's timing", () => {
  expect(byId("T1").video).toEqual({ fps: 30, durationInFrames: 1740, endCardFrom: 1680, coverFrame: 475 });
});
```
`test/t1-timeline.test.ts`:
```ts
it("lays the 17 scenes end to end from frame 0 to 1740, each starting on the beat", () => {
  // ids "01".."17" in order; scenes[0].from === 0; each from === previous from + duration;
  // last ends at 1740; every from % BEAT === 0
});
it("puts the drop on scene 05, the cover inside scene 06 and the end card inside scene 17", () => {
  expect(sceneOf("05").from).toBe(240);
  // coverFrame 475 within scene 06; endCardFrom 1680 within scene 17 and 1740 - 1680 >= 60
});
it("keeps every beat event inside its scene and on the beat grid", () => {
  // for each scene, each EVENTS value v: 0 <= v < durationInFrames and v % BEAT === 0
});
```
`test/t1-copy.test.ts`:
```ts
it("keeps ÇOK YAKINDA, PREMIUM and reward numbers out of T1", () => {
  const strings = Object.values(COPY.T1!);
  expect(strings.filter((s) => s.includes(SOON) || /PREMIUM/i.test(s) || /\bCoin\b/.test(s))).toEqual([]);
  // the only XP string is the session reward "+5 XP" (frame 10), never on the chest
  expect(strings.filter((s) => /XP/.test(s))).toEqual(["+5 XP"]);
});
```
`test/art.test.ts`: the "finds every art file and clip" test also covers `Object.values(SOUND)`.

- [ ] **Step 2: Run them, expect FAIL**

Run: `cd marketing/social && npx vitest run test/pieces.test.ts test/t1-timeline.test.ts test/t1-copy.test.ts test/art.test.ts`
Expected: FAIL (`T1` missing, `src/t1/timeline` not found, `SOUND` not exported).

- [ ] **Step 3: Implement**

- `npx remotion add @remotion/media` (check `package.json` pins `4.0.541`).
- Copy the music: `cp ../../art-source.local/social/gen/promo-music.mp3 public/audio/t1-music.mp3`.
- `pieces.ts`, `timeline.ts` (SCENES from the table, `sec = (s: number) => Math.round(s * 30)`),
  `art.ts` (`SOUND`), `copy.ts` (`COPY.T1`), `captions.ts` (`CAPTIONS.T1`).
- `T1.tsx`: `<Frame format="reel" background={C.blue} safe={safe}>` (as in `src/pieces/R2.tsx`) holding
  `<Track name="Sahneler">` with one `<Sequence name={"NN · name"} from durationInFrames>` per
  scene (placeholder: the scene id and name in white Nunito 1000 on alternating blue / night
  grounds, so timing can be reviewed against the music) and
  `<Audio name="Müzik" src={staticFile(SOUND.t1Music)} />` from `@remotion/media`.
- `Root.tsx`: add `T1` to `COMPONENTS`.

- [ ] **Step 4: Run the whole suite and the type check, expect PASS**

Run: `npm test && npm run typecheck`
Expected: all green (the existing copy and caption tests now cover T1 too).

- [ ] **Step 5: Check the music and the timeline by ear**

Run: `npx remotion ffprobe public/audio/t1-music.mp3` → duration `00:00:58.0x`.
Run: `npm run studio`, open `T1`: the placeholder cards change on the beat, "05 · Albüm"
appears with the drop at 0:08, the beat drops out at 0:44 and the track ends with the card at
0:58.

- [ ] **Step 6: Checkpoint** (`git status` shows only this task's files; no commit unless asked).

---

### Task 2: Copy the film's art and clips into the kit

**Files:**
- Create under `marketing/social/public/art/t1/`: the files in the table below.
- Modify: `marketing/social/src/art.ts`, `marketing/social/test/art.test.ts`

**Interfaces:**
- Produces `ART` keys (path `art/t1/<file>`) and `CLIPS` keys:

| Key(s) | File(s) | From |
|---|---|---|
| `t1CareerSaglik`, `…Muhendislik`, `…Hukuk`, `…Yazilim`, `…Egitim`, `…Isletme`, `…Sosyal`, `…Sanat`, `…Fen`, `…Mimarlik` | `career-<name>.webp` (10) | `apps/web/public/mascot/career-3d/{saglik,muhendislik,hukuk_kamu,yazilim,egitim,isletme,sosyal_iletisim,sanat_tasarim,fen,mimarlik}.webp` |
| `t1Board1`…`t1Board4` | `board-v1-kampus.webp` … `board-v4-mezuniyet.webp` | `art-source.local/landing-board/` |
| `t1Facade`, `t1CityFar`, `t1CityMid`, `t1CityFront` | `city-facade.webp`, `city-far.webp`, `city-mid.webp`, `city-front.webp` | `apps/web/public/visuals/landing/` |
| `t1RoomHomeBg`, `t1RoomHomeTable`, `t1RoomCafeBg`, `t1RoomCafeTable`, `t1RoomLibraryBg`, `t1RoomLibraryTable` | `room-*-bg.webp`, `room-*-table.webp` | `apps/web/public/img/seans-theme/` |
| `t1DeskPuhuLeft`, `t1DeskPuhuRight`, `t1DeskPuhuBlink`, `t1DeskPuhuPeek` | `desk-puhu-left.webp`, `-right.webp`, `-blink.webp`, `desk-puhu-peek.png` | `apps/web/public/visuals/landing/`; the peek from `art-source.local/social/promo/rev5/` |
| `t1ChestOpen`, `t1DeskChestClosed` | `chest-open.webp`, `desk-chest-closed-tall.webp` | `apps/web/public/visuals/chest/` |
| `t1CharFocus`, `t1CharStreak`, `t1CharBrave` | `char-nebula-diver.png`, `char-time-bender.png`, `char-phoenix-pilot.png` | `apps/web/public/img/character/` |
| CLIPS `t1K1`, `t1K3`, `t1K4`, `t1K5` | `art/t1/promo-K1.mp4` … `promo-K5.mp4` | `art-source.local/social/gen/` |
| CLIPS `t1Magic`, `t1Chest` | `art/t1/puhu-hero-magic-loop.mp4`, `art/t1/chest-open-tall.mp4` | `apps/web/public/mascot/puhu/motion/`, `apps/web/public/visuals/chest/` |

- [ ] **Step 1: Write the failing test**

`test/art.test.ts`: `SMALL_OK` becomes the deliberately small art: `readPuhu`, the ten
`t1Career*` keys (320 px squares: the white ground is the sticker card), the four
`t1DeskPuhu*` keys (360 px) and `t1ChestOpen` (384 px). The "keeps small art out" test reads
`src/t1/` recursively as well as `src/pieces` and `src/components` (`readdirSync(d, { recursive: true })`, files only).
The existing "finds every art file and clip" test then fails for every new key.

- [ ] **Step 2: Run it, expect FAIL**

Run: `npx vitest run test/art.test.ts` → FAIL listing the missing `art/t1/…` files.

- [ ] **Step 3: Copy the files and add the keys** (one `cp` per row; keep the comment style of
  `art.ts`: one line per group saying what it is and its size).

- [ ] **Step 4: Run it, expect PASS**: `npx vitest run test/art.test.ts && npm run typecheck`.

- [ ] **Step 5: Checkpoint.**

---

### Task 3: Capture the real app screens for scene 08

**Files:**
- Create: `art-source.local/social/promo/screens/plan.png`, `…/deneme.png` (raw captures),
  `marketing/social/public/art/t1/screen-plan.png`, `…/screen-deneme.png`
- Modify: `marketing/social/src/art.ts` (`t1ScreenPlan`, `t1ScreenDeneme`)

- [ ] **Step 1: Start the local stack** (API + web, the dev database). Create a fresh dev
  account `promo-demo@puhukoc.test` through the normal sign-up and onboarding (exam: YKS),
  then fill it with `pnpm --filter @mentor/api seed:analysis-demo -- --email=promo-demo@puhukoc.test`.
  Sign-up is invite-only: use an invite code made in the dev database, never a real person's.
  Never use production or a real person's account.
- [ ] **Step 2: Fill the week.** In the app, let Puhu build the weekly plan ("Koçla planla") so
  the plan shows Türkçe, Matematik and Tekrar tasks, matching the scene 07 cards as closely as
  the app allows. If "Koçla planla" is locked for the account, add the tasks by hand on `/plan`.
- [ ] **Step 3: Capture** `/plan` and the deneme result on `/analiz` with Playwright at a
  378×822 viewport, `deviceScaleFactor: 3`, no browser bar, light theme, Turkish locale. Close
  toasts and banners first.
- [ ] **Step 4: Check the captures**: no e-mail, no real name (the demo account's display
  name only), no avatar photo, no debug or dev overlays, no English strings. Then copy them to
  `public/art/t1/` and add the two keys.
- [ ] **Step 5: Verify**: `npx vitest run test/art.test.ts` passes. **Checkpoint.**

---

### Task 4: Shared T1 parts and clip cuts

**Files:**
- Create: `marketing/social/src/t1/parts/ClipScene.tsx`, `…/parts/StickerWords.tsx`,
  `…/parts/Sunburst.tsx`, `…/parts/Flash.tsx`, `marketing/social/test/t1-clips.test.ts`
- Modify: `marketing/social/src/t1/timeline.ts` (`CLIP_CUTS`, `CLIP_SCALE`, `CHEST_JUMP`)

**Interfaces:**
- Produces (in `timeline.ts`):
  - `type Cut = { at: number; clipStart: number; clipEnd: number; frames: number }`
    (`at`: scene-local frame; `clipStart`/`clipEnd`: seconds in the clip; playback rate is
    derived: `rate(c) = (c.clipEnd - c.clipStart) * 30 / c.frames`)
  - `const CLIP_CUTS: Record<"K1" | "K3" | "K4" | "K5" | "chest", { scene: SceneId; cuts: Cut[] }>`
  - `const CLIP_SCALE = 1.06` and `const KLING_MARK_TOP = 0.96` (share of clip height)
  - `const CHEST_JUMP = [1.6, 1.8] as const` (seconds; the chest clip's own jump)
  - `export const rate: (c: Cut) => number`
- Produces (components):
  - `ClipScene({ name, src, cuts, scale = CLIP_SCALE, top = 0 }: { name: string; src: string; cuts: Cut[]; scale?: number; top?: number })`:
    a full-width layer from y `top` down; one muted `<Video>` from `@remotion/media` per cut
    inside its own named `<Sequence from={cut.at} durationInFrames={cut.frames}>`, with
    `trimBefore`/`trimAfter` in frames and `playbackRate={rate(cut)}`, scaled `scale` from the
    top centre. The chest clip (mark already cropped in the app) passes `scale={1}` and a `top`
    that leaves the night strip.
  - `StickerWords({ lines, top, at, size? })`: the spec's sticker type: white, second line
    `#FFE082`, thick navy `#1E2A5A` outline, hard navy drop shadow, centred in x 60–1020,
    each line `slam`s in on its own beat (`at[i]`, scene-local) with a 2-frame `shake`.
  - `Sunburst({ cx, cy })`: R2's `repeating-conic-gradient` rays on the blue ground.
  - `Flash({ at, color })`: a full-screen colour flash peaking 2 frames after `at`, gone by
    `at + 12`.

Clip cuts (from the delivered clips; see the spec's asset table):

| Clip | Scene | Cuts (`at`: clipStart→clipEnd, frames) | Why |
|---|---|---|---|
| K1 | 03 | 0: 0,25→4,30, 105 | climb, two beckons, flip, dive; ends as his feet vanish, under scene 03's white flash |
| K3 | 10 | 0: 0,30→4,95, 120 | glasses push, turbo study, book slam (~3,4 s), cheer |
| K4 | 12 | 15: 0,30→4,50, 105 | after the notebook-to-table match cut; wave, high-fives, back to books |
| K5 | 16 | 15: 0,25→1,35, 33 · 48: 3,55→4,45, 27 | jump cut: spring onto the desk and wave, then the two-wing point; skips the peek behind the chair |
| chest | 14 | 45: 0,40→1,60, 32 · 77: 1,80→3,60, 43 | the lid starts opening (1,3 s) in the first cut; the cut skips the clip's own jump (1,6–1,8 s) at frame 77, the peak of the gold `Flash` at event 75; gold burst, cheer |

- [ ] **Step 1: Write the failing tests** (`test/t1-clips.test.ts`):
```ts
it("fills each clip scene's window exactly, in order, without gaps", () => {
  // for each clip: cuts sorted by at; each next.at === prev.at + prev.frames;
  // last.at + last.frames === sceneOf(scene).durationInFrames
});
it("never reads past a clip's end and keeps the speed between 1x and 1.3x", () => {
  // 0 <= clipStart < clipEnd <= 5.04 (chest: <= 5.0); 1 <= rate(c) <= 1.3
});
it("pushes the KlingAI mark out of frame", () => {
  expect(KLING_MARK_TOP * 1920 * CLIP_SCALE).toBeGreaterThanOrEqual(1920);
});
it("never shows the chest clip's jump", () => {
  // no chest cut overlaps CHEST_JUMP (clipEnd <= 1.6 or clipStart >= 1.8)
});
```
(The flash-over-the-cut half is pinned in Task 10, once `EVENTS["14"].flash` exists: the
chest's second cut starts within 4 frames after it.)

- [ ] **Step 2: Run, expect FAIL**: `npx vitest run test/t1-clips.test.ts`.
- [ ] **Step 3: Implement** the timeline additions and the four parts.
- [ ] **Step 4: Run, expect PASS**: `npm test && npm run typecheck`.
- [ ] **Step 5: Check one clip in Studio**: temporarily drop `ClipScene` for K1 into scene 03's
  placeholder; the clip fills the frame, no KlingAI text in the bottom-right at any frame,
  Puhu's head tufts never clipped at the top. Keep it in (Task 5 builds around it).
- [ ] **Step 6: Checkpoint.**

---

### Tasks 5–10: the scenes

Common to every scene task:
- One component per scene in `marketing/social/src/t1/scenes/S<NN>.tsx`
  (`export function S05() …`), reading its local frame; it replaces the placeholder in its
  `Sequence` in `T1.tsx`. Copy comes from `COPY.T1`, art from `ART`/`CLIPS`, beats from
  `EVENTS["NN"]`.
- **Step A: add the scene's beat events** to `EVENTS` (table in each task, scene-local
  frames). Run `npx vitest run test/t1-timeline.test.ts` (PASS: on the grid, inside the
  scene). Sub-beat staggers (pills, ray pops) are constants inside the component, offsets from
  a beat event.
- **Step B: build the scene(s)** to the spec's row: what happens, what it says, which source.
  Transitions that cross a cut (spec "Transitions, in order") live on `<Track name="Geçişler">`
  in `T1.tsx` with global frames from `sceneOf(id).from + EVENTS[id].x`.
- **Step C: render the check stills** with the safe-zone overlay:
  `npx remotion still src/index.ts T1 out/t1-check/<frame>.png --frame=<frame> --props='{"safe":true}'`
  for the frames listed in the task, and look at each one for: words inside the safe zone and
  on the plain wall on clip scenes, no word on Puhu's face, Turkish letters right, Puhu on model.
- **Step D: watch the scene in Studio at full speed** with the music: every event lands on a
  hit, motion is snappy, nothing floats.
- **Step E:** `npm test && npm run typecheck`, then **checkpoint**.

### Task 5: Scenes 01–04 (hook, notification, K1 dive, exams)

| Scene | Events (local frames) | Check stills (global) |
|---|---|---|
| 01 | `hookA: 0, hookB: 15, clock: 0` | 10, 30 |
| 02 | `notif: 0, shake: 0, peek: 15` | 55 |
| 03 | `clip: 0, come: 15, flash: 90` | 90, 140, 170 |
| 04 | `land: 0, line1: 0, line2: 15, pills: 15` (5 pills 8 frames apart) | 200, 235 |

- 01–02: night `#0D0E25`, the kit's `Phone` sized and placed so its outline matches the phone
  in K1's first frame (a match cut into 03; measure K1 at clip time 0,25 s). The screen plays a
  generic coded video with a "01:47" clock. Notification card: Puhu avatar, `notifName`,
  `notif`; `p2` peeks over his glasses from the screen edge.
- 03: `ClipScene` K1; `come` as `StickerWords` in the empty navy top third; white `Flash` and
  speed lines at `flash` as the camera follows him in.
- 04: blue + `Sunburst`; the host Puhu (`ART.host`) lands with a squash and sways his wings
  (coded rotate on the still); `exams1`/`exams2`; the five pills from `exams.split(" · ")`.

### Task 6: Scenes 05–06 (career album, vision board)

| Scene | Events | Check stills |
|---|---|---|
| 05 | `page: 0, q1: 0, pair1: 15, pair2: 30, pair3: 45, pair4: 60, pair5: 75, q2: 90, peel: 105` | 250, 330, 355 |
| 06 | `planla: 0, board: 0, pol1: 15, pol2: 30, pol3: 45, pol4: 60, goal: 75, note: 90, heart: 90, kodcu: 105` | 380, 440, 475 (cover) |

- 05: album page on the sunburst, numbered slots in a 3-2-3-2 brick; stickers are the career
  art on their own white ground with a navy name strip (`st*` copy), slapped two per beat with
  a small rotate and overshoot. The Kodcu sticker peels at a corner and tears off on `peel`.
- 06: the board drops on a string and nail (wood frame, dotted kraft ground); polaroids with
  Caveat captions; goal card `goalLabel · goal · city`; yellow note; heart and star pop; the
  Kodcu sticker from 05 lands on the goal card's corner (transition 2). `planla` as the big
  slam, `board1`/`board2` under it. The cover frame 475 shows the full board under "PLANLA",
  with the Kodcu sticker already settled.

### Task 7: Scenes 07–08 (Şehrin üstünde, real screens)

| Scene | Events | Check stills |
|---|---|---|
| 07 | `streak: 0, loop: 0, words: 15, card1: 45, card2: 60, card3: 75` | 490, 540, 590 |
| 08 | `fly: 0, tick1: 15, tick2: 30, tick3: 45, spell: 45, slide: 60, next: 75, circle: 105` | 610, 680, 715 |

- 07: gold streak off the board turns the screen to night (transition 3); sky as the app's
  `plan-coach-stage.css`, `t1CityFar`/`Mid`/`Front` along the bottom; `CLIPS.t1Magic` in a
  soft round mask in the middle (its ground ~`#0E0F26` never shows an edge); each card pops
  from the wand's star and fans out; `magic1`/`magic2`.
- 08: the cards fly into the `Phone` (transition 4); the screen shows `t1ScreenPlan`, coded
  ticks land on its tasks; Caveat `spell`; the screen slides to `t1ScreenDeneme`; the
  `next` chip pops; an empty coded circle grows (transition 5 into scene 09's ring).

### Task 8: Scenes 09–10 (room carousel, K3)

| Scene | Events | Check stills |
|---|---|---|
| 09 | `odaklan: 0, ev: 15, kafe: 30, kutuphane: 45, dial: 60, words: 75` | 735, 770, 830 |
| 10 | `ring: 0, finish: 15, timer: 60, xp: 75, streak: 90, mola: 90, slip: 105` | 850, 920, 955 |

- 09: rooms slide like a carousel, one per beat (`-bg` full screen), the timer ring fixed in
  the middle with that room's `-table` inside, the chips follow; the dial clicks to `dial`.
- 10: the ring grows past the edges and opens on `ClipScene` K3 (transition 6); `finish` on
  the wall; the ring timer races to `timerEnd` by `timer`; `xp`, `streak` (flame) and `mola`
  pop as opaque chips clear of Puhu's face; the question slip shoots out of the book on `slip`.

### Task 9: Scenes 11–12 (notebook, K4)

| Scene | Events | Check stills |
|---|---|---|
| 11 | `slip: 0, lift: 15, fill: 30, page1: 45, page2: 60, page3: 75, review: 90, solved: 105, peek: 105` | 970, 1020, 1070 |
| 12 | `slide: 0, cut: 15, birlikte: 15, words: 30` | 1085, 1150, 1190 |

- 11: the app's Defterlerim desk (warm wall, wood desk, desk Puhu reading with the blink
  frame); the "Matematik Defteri" (`nbName`, `nbTape`) lifts, flies at the camera, opens; three
  lined pages turn one per beat with `page1..3`, a taped question and a red-pen Caveat note
  (`q1/n1` is the app's question, then `q2/n2`, `q3/n3`); `review`, the green `solved` stamp,
  desk Puhu peeks over the book (`t1DeskPuhuPeek`). Coded, so the questions stay readable.
- 12: the notebook slides onto the top-down study table (`t1RoomHomeTable`), cut to
  `ClipScene` K4 (transition 8); `birlikte` slams on the wall, then `masa`.

### Task 10: Scenes 13–17 (community, chest, nickname card, your room, final)

| Scene | Events | Check stills |
|---|---|---|
| 13 | `ask: 0, q: 15, a: 45, puhu: 75` | 1215, 1305 |
| 14 | `days: 0, devirdin: 15, dive: 30, clip: 45, ready: 60, flash: 75, card: 105` | 1335, 1397, 1435 |
| 15 | `spin1: 0, spin2: 15, spin3: 30, stop: 45, words: 60` | 1450, 1500, 1550 |
| 16 | `light: 0, dive: 0, clip: 15` | 1565, 1600, 1630 |
| 17 | `end1: 0, end2: 15, end3: 30, hop: 30, endCard: 45` | 1650, 1700 |

- 13: blue ground; in-app style message cards stack on the beat: `zeynep` (with
  `zeynepName`), `can` with `clap`, then Puhu's yellow bubble `puhu`; `ask1`/`ask2`.
- 14: the messages slide away and night falls (transition 9); `days` slams, `devirdin` under
  it; the camera dives into a lit tall window showing `t1DeskChestClosed` (transition 10),
  which hands over to `ClipScene` chest under a thin night strip that keeps the words
  (`devirdin` rides up small, `ready` slams in); gold `Flash` at `flash` (its peak hides the
  cut at 77, so check still 1397 shows full gold); a card shoots out on `card`. No XP or Coin
  number anywhere. Add to `test/t1-clips.test.ts`: the chest's second cut starts between
  `EVENTS["14"].flash` and `EVENTS["14"].flash + 4`.
- 15: gold sunburst; the trading card spins through `t1CharStreak` → `t1CharBrave` →
  `t1CharFocus` (`nick1` → `nick2` → `nick3`) one per beat and snaps on `stop`: gold border,
  art on top, navy band with `nickLabel`, `nick3`, `nickMsg`; `t1ChestOpen` under it;
  `story1`/`story2`.
- 16: the card's gold light flies into the one dark window (top middle) of `t1Facade` at
  night, the window lights, the camera dives in (transition 12) onto `ClipScene` K5;
  `light1`/`light2` on the wall.
- 17: `end1`, `end2`, `end3` stamp on the music's three hits, the host Puhu hops in on
  `hop`, then `<EndCard ground={C.blue} ink="#FFFFFF" puhu="host" enter={EVENTS["17"].endCard} tag={null} />`
  (`enter` is scene-local: the scene's `Sequence` makes frames local). Add to
  `test/t1-copy.test.ts`:
  ```ts
  it("closes T1 on the end card at 1680 with no pill", () => {
    expect(sceneOf("17").from + EVENTS["17"].endCard).toBe(byId("T1").video!.endCardFrom);
    expect(readFileSync("src/t1/scenes/S17.tsx", "utf8")).toMatch(/<EndCard[^>]*\btag=\{null\}/);
  });
  ```

### Task 11: Sound effects

**Files:** `marketing/social/public/sfx/*.mp3`, `src/art.ts` (`SOUND` keys `t1Sfx*`),
`src/t1/T1.tsx` (`<Track name="Efektler">`), `art-source.local/social/gen/sfx-sources.md`.

- [ ] **Step 1: Pick** one royalty-free effect per kind in PROMPTS §6 "Efektler" (ping,
  whoosh, jelly blop, stamp, pop, sticker slap, tear, pin tick, wand sparkle, card swish,
  click, paper rustle, book thump, page flip, high-five slap, lid creak, chime, card flick,
  snap). Source: Pixabay sound effects (Pixabay Content License). **Ask the owner before
  downloading** (file names and sources in one message). Note each source URL and licence in
  `sfx-sources.md`. No meme sounds, nothing from a film or game.
- [ ] **Step 2: Wire** each effect as its own named `<Audio>` on the Efektler track at the
  global frame of its event (`sceneOf(id).from + EVENTS[id].x`), volume 0.5–0.8 under the
  music; the art test's file check covers the new `SOUND` keys.
- [ ] **Step 3: Listen** in Studio end to end; nothing clips or drowns the music's hits.
- [ ] **Step 4: Owner approval** of the effects (play the Studio preview or a draft render).
  **Checkpoint.**

### Task 12: Full render and owner review

- [ ] **Step 1:** `npm test && npm run typecheck`.
- [ ] **Step 2:** `npm run render -- --only T1` → `out/T1/T1.mp4`, `T1-cover.png`,
  `caption.txt`.
- [ ] **Step 3: Check the file**: `npx remotion ffprobe out/T1/T1.mp4` shows 1080×1920,
  30 fps, 58,0 s, H.264 + AAC. Play it once start to end: no black frame at any cut, no
  KlingAI mark, music and picture in sync at 0:08, 0:44 and 0:54,5, end card held 2 s.
- [ ] **Step 4: Owner review**: send the MP4, cover and caption. Ask: the cover (scene 06 at
  frame 475, or scene 17), the caption, and anything to change. Fix and re-render.
- [ ] **Step 5:** update the storyboard canvas notes and the kit README (T1 line under "Run").
  **Checkpoint**; commit only if the owner asks.
