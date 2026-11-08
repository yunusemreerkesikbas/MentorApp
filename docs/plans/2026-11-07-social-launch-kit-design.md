# Social launch kit design

Date: 2026-11-07. Status: **the owner approved the three visual directions (A main, B and C
supporting), the six designed artboards and the kit lineup in chat. This spec is waiting for the
owner's review. The owner answered the one open question (team size). Nothing is built
yet.**
Visual reference: the directions canvas https://claude.ai/artifact/SbpcGU9oeauc78ZZM71yUK
(a local copy of its source lives in `art-source.local/social/canvas/`, gitignored).

## Intent

PuhuKoç opens invite-only, with a waitlist (`puhukoc.com/kayit` opens the waitlist modal). The
kit grows that waitlist before launch. It is a two-week "açılış kiti" of social posts for young
exam candidates (KPSS · YKS · LGS · ALES · DGS).

The look borrows the playful mascot-brand playbook: flat colour, huge bold type, the mascot
bursting out of the frame, a phone mockup, and meme hooks ("POV", "Kanka", counting jokes). On
social, Puhu can be bolder and cheekier than in the app.

The owner makes new Puhu art from prompts. We code every piece, so a copy change is one edit
and one re-render.

## Goals

- 15 pieces: 6 Instagram feed posts (one is a carousel), 3 Reels (cross-posted to TikTok),
  4 Instagram Stories, 1 X card and 1 LinkedIn card.
- Every piece renders from code with one command and lands in an output folder. Each piece
  gets its caption, hashtags and alt text.
- A 14-day posting order with no dates (launch day is not set yet; "Çok yakında" everywhere).

## Non-goals

- Ads, scheduling or auto-posting tools, analytics, link-in-bio pages.
- A per-exam series. After launch, the comments on F5 decide which exam gets one first.
- Countdown posts or a launch date (later, once the date is set).
- English versions, app UI changes, CI integration.

## Anti-goals (a failure even if it renders)

- FOMO copy: "Son şans", "Kaçırma", scarcity like "1 yer kaldı".
- Mocking failure, low scores or exam stress. A self-aware joke about procrastination is fine;
  laughing at someone's result is not.
- Explaining invite-only access, waitlist mechanics or KVKK retention in post copy
  (those live in the aydınlatma and consent texts).
- Drawn links or fake buttons. Links are native only: the bio link, the Story link sticker, and
  the poll sticker.
- "AI" in Turkish copy. Write "yapay zekâ". Puhu is the yapay zekâ coach; a plain "koç" means a
  human coach.
- A Puhu that reads as a green owl, or slow and calm Puhu motion. Motion is snappy and
  exaggerated, never floaty.
- Text or the link sticker hidden under the platform UI (see safe zones).

## Copy rules (binding)

- Puhu energetic voice from `docs/copy/voice.md`, pushed toward memes for social.
- At most one "!" per sentence. No em dash.
- Brand: "PuhuKoç" (wordmark), handle `@puhukoc`, site `puhukoc.com`.
- Exams always listed as `KPSS · YKS · LGS · ALES · DGS` (all five, equal weight).
- Never name other brands or platforms in visuals (no app logos on the phone screens).

## Brand and format constraints

| Token | Value |
|---|---|
| Social blue (A ground) | `#2F55D4` (tweaks `#1F6FB8`, `#1A5FA3`) |
| Lamp yellow | `#FFE082` |
| Navy ink / night | `#0F2233` / `#0B1636`, `#07122A` |
| Blue tints | `#DCE6FF`, `#E3EAFF`, text on tint `#1F3C99` |
| App screen | `#F4F7FF` |
| Cream paper (C) | `#FAF6F0`, dot grid `#E6DEC8` 2.5 px every 36 px, card `#FFFDF8` |
| Type | Nunito 1000/900 (headlines, UI), Caveat 700 (handwritten notes) |
| Logo | the "Bakış" wordmark (PuhuK + eye-o + ç), as in the canvas and `@mentor/ui` Logo |

`#2F55D4` won over the app's `#55ACEE` because white text on `#55ACEE` fails contrast.

| Format | Size | Safe zone |
|---|---|---|
| Feed post / carousel card | 1080×1350 | keep 56–64 px margins |
| Story | 1080×1920 | top and bottom 250 px stay free of text and stickers |
| Reels / TikTok | 1080×1920, 30 fps, H.264 MP4 | text inside x 60–900, y 250–1500 (TikTok right rail and caption area) |
| X / LinkedIn | 1200×675 | 48 px margins |

Story link zones: each Story has a dashed "Bağlantı çıkartması buraya" box, toggled by a
`linkGuide` prop. Exports render with it **off**; the owner places the real sticker there.
S4 gets the same thing for the poll sticker (`pollGuide`).

## Directions

- **A · Pelerin mavisi pop (main).** Flat `#2F55D4`, giant white type with yellow accents,
  sparkles, mascot breaking the frame, the 3D phone.
- **B · Gece şehri (support).** The app's night world: W2 lantern scene and night city, navy
  sheets, taped paper notes in Caveat. Used for waitlist pieces.
- **C · Krem defter (support).** Dot-grid cream paper, big round type, Puhu stickers used as
  a "censored word", handwritten notes and arrows. Used for memes and posters.

## The pieces

"Designed" means the canvas artboard is approved and is the spec. Rebuild it to match, using
the canvas default prop values. "New" pieces follow the copy below and the direction's look,
and the builder lays them out. Copy for new pieces is my proposal; the owner reviews it in the
exported PNGs.

### Feed (1080×1350)

| ID | Direction | Status | Content |
|---|---|---|---|
| F1 | A | designed (`Main.dc.html`) | "YALNIZ ÇALIŞMAK / YASAK!", "ÇOK YAKINDA" pill, exam row. P1 referee Puhu (mirrored) whistles at the phone. Phone screen: "Masada 4 kişi", 18:42 "odak" ring. The 4-Puhu masa scene pops out over the phone frame. Footer `puhukoc.com @puhukoc`. |
| F2 | C | designed (`C-Post.dc.html`) | "sınava çalışmak [3 stickers] zor. / o yüzden birlikte çalışıyoruz." Arrow + note "evet, sen de dahilsin." P3 wink peeks from the bottom edge. Logo + `puhukoc.com · @puhukoc`. |
| F3 | B | designed (`B-Post.dc.html`) | W2 lantern scene, taped note "Tüm sınavlara tek puhu yeter" + exam row, "Yerini şimdiden / ayıralım!", body "PuhuKoç'u senin için hazırlıyoruz. E-postanı bırak, açıldığında ilk sana haber verelim.", `@puhukoc`. |
| F4 | A | new, carousel of 5 | "Puhu'yla bir gün". Each card: big time-of-day word, one line, the phone mock with a simple app screen. 1 "Sabah · Puhu günün planını hazırlar. Sen sadece başla." 2 "Öğlen · Masada 4 kişi. Kimse yalnız çalışmıyor." 3 "Akşam · Haftalık özetin hazır. Bu haftaki lakabın: Gizli Kahraman." 4 "İstersen · Gerçek bir koç da masana katılır." 5 Closing card: "Yerini kap!", `puhukoc.com`, "Çok yakında". |
| F5 | C | new | "Hangi sınava hazırlanıyorsun?" Five equal round badges (KPSS, YKS, LGS, ALES, DGS) like stamps on the paper, one Puhu (existing mascot art) pointing at them, handwritten "yorumlara yaz, Puhu sayıyor." Logo + handle. |
| F6 | C | new | Two-panel meme. Left "Tek başına çalışırken ben:" + night-shift sticker. Right "Masada Puhu'larla ben:" + crying-laughing sticker. Logo + handle. |

F4's card 1 also carries the carousel title "Puhu'yla bir gün" above "Sabah". Base each card's
phone screen on the real app screen it names (panel "Bugün", the seans masa, the weekly
summary, Koçum), cut down to two or three big elements the way F1's screen is. Do not
reproduce dense UI.

Card 3 of F4 uses the weekly-recap nickname feature. Check that it ships at launch. If it
does not, use "Akşam · Haftanın özeti hazır. Ne kadar çalıştığını Puhu not etti." Check every
feature claim against `sinav-kocluk-roadmap.md` before export.

### Stories (1080×1920)

| ID | Direction | Status | Content |
|---|---|---|---|
| S1 | A | designed (`A-Story.dc.html`) | "POV:" pill, "“Son bir video” / dedin.", bubble "Kanka, bu 7. son.", P2 Puhu peers over the glasses from behind a big 3D phone. Phone screen: status bar 01:47, "Telefon zaten elinde. / Yerini kap!" on a yellow marker stroke, link zone, "Masada 4 kişi" card with the masa scene (decor, may sit under the reply bar). |
| S2 | B | designed (`B-Story.dc.html`) | Night city, "Gece çalışan / tek kişi / sen değilsin.", taped note "Masaya otur, birlikte çalışalım!", link zone. |
| S3 | C | designed (`C-Story.dc.html`) | "bugünün listesi" checklist (2 seans çalış, 40 paragraf çöz, Puhu'ya haftanı kurdur crossed out; "Yerini ayır" open on a marker stroke), note "sonuncusu 10 saniye sürüyor.", reading Puhu, link zone. Swap the reading Puhu for P5 if it arrives. |
| S4 | A | new | Poll Story. "Sen hangi çalışma tipisin?" Diagonal split: navy night half with `puhu-night` ("Gece kuşu"), blue day half with `puhu-happy` ("Sabahçı"). Poll sticker zone between them (`pollGuide`). |

### Reels / TikTok (1080×1920, 30 fps)

Export silent masters. The owner adds a trending sound in the app, because sounds picked
in-app help reach. Cut on a 0.5 s grid (120 BPM) so any upbeat track fits. Motion uses fast
springs with overshoot (squash, pop, stamp), never slow fades.

The **end card** (all Reels) is the logo, `puhukoc.com`, `@puhukoc` and "Çok yakında" on the
piece's ground, held at least 2 s. Each Reel also exports a **cover PNG** (1080×1920) whose key
text sits in the centre 1080×1350, because the profile grid crops to 4:5.

| ID | Length | Beats |
|---|---|---|
| R1 | ~10 s | S1 in motion. 0–1.2 s: "POV:" pops, "“Son bir video”" slams in, "dedin." stamps. 1.2–2 s: phone shoots up from the bottom. 2–3 s: P2 pops up behind it. 3–4.5 s: bubble "Kanka, bu 7. son." pops with a shake. 4.5–6 s: the screen flips from a generic video screen (play icon, progress bar, no platform UI) to the PuhuKoç screen, "Yerini kap!" marker wipes in. 6–8 s: end card (P6 phone hug if delivered, else P2 + logo), `puhukoc.com`, "Çok yakında". Hold to 10 s. |
| R2 | ~12 s | "Masa doluyor". A "Masada 0 kişi" chip ticks up as four single Puhus (`puhu-happy`, `puhu-proud`, `puhu-encouraging`, `puhu-night`) pop in one by one. At 4 the full masa scene snaps in, then "YALNIZ ÇALIŞMAK YASAK!" stamps across. End card. |
| R3 | ~9 s | "Rozet ritmi". The five exam badges stamp in on the beat, with the P4 stickers reacting. "Hangisi senin?" then "Yorumlara yaz." End card. |

### X and LinkedIn (1200×675)

| ID | Direction | Content |
|---|---|---|
| X1 | A | F1 in landscape: headline left, phone + P1 right, exam row, `puhukoc.com @puhukoc`. |
| L1 | B, calmer (Companion register) | "Sınava birlikte hazırlanmak daha kolay." Body: "PuhuKoç; KPSS, YKS, LGS, ALES ve DGS'ye hazırlananlar için günlük plan, birlikte çalışma masası ve haftalık özet sunar. Çok yakında." W2 or night city art, `puhukoc.com`. |

## Posting order (no dates)

| Day | Week 1: curiosity and announcement | Day | Week 2: show it, call to the list |
|---|---|---|---|
| 1 | F1 + S1 | 8 | F4 carousel |
| 2 | R1 | 9 | R2 |
| 3 | F2 | 10 | F5 |
| 4 | S4 poll | 11 | S3 |
| 5 | X1 | 12 | F6 |
| 6 | S2 | 13 | R3 |
| 7 | rest, reshare comments | 14 | F3 + L1 |

## Captions

Each piece ships with a `caption.txt`: the post text (same copy rules, 1–3 short lines), a
hashtag line (`#kpss #yks #lgs #ales #dgs #sınavahazırlık #dersçalış #puhukoç`), and the alt
text for Instagram's accessibility field. Carousel alt text is per card.

## Art

Keyed finals live in `art-source.local/social/keyed/` (gitignored), and raw files are in
`art-source.local/social/raw/`. The canvas references images as `/_blob/<id>`:

| Canvas blob | Use | File |
|---|---|---|
| `b6b7b278…` | P1 referee Puhu with whistle (F1, X1) | `keyed/p1-referee-whistle.png` 1148×1152 |
| `6333702d…` | P2 over-the-glasses Puhu, cut at right and bottom (S1, R1) | `keyed/p2-over-glasses.png` 1254×1254 |
| `49c7ede5…` | P3 wink, peeks from a bottom edge (F2) | `keyed/p3-wink-peek.png` 1536×1024 |
| `7d630e2c…` | 3D navy phone, transparent screen hole | `keyed/phone-3d-screen-hole.png` 700×1373 |
| `ac0a3c65…` `7bff52fa…` `4ff75a71…` | P4 stickers: mind blown, night shift (coffee), facepalm | `keyed/sticker-*.png` |
| none | P4 crying-laughing sticker (F6, R3) | `keyed/sticker-crying-laughing.png` |
| `b5cddedc…` | 4 Puhus at the round table | `apps/web/public/visuals/landing/room-masa.webp` |
| `aeb44638…` | W2 lantern window | `apps/web/public/visuals/waitlist/w2.webp` |
| `6b8ac4cc…` | Night city | `apps/web/public/visuals/onboarding/welcome-scene-4-end.webp` |
| `a21321a4…` | Reading Puhu (S3) | `apps/web/public/mascot/puhu/desk/read-left.png` |
| `e263ba9b…` | Happy Puhu | `apps/web/public/mascot/puhu/puhu-happy.png` |

Other single Puhus: `apps/web/public/mascot/puhu/` (proud, encouraging, night, surprised…).

Optional art still to come from the owner: **P5** speed-study Puhu on books (would replace the
reading Puhu in S3) and **P6** Puhu hugging the same phone (R1 end card). Build with the
fallbacks; swap the files in when they arrive.

Keying new art (magenta ground): convert webp to png first, then from the repo root
`node apps/web/scripts/key-alpha.mjs in.png out.png --key=ff00ff --hard=70 --soft=150 --trim`.
For a green screen, run a second pass with `--key=00ff00 --hard=90 --soft=170 --despill=0`.
Despill must stay off there, or the blues turn purple.

### Phone mockup

The phone PNG has a transparent screen. Draw the screen UI in a 378×822 box (radius 48,
overflow hidden), place it **under** the phone image, and map it onto the screen with
`transform-origin: 0 0` and this matrix. It is fitted for the phone drawn **470 px wide**
(922 tall):

`matrix3d(0.926732, -0.132632, 0, -0.000239064, -0.00727675, 0.991384, 0, 2.01634e-05, 0, 0, 1, 0, 31.403, 65.0484, 0, 1)`

For width `470·k`, multiply entries 1, 2, 5, 6, 13 and 14 by `k`, and keep 4 and 8 as they
are. S1 uses `k = 1000/470`. To make the art "pop out" of the screen, add a second
**unclipped** layer with the same matrix above the phone image. Put drop shadows on the
wrapper, not on the image. `art-source.local/social/tools/screen_fit.py` re-fits the matrix
for a new phone render.

## How it gets made (decided)

- Code lives in `marketing/social/` at the repo root, with its own `package.json`. It stays
  outside the pnpm workspace (`pnpm-workspace.yaml` only globs `apps/*` and `packages/*`) and
  out of turbo and CI. Install it on its own, either with `npm` or
  `pnpm install --ignore-workspace`.
- The owner chose HTML→PNG for stills and Remotion for video.
- Remotion license (FAQ, read 2026-11-07): free for individuals and for teams of up to 3
  people, commercial use included. Larger teams need a Company License: $25/month per person
  who writes Remotion code, plus a $100/month minimum when render APIs run in automation.
- Committed keyed art goes in `marketing/social/` (WebP or PNG), so a fresh clone can
  re-render. `out/` stays gitignored.
- **Team size (owner, 2026-11-07): 3 people or fewer.** That puts PuhuKoç under Remotion's Free
  License, so Remotion is the video toolchain with no license cost. If the team grows past 3,
  revisit this before the next render.

## Left to the builder

- Project layout, component split, and whether stills render through Remotion (`remotion
  still`) or a separate Playwright screenshot step. One toolchain is my preference.
- Font loading (local or Google Fonts), file naming, the exact layout of the new pieces within
  their direction, the generic "video" screen in R1, and easing curves within the motion rule.
- One runnable copy check over every piece's strings and captions: no "AI", "Son şans",
  "Kaçırma", "Duolingo", no em dash, at most one "!" per sentence.
- A preview toggle that overlays the safe zones.

## Done when

The owner posts every piece by hand, so the deliverable is files, not a publishing flow.
All 15 pieces, their captions and the Reel covers render from one command into `out/`. The copy check
passes. The designed pieces match their canvas artboards. The owner has reviewed the PNG and
MP4 exports.
