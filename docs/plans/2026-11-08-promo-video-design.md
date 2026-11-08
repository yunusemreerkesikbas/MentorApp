# Promo video design · "Ekrana dalış" (T1)

Date: 2026-11-08. Status: **the owner picked every decision below in chat and approved the
storyboard flow. On review the owner added three features (vision board, mistake notebook,
weekly chest), so the film grew from 36 s to 48 s. This spec is waiting for the owner's review.
Nothing is built yet.**
Storyboard: the social canvas https://claude.ai/artifact/SbpcGU9oeauc78ZZM71yUK, row "Tanıtım
videosu · Ekrana dalış" (board `Promo-Storyboard.dc.html`, 15 frames, new ones tagged YENİ; local
copy in `art-source.local/social/canvas/`, gitignored).
Prompts: [`marketing/social/PROMPTS.md` §6](../../marketing/social/PROMPTS.md).
Parent spec (rules this piece inherits): [2026-11-07-social-launch-kit-design.md](2026-11-07-social-launch-kit-design.md).

## Intent

One short film that says what PuhuKoç is and shows its features, for young exam candidates on
Reels, TikTok and Shorts. It runs during the waitlist phase, so it ends on "Çok yakında" and
`puhukoc.com`.

The references were three Duolingo films. *Three Words* uses one continuous camera that dives
into the phone. *Adventures* alternates a character scene with the real screen. *Friendly push*
has a comedy hook, giant kinetic type and stacked notifications. We take their editing rhythm and
transition ideas, not their drawing style. Puhu is a 3D render, so the film keeps the kit's
formula: flat colour ground, 3D Puhu, huge Nunito type.

The concept is one camera. It dives into the phone and passes through the lit windows of the
landing's apartment: the plan room, Puhu's room, the masa. At the end of the week a chest opens,
its gold light shrinks into the facade's one dark window, and the viewer's window lights up. This
ties the film to the landing's "Işıklı şehir" world.

## Owner decisions (2026-11-08)

| Topic | Decision |
|---|---|
| Format | Vertical 9:16, 1080×1920, 30 fps. First about 35 s; after adding three features the owner chose to lengthen it (about 46 s), built as 48 s = 24 bars so it sits on the music. A 16:9 cut can come later from the same scenes. |
| Extra features | Added on review: **vision board** opens PLANLA (dream → plan), **Yanlış Defterim** closes ODAKLAN (study → keep your mistakes), **weekly chest** opens the final (the week's reward); the chest's light becomes the viewer's window. The three-word spine stays. |
| Sound | Music + sound effects, all words on screen, no voice-over. |
| Music | The owner picks a royalty-free track; we cut to its beat. |
| Production | Hybrid: existing art + 5 new Kling clips from our prompts (owner generates). Edit, type, UI and transitions in the Remotion kit. |
| Message | Three-word spine: **Planla · Odaklan · Birlikte**. |
| Concept | A · Ekrana dalış (picked over "Puhu dürtüyor" and "Puhu'yla bir gün"). |
| Hook | Same as R1/S1: "POV: “Son bir video” dedin." → "Kanka, bu 7. son." Don't post it in the same week as R1. |
| Premium | **No PREMIUM label** anywhere in the film, even on Puhu's yapay zekâ beats. |

## Goals

- Stops the scroll in the first 2 s and says what the app is by about 6 s.
- Shows three feature families, one per word, each with real product UI, plus the vision board,
  the mistake notebook and the weekly chest.
- Ends on the kit's end card ("ÇOK YAKINDA", `puhukoc.com`), held at least 2 s.
- Renders from the kit with one command (`npm run render -- --only T1`), with a cover PNG and
  `caption.txt`, like the other reels.

## Non-goals

- The 16:9 version, a voice-over, subtitles for a voice-over.
- Prices, trial offers, Premium selling.
- Every feature. Left out on purpose: weekly story, leagues, Coin and its prices, the human coach.

## Anti-goals (a failure even if it renders)

Everything in the parent spec's anti-goals, plus:
- Anything that reads as Duolingo: a green owl, Duo poses, the *Friendly push* fire title, the
  "three words" end-card layout copied as is.
- Calm, floaty Puhu. Puhu motion is snappy and exaggerated (anticipation, overshoot, short holds).
- Text over a busy area of a Kling clip. Words sit on the flat blue ground, never on a room.
- A reward amount on the chest (XP or Coin number). The economy is flag-gated, so the chest only
  opens and glows.

## Structure (48 s = 96 beats of 0.5 s at 120 BPM, 24 bars)

Sections: Kanca 0:00–3,5 · Giriş 3,5–6 · PLANLA 6–18 · ODAKLAN 18–30 · BİRLİKTE 30–38 · Final
38–48. From the drop every scene is 4 s (2 bars), except the last two.

| # | Time | Section | What happens | On screen | Source |
|---|---|---|---|---|---|
| 01 | 0:00–1,5 | Kanca | Night #0D0E25, the kit's 3D phone with a generic video playing at 01:47. "POV:" pops, "“Son bir video”" slams in, "dedin." stamps. | POV: “Son bir video” dedin. | code + phone art |
| 02 | 1,5–2,5 | Kanca | A Puhu notification drops onto the screen with a ping, the phone shakes, P2 peeks over his glasses from the edge. | Kanka, bu 7. son. | code + `p2-over-glasses` |
| 03 | 2,5–3,5 | Kanca | Puhu bursts out of the screen, beckons, dives back in. The camera follows him into the screen: white flash, speed lines, whoosh. | Gel, sana bir şey göstereyim! | **K1** |
| 04 | 3,5–6 | Giriş | Inside: the blue sunburst world. The five exam pills pop in on the beat, Puhu lands with a squash and waves. | Sınavın hangisi olursa olsun, / Puhu yanında! | code + `motion/wave` |
| 05 | 6–10 | PLANLA · **new** | The music's drop: "PLANLA" slams in. A vision board drops onto the wall on a string and nail (wood frame, kraft ground). The four Puhu photos (kampüs, kod, Konya, mezuniyet) pin on one per beat, stickers pop. | Hedefini / duvara as! | code + landing board art |
| 06 | 10–14 | PLANLA | Match cut: the vision board becomes the cork board in the plan-room window (navy frame, "No 4 · Plan" enamel plate). Caped Puhu slaps task cards onto it. | Haftanı / Puhu kursun! | **K2** in window |
| 07 | 14–18 | PLANLA | Cards fly from the window into the phone's week and tick off on the beat (Türkçe 25 dk, Matematik 40 dk, Tekrar 15 dk). Caveat note "abrakadabra, hafta hazır". A deneme card: bars grow, "Sıradaki: Geometri" pops. The last task's empty circle grows into the timer ring. | Denemeni gir, sıradaki konunu gör. | code |
| 08 | 18–22 | ODAKLAN | "ODAKLAN" slams in. Inside the ring the top-down room changes on the beat (ev → kafe → kütüphane); the dial clicks to 25:00. | Odanı seç, süreni kur, başla! | code + seans room art |
| 09 | 22–26 | ODAKLAN | Dive into Puhu's room: turbo reading, the timer races to 00:00, Puhu slams the book and cheers. "+5 XP", the streak flame "4 gün seri" and "Mola hazır" pop. A question slip shoots out of the book. | Bitir, serini büyüt! | **K3** in window + code |
| 10 | 26–30 | ODAKLAN · **new** | The slip flies onto the navy "Yanlış Defterim" (cream label, red ribbon) and sticks with a "Matematik" tape. Review day: the question comes back as a card ("1 / 3"), "Bugün 2 tekrar" pops, a green "ÇÖZDÜM" stamp lands on the beat. | Yanlış soruların / artık kaybolmaz! | code |
| 11 | 30–34 | BİRLİKTE | Match cut: the notebook slides onto the top-down study table (seans `room-*-table`), then cuts to the masa window. "BİRLİKTE" slams in. "Masada 1 kişi" counts up to 4 on the beat; the four Puhus high-five. | Arkadaşlarınla aynı masada çalış. | **K4** in window + code |
| 12 | 34–38 | BİRLİKTE | Messages stack on the beat: a community question, an answer with an alkış count, then Puhu's yellow bubble on top. | Takıldın mı? / Topluluğa sor, Puhu’ya yaz. | code |
| 13 | 38–42 | Final · **new** | The messages slide away and night falls (`#0D0E25`). The week's day chips light one per beat, Pzt → Cum (Cmt, Paz stay dark). In a tall window under the lamp the chest opens and Puhu throws his wings up; gold light fills the screen. No reward amount. | 5 gün masadaydın! / Sandığın hazır! | app clip `chest-open-tall.mp4` + code |
| 14 | 42–44,5 | Final | The gold light shrinks into the one dark window (top middle) of the lit apartment (`city-facade`); the camera pulls back, the window is yours. Its room lights up and Puhu jumps in, pats the chair, points at you. | Işığın yanıyorsa, / yalnız değilsin. | code + **K5** |
| 15 | 44,5–48 | Final | "PLANLA. ODAKLAN. BİRLİKTE." stamp one per beat, Puhu hops in, then the kit's EndCard: logo, `puhukoc.com`, "ÇOK YAKINDA", the five exams. Held ≥ 2 s. | PLANLA. ODAKLAN. BİRLİKTE. | code (EndCard) |

Copy on frames 05, 10 and 13 is the app's own: `landing.morning.board.title`,
`landing.morning.notebook.title` and `.question`, `weeklyChest.scene_title` (days = 5) and
`weeklyChest.ready_title`.

Copy on frame 12: Zeynep "Paragrafta hep son soruda takılıyorum.", Can "Önce soru kökünü oku,
sonra metne dön." (12 alkış), Puhu "Seanslarına baktım: bugün 10 paragraf yeter." These are
example people and lines, drawn as in-app cards, with no real user data.

## Look and motion

- Ground: the kit's direction A, `#2F55D4` with the sunburst from R2, white Nunito 1000 type with
  the `#FFE082` second line, hard navy `#1E2A5A` drop shadows. Night parts use `#0D0E25` with the
  kit's 4-point sparkles. Handwritten notes use Caveat.
- Words slam in: scale about 1.4 → 1 with overshoot, a 2-frame shake, a stamp sound. Pills and
  chips pop with a spring. Ease out when things enter and ease in when they leave. One or two
  things move per beat, never everything at once.
- Windows: a navy 22 px frame with radius 40 and a cream sill. A Kling clip plays inside,
  cropped by `object-fit: cover`. The frame hides the clip edges and the KlingAI mark.
- Phone screens are coded (light `#F4F7FF` app screen as in F4/S1), never a screenshot, with no
  platform UI or logos.
- Transitions, in order:
  1. a zoom into the phone screen with a white flash;
  2. the vision board becomes the plan room's cork board (match cut);
  3. the empty task circle becomes the timer ring (match cut);
  4. a question slip flies out of Puhu's book onto the notebook;
  5. the notebook slides onto the top-down study table (match cut);
  6. blue to night as the messages slide away;
  7. the chest's gold light shrinks into the facade's dark window, which lights up.
- Safe zone: the kit's reel rule. Text stays in x 60–900 and y 250–1500. The right rail starts at
  y 900, so centred blocks above it may span x 60–1020.

## Assets

| Need | Source | Status |
|---|---|---|
| Phone | kit `phone-3d-screen-hole.png` + coded screen (`phone-matrix.ts`) | ready |
| Puhu poses | `p2-over-glasses`, `motion/wave`, `puhu-happy` | ready |
| Rooms | landing `room-plan`, `room-puhu`, `room-masa`, `room-senin`, `city-facade`; seans `room-{home,cafe,library}-bg` + `-table` | ready (copy into `public/art/`) |
| Vision board | the four Puhu photos `art-source.local/landing-board/v1-kampus … v4-mezuniyet.webp`, stickers from `apps/web/public/img/stickers/`, built in layers on a coded kraft board; landing `desk-board.webp` is the look to match | ready |
| Mistake notebook | coded (navy cover, cream label, red ribbon, Caveat), same look as the app's Defterlerim desk and notebook page | code |
| Weekly chest | app clip `apps/web/public/visuals/chest/chest-open-tall.mp4` (720×1280, 5 s, mark already cropped) + `desk-chest-closed-tall.webp` as the first frame | ready |
| K1 Puhu out of the phone | ChatGPT start frame + Kling, 9:16 | owner |
| K2 plan room | Kling from `art-source.local/social/promo/kling-start/K2-plan-start.png`, 16:9 | owner |
| K3 Puhu's room | Kling from `K3-puhu-start.png`, 1:1 | owner |
| K4 masa | Kling from `K4-masa-start.png`, 16:9 | owner |
| K5 your room | Kling from `K5-senin-start.png`, 16:9 | owner |
| Music | royalty-free, ~120 BPM, drop near 0:06, ≥ 48 s → `art-source.local/social/gen/promo-music.mp3` | owner |
| Sound effects | ping, whoosh, pop, stamp, click | builder picks royalty-free ones; the owner approves them |

Before a Kling clip goes in, check it: the bottom-right corner (the KlingAI mark; the window crop
usually hides it, else crop it as was done for `apps/web/public/video/`), Puhu stays on model
(glasses, no green), and the energy is snappy.

## Build notes (for the plan)

- New kit piece `T1` (reel format, `video: { fps: 30, durationInFrames: 1440, endCardFrom: 1380, … }`), the copy in
  `src/copy.ts`, the caption in `src/captions.ts`, so the copy check runs on it.
- Placeholders first: until the clips arrive, each window shows its still with a slow push-in,
  so timing and type can be reviewed. Swapping in a clip is a one-line change in `src/art.ts`.
- Music drives the beat grid. If the track is not 120 BPM, the beat length changes, the frame
  times above scale with it, and the drop is lined up with frame 05.
- Chest clip: it has a jump between about 1,6 and 1,8 s (seen in a cut check). Time the lid
  opening so the jump falls under the gold flash, or start the clip after it.
- Cover frame: frame 05 ("PLANLA" over the vision board) or frame 15, the owner's pick at review.

## Left to the builder

Exact easing curves, sound effect choice, type sizes within the kit's scale, pill and card
details, how the notification ping looks, the push-in on placeholders, the caption and hashtags
(following the parent spec's caption rules).

## Open, outside this spec

- The parent spec's check still holds: masa and topluluk must be live at launch before this posts.
- Posting slot: not the same week as R1 (same hook).
