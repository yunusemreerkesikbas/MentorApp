# Promo video design · "Ekrana dalış" (T1)

Date: 2026-11-08. Status: **the owner picked every decision below in chat and approved the
storyboard flow. On review the owner added three features (vision board, mistake notebook,
weekly chest), then the weekly recap's nickname card, so the film grew from 36 s to 52 s. Then the owner moved the clip scenes from small windows to
full screen, and a second review round reworked six frames (real screens, a
room carousel, a notebook that flips open, a new closing line, no "Çok yakında"). A third round
added the career sticker album as frame 05 (56 s). When the clips arrived the owner gave K1 room to play
(quality over length), so the film is now 58 s; after the first cut the owner slowed frames 15 and 16 (62 s). This spec is waiting for the owner's review.
Nothing is built yet.**
Storyboard: the social canvas https://claude.ai/artifact/SbpcGU9oeauc78ZZM71yUK, row "Tanıtım
videosu · Ekrana dalış" (board `Promo-Storyboard.dc.html`, 16 frames, new ones tagged YENİ; local
copy in `art-source.local/social/canvas/`, gitignored).
Prompts: [`marketing/social/PROMPTS.md` §6](../../marketing/social/PROMPTS.md).
Parent spec (rules this piece inherits): [2026-11-07-social-launch-kit-design.md](2026-11-07-social-launch-kit-design.md).

## Intent

One short film that says what PuhuKoç is and shows its features, for young exam candidates on
Reels, TikTok and Shorts. It runs during the waitlist phase and ends on the logo and
`puhukoc.com`, without "Çok yakında" (owner pick).

The references were three Duolingo films. *Three Words* uses one continuous camera that dives
into the phone. *Adventures* alternates a character scene with the real screen. *Friendly push*
has a comedy hook, giant kinetic type and stacked notifications. We take their editing rhythm and
transition ideas, not their drawing style. Puhu is a 3D render, so the film keeps the kit's
formula: flat colour ground, 3D Puhu, huge Nunito type.

The concept is one camera. It dives into the phone and on into the rooms of the landing's
apartment, each one filling the screen: Puhu's magic over the night city, Puhu's room, the masa. At the end of the
week a chest opens and the week's nickname card flies out; its gold light flies into the facade's
one dark window, the window lights up and the camera dives in: the viewer's own room. This
ties the film to the landing's "Işıklı şehir" world.

## Owner decisions (2026-11-08)

| Topic | Decision |
|---|---|
| Format | Vertical 9:16, 1080×1920, 30 fps. First about 35 s; after adding three features the owner chose to lengthen it (about 46 s), built as 48 s = 24 bars so it sits on the music. The weekly nickname card then added 4 s (52 s = 26 bars), the career sticker album 4 s more (56 s), and K1 2 s more so the clip plays almost whole (owner, 2026-11-10: "en kaliteli şekilde, süre sınırı önemli değil"): 58 s; after watching the first cut the owner found 15 and 16 too fast and gave each 2 s more: **62 s = 31 bars**. A 16:9 cut can come later from the same scenes. |
| Extra features | Added on review: **vision board** opens PLANLA (dream → plan), **Yanlış Defterim** closes ODAKLAN (study → keep your mistakes), **weekly chest** opens the final (the week's reward), and the **weekly recap's nickname card** flies out of it, landing on **Odak Makinesi**; the card's light becomes the viewer's window. Later the **career Puhus** came in as a sticker album right before PLANLA (who you want to be → your goal). The three-word spine stays. |
| Vision board | Filled in code, not a new image: the four Puhu photos as polaroids, a goal card, a sticky note, a heart and a star, all pinned on the beat. The landing's `desk-board.webp` left too much empty board. |
| Clip scenes | **Full screen** (owner pick on storyboard review, over a small framed window and a big square window). Every clip scene fills the 9:16 screen. K3–K5 get new tall start frames from ChatGPT that leave the top third as plain wall for the words; the chest clip is already tall. |
| Sound | Music + sound effects, all words on screen, no voice-over. |
| Music | The builder picks and cuts the track (owner handed it over, 2026-11-09): Pixabay Content License, the artist states no Content ID claims, then cut to the film's structure. Chosen: NickPanek "Dirty Igloo" (pixabay 318363, 105 BPM), rearranged bar by bar into 29 bars and stretched to 120 BPM without a pitch change → `art-source.local/social/gen/promo-music.mp3` (58,0 s). Source bars per film section: intro 42 43 47 48, drop + PLANLA 49–55, fill 56, ODAKLAN 57–62, BİRLİKTE 37–40, break 41 42, build 44 45 46 45 46 (45 and 46 are near twins, so the extra two bars loop the groove), final 63 64. Original in `gen/music-candidates/`; the cut script lives outside the repo. |
| Production | Hybrid: existing art + 4 new Kling clips from our prompts (K1, K3, K4, K5; K2 was dropped for the app's own magic loop) (owner generates). Edit, type, UI and transitions in the Remotion kit. |
| Message | Three-word spine for the sections: **Planla · Odaklan · Birlikte**. The closing stamp is the owner's line **"PLANLA. ODAKLAN. PUHU İLE."** |
| Phone | The kit's 3D phone (`phone-3d-screen-hole.png`, already cut from `art-source.local/social/raw/phone-raw.png`) in every phone shot. |
| Frame 05 | **Career sticker album** (owner pick over a wheel of fortune, a quick costume change and an elevator; the wheel and the costume change would repeat frame 15's spin-and-stop). The app's ten career Puhus slap onto an album page; the Kodcu Puhu sticker tears off and lands on frame 06's goal card. |
| Frame 07 | **The app's "Şehrin üstünde" magic** (owner pick over a blue "magic window"): the "Koçla planla" waiting scene's hero loop over the landing's night city replaces the K2 plan-room clip. |
| Frame 08 | **Real app screens** (owner pick over a coded mock and a designed screen): the weekly plan and the deneme result, captured from the app with demo data; ticks and the chip are coded over them. |
| Frame 09 | **Full-screen room carousel, ring in front** (owner pick over rooms changing inside the ring only). |
| Frame 11 | **The notebook flips open**: it lifts off the app's Defterlerim desk, fills the screen and its pages turn one per beat, each with a wrong question and a red-pen note. |
| Frame 14 | No day chips. "Haftayı devirdin!" (owner pick) sits with "5 gün masadaydın!" and "Sandığın hazır!". |
| Concept | A · Ekrana dalış (picked over "Puhu dürtüyor" and "Puhu'yla bir gün"). |
| Hook | "“Son bir video” dedin." → "Kanka, bu 7. son." (R1/S1's hook without "POV:", which the owner took off on the storyboard) Don't post it in the same week as R1. |
| Premium | **No PREMIUM label** anywhere in the film, even on Puhu's yapay zekâ beats. |

## Goals

- Stops the scroll in the first 2 s and says what the app is by about 8 s.
- Shows three feature families, one per word, each with real product UI, plus the career album, the vision board,
  the mistake notebook, the weekly chest and the weekly nickname card.
- Ends on the kit's end card (logo, `puhukoc.com`, the five exams; no "ÇOK YAKINDA" pill), held
  at least 2 s.
- Renders from the kit with one command (`npm run render -- --only T1`), with a cover PNG and
  `caption.txt`, like the other reels.

## Non-goals

- The 16:9 version, a voice-over, subtitles for a voice-over.
- Prices, trial offers, Premium selling.
- Every feature. Left out on purpose: the rest of the weekly story (only its nickname card is in), leagues,
  Coin and its prices, the human coach.

## Anti-goals (a failure even if it renders)

Everything in the parent spec's anti-goals, plus:
- Anything that reads as Duolingo: a green owl, Duo poses, the *Friendly push* fire title, the
  "three words" end-card layout copied as is.
- Calm, floaty Puhu. Puhu motion is snappy and exaggerated (anticipation, overshoot, short holds).
- A clip shown small in a frame on the blue ground. Clip scenes fill the screen.
- Text over a busy part of a clip. On a clip scene the words sit on the plain wall in the top
  third (the chest scene: on a thin night strip above the clip). Chips are opaque stickers and never cover
  Puhu's face.
- App UI drawn by an image model. App screens are coded or captured from the real app.
- A reward amount on the chest (XP or Coin number). The economy is flag-gated, so the chest only
  opens and glows.
- Any hint of how the weekly story is unlocked (gift, Coin or Premium). The card just appears.

## Structure (62 s = 124 beats of 0.5 s at 120 BPM, 31 bars)

Sections: Kanca 0:00–6 · Giriş 6–12 · PLANLA 12–24 · ODAKLAN 24–36 · BİRLİKTE 36–44 · Final
44–62. From the drop every scene is 4 s (2 bars), except the last three (15 is 6 s, 16 is 4,5 s, 17 is 3,5 s).

| # | Time | Section | What happens | On screen | Source |
|---|---|---|---|---|---|
| 01 | 0:00–1,5 | Kanca | Night #0D0E25, the kit's 3D phone with a generic video playing at 01:47. "“Son bir video”" slams in, "dedin." stamps. | “Son bir video” dedin. | code + phone art |
| 02 | 1,5–2,5 | Kanca | A Puhu notification drops onto the screen with a ping, the phone shakes, P2 peeks over his glasses from the edge. | Kanka, bu 7. son. | code + `p2-over-glasses` |
| 03 | 2,5–6 | Kanca | K1 plays almost whole (clip 0,25–4,3 s at about 1,16×): the host Puhu (bow tie, from `puhu-host`) climbs out of the screen as if it were a window, beckons twice, then dives back in head-first like into a pool; the screen wobbles like jelly. The camera follows him in: white flash, speed lines, whoosh. | Gel, sana bir şey göstereyim! | **K1** |
| 04 | 6–8 | Giriş | Inside: the blue sunburst world. The five exam pills pop in on the beat, the host Puhu lands with a squash, throws his wings open and sways (coded; the still has no wing motion). | Sınavın hangisi olursa olsun, / Puhu yanında! | code + `puhu-host` |
| 05 | 8–12 | Giriş · **new** | The music's drop: an empty sticker album page slams onto the blue sunburst, its slots numbered, and "Doktor mu, mühendis mi?" pops on top. The app's career Puhus slap onto the page two per beat, each a white sticker with a navy name strip: Dr. Puhu, Müh. Puhu, Av. Puhu, Kodcu Puhu, Öğretmen Puhu, Patron Puhu, Sunucu Puhu, Ressam Puhu, Prof. Puhu, Mimar Puhu. On the tenth, "Sen hangisisin?" slams in. The Kodcu Puhu sticker peels up at a corner and tears off the page. | Doktor mu, mühendis mi? / Sen hangisisin? | code + `mascot/career-3d` |
| 06 | 12–16 | PLANLA · **new** | "PLANLA" slams in on the next big hit. An empty vision board drops onto the wall on a string and nail (wood frame, dotted kraft ground). One per beat: the four Puhu photos as polaroids with Caveat captions (kampüs, kod, Konya, mezuniyet), a goal card "HEDEFİM · Bilgisayar Mühendisi · Konya", a yellow note "kampüste görüşürüz!"; a heart and a star pop; the Kodcu Puhu sticker from the album slaps onto the goal card's corner. The board ends full. | Hedefini / duvara as! | code + landing board photos |
| 07 | 16–20 | PLANLA | A gold streak sweeps off the vision board and the screen turns to night: the app's "Koçla planla" scene "Şehrin üstünde" (sky as in `plan-coach-stage.css`, the landing's city layers along the bottom). In a soft round mask in the middle, masked and caped Puhu flies in and waves his star wand (the app's loop). Each wand tap on the beat pops a paper plan card out of the star (Türkçe 25 dk, Matematik 40 dk, Tekrar 15 dk); the cards fan out around him. | Haftanı / Puhu kursun! | app clip `puhu-hero-magic-loop.mp4` + code |
| 08 | 20–24 | PLANLA | Puhu's plan cards fly into the 3D phone. On it runs a real capture of the app's weekly plan (demo data); coded ticks land on its tasks one per beat. Caveat note "abrakadabra, hafta hazır". The screen slides to the real deneme result and a coded "Sıradaki: Geometri" chip pops. A coded empty circle on the screen grows into the timer ring. | Denemeni gir, sıradaki konunu gör. | real screen captures + code |
| 09 | 24–28 | ODAKLAN | "ODAKLAN" slams in. The session rooms slide past like a carousel, one per beat (ev → kafe → kütüphane): each room's floor fills the screen, while the timer ring stays fixed in the middle with that room's table inside. The Ev · Kafe · Kütüphane chips under the ring follow the room. The dial clicks to 25:00. | ODAKLAN / Odanı seç, süreni kur, başla! | code + seans room art (`-bg` full screen, `-table` in the ring) |
| 10 | 28–32 | ODAKLAN | The ring grows past the screen edges and opens on Puhu's room, full screen: turbo reading, the timer races to 00:00, Puhu slams the book and cheers. "+5 XP", the streak flame "4 gün seri" and "Mola hazır" pop. A question slip shoots out of the book. | Bitir, serini büyüt! | **K3** full screen + code |
| 11 | 32–36 | ODAKLAN · **new** | The slip drops onto the app's Defterlerim desk (warm wall, wood desk, desk Puhu reading). The "Matematik Defteri" lifts off the desk, flies at the camera and fills the screen; the cover opens and three pages turn one per beat ("1 / 3" → "3 / 3"). Each page has a taped wrong question and a red-pen Caveat note. On the last page "Bugün 2 tekrar" pops, a green "ÇÖZDÜM" stamp lands on the beat, and desk Puhu peeks over the top of the book. Coded, not Kling, so the questions stay readable. | Yanlış soruların / artık kaybolmaz! | code + desk Puhu frames |
| 12 | 36–40 | BİRLİKTE | Match cut: the notebook slides onto the top-down study table (seans `room-*-table`), then cuts to the masa, full screen. "BİRLİKTE" slams in on the wall. The four Puhus do a stadium wave left to right. Then the side-by-side pairs high-five (the lamp sits between the middle two). | Arkadaşlarınla aynı masada çalış. | **K4** full screen + code |
| 13 | 40–44 | BİRLİKTE | Messages stack on the beat: a community question, an answer with an alkış count, then Puhu's yellow bubble on top. | Takıldın mı? / Topluluğa sor, Puhu’ya yaz. | code |
| 14 | 44–48 | Final · **new** | The messages slide away and night falls (`#0D0E25`). On the night ground "5 gün masadaydın!" slams in and "Haftayı devirdin!" lands under it. The camera dives into a lit tall window: the chest clip fills the screen under a thin night strip that keeps the words (the clip's own plain desk sits in the caption zone, below y 1500). "Haftayı devirdin!" rides up small into the strip, "Sandığın hazır!" slams in under it, the lid opens on the beat, Puhu throws his wings up, and with the gold light a card shoots out. No reward amount. | 5 gün masadaydın! / Haftayı devirdin! / Sandığın hazır! | app clip `chest-open-tall.mp4` full screen + code |
| 15 | 48–54 | Final · **new** | The card floats on a gold sunburst and shows the weekly characters one at a time: each holds front-on for about a second, then one quick turn swaps it for the next (Seri Canavarı → Korkusuz Denemeci → Odak Makinesi); it stops on the last with a snap. A trading-card look: gold border, the character art on top, a navy band with "BU HAFTAKİ LAKABIN", the nickname and its message. The open chest sits under it. | Hafta bitti mi? / Hikâyen hazır! · on the card: Odak Makinesi · Tek oturuşta 50 dakika! Seni durdurmak imkânsız. | app character art + code |
| 16 | 54–58,5 | Final | The lit apartment shows first; the card's gold light floats up for a second into the one dark window (top middle) of the lit apartment (`city-facade`, full screen at night); the window lights up with a pulse, a beat later the camera dives in: your room fills the screen. Puhu springs up behind the desk, waves, nudges the chair toward you and points at you with both wings. | Işığın yanıyorsa, / yalnız değilsin. | code + **K5** full screen |
| 17 | 58,5–62 | Final | "PLANLA." "ODAKLAN." "PUHU İLE." stamp one per beat on the music's three hits, Puhu hops in on the last, then the kit's EndCard without the "ÇOK YAKINDA" pill: logo, `puhukoc.com`, the five exams. Held ≥ 2 s. | PLANLA. ODAKLAN. PUHU İLE. | code (EndCard) |

Copy on frames 06, 11, 14 and 15 is the app's own: `landing.morning.board.title`, `.goal`,
`.city`; `landing.morning.notebook.title`, `.question`, `.math` and `.math_tape`; `weeklyChest.scene_title` (days = 5)
and `weeklyChest.ready_title`; `landing.morning.story.title`, `analysis.recap.weekly_title.label`
and the API's `TITLE_FOCUS_DIVER_LABEL` / `_MESSAGE` (`apps/api/src/i18n/locales/tr/coaching.json`).
50 minutes is the default `coaching.weekly_recap.title_deep_focus_minutes`, so the card shows a
week that really earns the title. The note "kampüste görüşürüz!" is ours, written as the student's
own handwriting. Also ours: frame 11's other two pages ("%20'si 45 olan sayı kaçtır?" with
"oranı ters kurdum", "2⁵ · 2³ kaçtır?" with "üsler toplanır!") and the app question's note
"işlem hatası!"; frame 14's "Haftayı devirdin!"; and the owner's closing line "PLANLA. ODAKLAN.
PUHU İLE.".

Copy on frame 05 is ours: "Doktor mu, mühendis mi?", "Sen hangisisin?" and the sticker names, one
per career group of the app (`CAREER_GROUPS`): Dr. Puhu (Sağlık), Müh. Puhu (Mühendislik), Av. Puhu
(Hukuk & Kamu), Kodcu Puhu (Yazılım & Bilişim), Öğretmen Puhu (Eğitim), Patron Puhu (İşletme &
Ekonomi), Sunucu Puhu (Sosyal & İletişim), Ressam Puhu (Sanat & Tasarım), Prof. Puhu (Fen & Doğa),
Mimar Puhu (Mimarlık). Kodcu Puhu is the one that flies on, because the board's goal is
"Bilgisayar Mühendisi" and its photos include "kod".

Copy on frame 13: Zeynep "Paragrafta hep son soruda takılıyorum.", Can "Önce soru kökünü oku,
sonra metne dön." (12 alkış), Puhu "Seanslarına baktım: bugün 10 paragraf yeter." These are
example people and lines, drawn as in-app cards, with no real user data.

## Look and motion

- Ground: the kit's direction A, `#2F55D4` with the sunburst from R2, white Nunito 1000 type with
  the `#FFE082` second line, hard navy `#1E2A5A` drop shadows. Night parts use `#0D0E25` with the
  kit's 4-point sparkles. Handwritten notes use Caveat.
- Words slam in: scale about 1.4 → 1 with overshoot, a 2-frame shake, a stamp sound. Pills and
  chips pop with a spring. Ease out when things enter and ease in when they leave. One or two
  things move per beat, never everything at once.
- Clip scenes fill the 9:16 screen. The kit scales each Kling clip 6 % up from its top centre,
  so the bottom 5 % (where the KlingAI mark sits) falls off the frame; the start frames keep the
  bottom edge unimportant. Words on a clip scene are sticker type: white (second line `#FFE082`)
  with a thick navy `#1E2A5A` outline and a hard navy drop shadow, on the plain wall in the top
  third. Chips stay opaque stickers.
- Phone screens are coded (light `#F4F7FF` app screen as in F4/S1), with no platform UI or logos.
  The one exception is frame 08 (owner pick): real captures of the app's weekly plan and deneme
  result, taken from the local web app at phone width with a demo account (no real user data, no
  browser bar), shown inside the 3D phone. Ticks, the chip and the circle are coded over them.
- Transitions, in order:
  1. a zoom into the phone screen with a white flash;
  2. the Kodcu Puhu sticker tears off the album and slaps onto the vision board's goal card;
  3. a gold streak sweeps off the vision board and the screen turns to night over the city (the
     loop's own fly-in streak);
  4. the plan cards fly from around Puhu into the phone's week;
  5. the empty task circle becomes the timer ring (match cut);
  6. the ring grows past the screen edges and opens on Puhu's room;
  7. a question slip flies out of Puhu's book onto the Defterlerim desk, and the notebook flies at
     the camera;
  8. the notebook slides onto the top-down study table (match cut), then a cut to the masa;
  9. blue to night as the messages slide away;
  10. the camera dives into the chest's tall window;
  11. a nickname card flies out of the open chest and spins through the characters;
  12. the card's gold light flies into the facade's dark window, which lights up, and the camera
     dives in.
- Safe zone: the kit's reel rule. Text stays in x 60–900 and y 250–1500. The right rail starts at
  y 900, so centred blocks above it may span x 60–1020.

## Assets

| Need | Source | Status |
|---|---|---|
| Phone | kit `phone-3d-screen-hole.png` (cut from `art-source.local/social/raw/phone-raw.png`) + coded screen (`phone-matrix.ts`) | ready |
| Frame 08 screens | real captures of the app's weekly plan and deneme result (local web app, demo account, phone width, no browser bar) → `art-source.local/social/promo/screens/` | builder captures |
| Puhu poses | `p2-over-glasses`, `puhu-happy`; the host Puhu `apps/web/public/mascot/puhu/puhu-host.png` (1600×2000, transparent; owner pick for 03–04: the bow tie makes him the show's host, and only the intro wears it) | ready |
| Career Puhus | the app's `apps/web/public/mascot/career-3d/*.webp` (ten 320 px squares on white; the white ground becomes the sticker card; add them to the art test's `SMALL_OK`) | ready |
| Rooms | landing `city-facade`; seans `room-{home,cafe,library}-bg` + `-table` | ready (copy into `public/art/`) |
| Clip placeholders | rough tall mocks `art-source.local/social/promo/tall-mock/K3…K5-tall-mock.webp` (the old wide start frames on a plain wall), until the ChatGPT tall start frames exist | ready |
| Vision board | the four Puhu photos `art-source.local/landing-board/v1-kampus … v4-mezuniyet.webp` (1254 px squares), built in layers on a coded kraft board with a coded goal card, note, heart and star. Skip `heart_love.png` from the stickers: it carries small English text. | ready |
| Mistake notebook | coded: the app's Defterlerim desk (warm wall, wood desk) and the "Matematik Defteri" with three lined pages, plus the desk Puhu frames `apps/web/public/visuals/landing/desk-puhu-*.webp` (360×384: add them to the art test's `SMALL_OK`) | code |
| Weekly nickname card | `apps/web/public/img/character/nebula-diver.png` (Odak Makinesi; 941×1672) for the card, `time-bender` (Seri Canavarı) and `phoenix-pilot` (Korkusuz Denemeci) for the spin; each also has a clip in `public/video/character/` if a moving card reads better. `visuals/chest/chest-open.webp` (transparent, 384 px: add it to `SMALL_OK`) under the card | ready |
| Weekly chest | app clip `apps/web/public/visuals/chest/chest-open-tall.mp4` (720×1280, 5 s, mark already cropped) + `desk-chest-closed-tall.webp` as the first frame | ready |
| K1 Puhu out of the phone | `art-source.local/social/gen/promo-K1.mp4`: host Puhu peeks over the phone, beckons, flips over the edge and dives into the screen (ripples, feet, empty screen at 4,95 s) | ready |
| Magic loop | the app's `apps/web/public/mascot/puhu/motion/puhu-hero-magic-loop.mp4` (720×720, 24 fps, 4,2 s, ground about `#0E0F26`; shown in the app's soft round mask, so its edge never shows) and the landing's `visuals/landing/city-far`, `city-mid`, `city-front` | ready |
| K3 Puhu's room | `gen/promo-K3.mp4`: glasses push, turbo study with page flips, book slams shut at about 3,4 s, cheer to the end | ready |
| K4 masa | `gen/promo-K4.mp4`: wave and stand-ups 0,5–2,3 s, high-fives about 3,2–4 s, back to the books at the end; four Puhus with their outfits throughout | ready |
| K5 your room | `gen/promo-K5.mp4`: empty room, Puhu springs onto the desk at about 0,4 s, peeks from behind the chair at 2–2,7 s, points at the viewer from 3,6 s; the laptop drifts a little left over the clip (from the end frame) | ready |
| Music | royalty-free funk-pop with brass hits and claps, 118–124 BPM, drop at 0:08 (on the album), a break at 0:44, a build into 0:56, three hits from 0:58,5, 62 s; brief in PROMPTS §6 → `art-source.local/social/gen/promo-music.mp3` | builder |
| Sound effects | per-frame list in PROMPTS §6 (ping, whoosh + jelly blop, stamp, pop, pin tick, card flicks, lid creak + chime, lamp click) | builder picks royalty-free ones; the owner approves them |

Kling clips as delivered: 720×1280, 24 fps, 5,04 s, with an audio track (mute it); the mark is
"KlingAI 4.0" at about y 96–98 %, x 78–96 %. Start frames in `art-source.local/social/promo/kling-start/tall/`.

Before a Kling clip goes in, check it: the bottom-right corner (the KlingAI mark; the kit's 6 % crop
should drop it, check that it does), Puhu stays on model
(glasses, no green), and the energy is snappy.

## Build notes (for the plan)

- New kit piece `T1` (reel format, `video: { fps: 30, durationInFrames: 1860, endCardFrom: 1800, … }`), the copy in
  `src/copy.ts`, the caption in `src/captions.ts`, so the copy check runs on it.
- The kit's `EndCard` always shows its "ÇOK YAKINDA" pill unless a `tag` is passed; T1 needs a
  way to drop it.
- Placeholders first: until the clips arrive, each clip scene shows a still full screen with a
  slow push-in, so timing and type can be reviewed: the tall mocks now, the ChatGPT tall start
  frames once they exist. Swapping in a clip is a one-line change in `src/art.ts`.
- Music drives the beat grid. If the track is not 120 BPM, the beat length changes, the frame
  times above scale with it, and the drop is lined up with frame 05 (the album).
- Chest clip: it has a jump between about 1,6 and 1,8 s (seen in a cut check). Time the lid
  opening so the jump falls under the gold flash, or start the clip after it.
- Cover frame: frame 06 ("PLANLA" over the vision board) or frame 17, the owner's pick at review.

## Left to the builder

Exact easing curves, sound effect choice, type sizes within the kit's scale, pill and card
details, how the notification ping looks, the push-in on placeholders, the caption and hashtags
(following the parent spec's caption rules).

## Open, outside this spec

- The parent spec's check still holds: masa and topluluk must be live at launch before this posts.
- Posting slot: not the same week as R1 (same hook).
