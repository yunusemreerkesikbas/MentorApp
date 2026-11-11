# Feature ads design: "Puhu iş başında" + POV

Date: 2026-11-10. Status: **the owner picked the direction ("İş başında + POV") and approved the
three sample artboards in chat. Wave 1 is built in the kit and the owner approved its exports on
2026-11-11 (plan: [2026-11-10-feature-ads-plan.md](2026-11-10-feature-ads-plan.md)). Not committed.
Wave 2 waits for Higgsfield credits.**
Visual reference: the social canvas https://claude.ai/artifact/SbpcGU9oeauc78ZZM71yUK, row
"Özellik reklamları · Puhu iş başında + POV" (boards `F-Koruma-Post`, `F-POV-Story`,
`F-Koruma-Video`; local copies in `art-source.local/social/canvas/`, gitignored).
Builds on [the launch kit](2026-11-07-social-launch-kit-design.md): same kit, same tokens, same
copy rules. Read that spec first; this one only lists what is new.

## Intent

The launch kit introduces the brand and grows the waitlist. It has no piece that explains one
feature. This set does that: one feature per piece, for a young, YKS-heavy audience, in the
same meme tone.

Two angles tell each feature:

- **Puhu iş başında (feed, reel).** Puhu takes a job and acts the feature out: a bodyguard for
  the focus session, a detective for the wrong-answers notebook. One job per feature.
- **POV (story).** The student's own moment, then Puhu's dry reply, then the feature as the
  answer. It continues S1 ("Son bir video" dedin.).

## Campaign frame

| | |
|---|---|
| Name | Puhu iş başında |
| Objective | Waitlist signups from exam candidates who saw a feature piece. No numeric target yet: the first two weeks of organic posts set the baseline. |
| Secondary | Saves and shares per reach, Story link taps, Reel 3-second hold, comments on the two comment-bait pieces (IF6, IF7). |
| Primary audience | YKS candidates (last year of high school and graduates). Copy uses their words: TYT, deneme, Paragraf, Problemler. |
| Secondary audience | KPSS, ALES, DGS candidates. The jokes (phone, Monday, "sonra bakarım") fit them too. |
| Core message | Sınava hazırlanırken her işte Puhu yanında. |
| Channels | Instagram feed, Stories, Reels; Reels cross-posted to TikTok. Organic first, through Metricool drafts the owner approves one by one. |
| Paid | Later, once the ad accounts and pixels exist. Paid goes to 18+ only (graduates); the high-school audience stays organic. |
| Call to action | Soft, as in the launch kit: `puhukoc.com` on feed posts, the link sticker on Stories, "Yerini kap" in captions. No "ÇOK YAKINDA" on feed posts and Reels (they stay on the profile). |

Tracking depends on work that is not done yet: the waitlist conversion event and UTM links
(step 1 of the digital marketing setup). Each piece's link uses
`utm_campaign=is-basinda&utm_content=<piece id>`.

## Goals

- Wave 1: 5 features, 11 pieces (5 feed, 5 Story, 1 Reel), with no spend beyond the free
  Higgsfield credits.
- Wave 2: 5 more features plus 3 Reels, once credits are added.
- Every piece renders from the kit with its caption, hashtags and alt text, like the launch kit.

## Non-goals

- Hook variants per piece. The two angles are the A/B pair; add variants after real data.
- A Premium piece. The Premium set (PF1, PF2, PS1, PS2, PR1, PR2) already covers the yapay zekâ
  coach and joins the posting order as it is.
- Ad account setup, pixels, scheduling. Those belong to the digital marketing setup.
- X and LinkedIn cards, English versions.

## Anti-goals (a failure even if it renders)

All of the launch kit's, plus:

- **A feature claim the app does not keep.** The Koruma headline is "Şimdi olmaz, çalışıyor!",
  not "Bildirimler içeri giremez": the app does not block notifications.
- A Puhu that drifts from the 3D plush model (flat drawing, long legs, missing chest heart).
- Real platform logos or look-alike UI on notification chips and phone screens.
- Official facts in sample UI (exam durations, dates). Sample rows use topic names and short
  study times only.

## The series look

Tokens, type and safe zones are the launch kit's (direction A, ground `#2F55D4`).

**Feed, 1080×1350** (reference `F-Koruma-Post`): logo top left; yellow pill "PUHU İŞ BAŞINDA"
top right; a two-line headline, white line then a yellow line rotated −3° with the underline
stroke; a short body whose first sentence is white and the rest `#DCE6FF`; one feature element
cut down from the real app screen (a timer pill, a card); Puhu in costume, about 770 px wide,
breaking the right and bottom edges; two or three props that act out the joke on the left;
footer `puhukoc.com @puhukoc`.

**Story, 1080×1920** (reference `F-POV-Story`): logo; "POV:" pill; the student's line in quotes
and "dedin."; Puhu peeking; a white speech bubble that starts with "Kanka," and ends in a blue
line; the link sticker zone (`linkGuide`, off in exports); the feature card. When the Puhu art
has a hard crop, the card bleeds off the right edge to hide it.

**Reel, 1080×1920, 8 s = 16 beats** (reference `F-Koruma-Video`): hook 0–1.5 s, Puhu enters
1.5–3 s, message 3–6 s, end card 6–8 s. Motion is coded from the one still (slam-in with squash,
shake, props flung out), so a Reel needs no video generation. Silent master; the owner adds a
sound in the app. End card: logo, one line, `puhukoc.com`, no "ÇOK YAKINDA".

## The pieces

IDs: `IF` feed, `IS` Story, `IR` Reel; the number is the feature. "Designed" means the canvas
board is approved and is the spec. Copy for new pieces is my proposal; the owner reviews it in
the exports.

### Wave 1

| # | Feature | Puhu's job | Feed (IF) | Story (IS) | Reel (IR) |
|---|---|---|---|---|---|
| 1 | Odak seansı | Koruma | **designed.** "ŞİMDİ OLMAZ, / ÇALIŞIYOR!" · "Seansı başlat. 25 dakika kapıda Puhu var." · 25:00 timer pill · chips bounce off the palm | POV “Bir bildirime bakıp çıkacağım” dedin. · "Kanka, 40 dakika oldu." · card: 25:00, "Seansı başlat, kapıda Puhu var." | **designed.** "Tam çalışacaktın…" → "DUR!" → headline → "Seansı başlat. Kapıda Puhu var!" |
| 2 | Haftalık plan | Navigasyon | "ROTAN HAZIR, / YOLA ÇIK!" · "Haftanı Puhu kursun. İlk durak: Paragraf, 25 dakika." · route card with three stops | **designed.** POV “Pazartesi başlıyorum” dedin. · "Kanka, bugün pazartesi." · card "Haftan hazır!" | wave 2 |
| 3 | Yanlış Defterim | Dedektif | "YANLIŞLARIN / KAÇAMAZ!" · "Yanlış soruların tek defterde. Tekrar günü gelince karşına çıkar." · a "wanted" card: "ARANIYOR: işlem hatası" with the app's sample question | POV “Bu soruya sonra bakarım” dedin. · "Kanka, deftere yazdım. Kaçamaz." · card: Matematik Defteri, "Bugün 2 tekrar" | wave 2 |
| 5 | Masa ve odalar | Hakem | F1 with the series pill instead of "ÇOK YAKINDA" ("YALNIZ ÇALIŞMAK / YASAK!") | POV “Kütüphaneye gidince çalışırım” dedin. · "Kanka, kütüphane cebinde." · card: "Masada 4 kişi" with the masa scene | exists (R2) |
| 6 | Haftalık lakap ve sandık | Sunucu | "VE BU HAFTAKİ / LAKABIN…" · nickname card "Korkusuz Denemeci" · "Hafta bitince Puhu sana bir lakap takar. Seninki ne olur? Yorumlara yaz." | POV “Bu hafta hiçbir şey yapmadım” sandın. · "Kanka, 5 gün masadaydın." · card: "Bu haftaki lakabın: Gizli Kahraman" | wave 2 |

Feature 4 (deneme analizi) joined wave 1 on 2026-11-11 with the last two credits: IF4 "HAFTANIN / NET
DURUMU!" (forecast board: Geometri sıradaki, Problemler tekrar ister, Paragraf yerinde; body "Denemeni gir.
Sıradaki konunu tek bakışta gör.", the app's own line) and IS4 “Hangi konudan başlasam?” dedin. · "Kanka,
sıradaki Geometri." The weather-presenter Puhu (`b4-hava.png`) came out softer than the other three (less fur
detail, white wing tips); there was no credit for a second take. Regenerate it when credits allow.

### Wave 2

| # | Feature | Puhu's job | Feed (IF) | Story (IS) |
|---|---|---|---|---|
| 4 | Deneme analizi | Hava durumu spikeri | "BU HAFTA / GEOMETRİ HAVASI!" · "Denemeni gir, sıradaki konunu Puhu söylesin." · forecast board with "Sıradaki: Geometri" | POV “Hangi konudan başlasam?” diye 40 dakika düşündün. · "Kanka, Geometri. Rica ederim." |
| 7 | Kariyer Puhu'ları | 10 meslek | sticker album, "Doktor mu, mühendis mi? / Sen hangisisin?" · "Yorumlara yaz." | quiz sticker Story, same question |
| 9 | Haftalık lig | Maç spikeri | "SON DAKİKA!" · "Zeynep 40 XP ile zirvede." · "Haftalık ligde arkadaşlarınla yarış. Her seans puan." | POV “Bugün çalışmasam da olur” dedin. · "Kanka, Can az önce seni geçti." |
| 10 | Vision board | Ressam | "HEDEFİNİ / DUVARA AS!" · "Bölümün, şehrin, kampüsün. Her gün gözünün önünde." · the filled board | POV “Ben neden çalışıyordum?” dedin, saat 23:47. · "Kanka, duvara bak." |
| 11 | Topluluk soru-cevap | none (sticker) | none | POV “Bunu kime sorsam?” dedin. · "Kanka, topluluğa sor. Bana da yazabilirsin." |

Wave 2 Reels: IR2 (the route recalculates when Monday slips), IR3 (the magnifier sweeps a page
and stamps "ÇÖZDÜM"), IR6 (the nickname card flips and lands). Same 8 s frame.

Feature 8, the yapay zekâ coach, is the existing Premium set.

### Feature claims to check before export

Each row names something the app must do at launch. Check it against the roadmap and the launch
flags; if it is off, drop the piece from the order rather than soften the copy.

| Piece | Claim |
|---|---|
| IF1, IS1, IR1 | A focus session with a 25-minute timer. |
| IF2, IS2 | Puhu builds the weekly plan. |
| IF3, IS3 | Wrong answers collect in a notebook and come back on a review day. |
| IF5, IS5 | A shared table shows how many people are studying. |
| IF6, IS6 | A weekly recap gives a nickname; "5 gün masadaydın" is the app's own line. |
| IF4, IS4 | Entering a mock exam shows the next topic. |
| IF9, IS9 | A weekly league with XP. |
| IF10, IS10 | A vision board the student fills. |
| IS11 | Community questions, and Puhu answering in chat. |

Checked against `apps/web/messages/tr.json` on 2026-11-11 (wave 1 only; this confirms the app's own
copy says it, not that the feature flag is on at launch):

| Piece | Result |
|---|---|
| IF1, IS1, IR1 | Holds. The app speaks of a 25-minute session and "Seans bitince molan da hazır". |
| IF3, IS3 | Holds. "Tekrar günü gelince sorular kart kart önüne gelir." |
| IF5, IS5 | Holds in substance. The app's line is "{count} kişi çalışıyor"; "Masada 4 kişi" is the kit's wording since F1. |
| IF6, IS6 | Holds with a condition. The nickname comes after a full week ("Dolu geçen haftanın sonunda bir de lakabın olur"); "{days} gün masadaydın!" is the app's line. |
| IF2, IS2 | Holds, by the owner's ruling (2026-11-11). "Puhu’yla planla" opens with Coin or Premium ("Coin beklemeden her gün Puhu’yla planla!"); the pieces do not say it is free, and they stay as they are, with no Premium tag. |

## Posting order, wave 1 (no dates)

| Day | Piece | Day | Piece |
|---|---|---|---|
| 1 | IF1 + IS1 | 8 | IF5 |
| 2 | IR1 | 9 | IS5 |
| 3 | IF2 | 10 | IF6 |
| 4 | IS2 | 11 | IS6 |
| 5 | IF3 | 12 | PF1 (Premium, existing) |
| 6 | IS3 | 13 | R2 (existing) |
| 7 | rest, reshare comments | 14 | rest |

IS2 belongs on a Monday morning; shift the order by a day or two to make that happen. This
order runs after the launch kit's 14 days.

## Captions and paid fields

`caption.txt` as in the launch kit: post text, hashtag line (`#yks #tyt #ayt` first, then the
kit's line), alt text. Each piece gets two more lines for paid use: a headline of at most 40
characters and the suggested button ("Daha Fazla Bilgi"). First paid test, once accounts exist:
IF1, IS2, IF3 and IR1, to 18+ graduates.

## Art

| Job | Feature | Status | File |
|---|---|---|---|
| Koruma | 1 | **made** (Higgsfield, 2026-11-10) | `keyed/b1-koruma.png` 1731×1769, canvas blob `5a383f1e…` |
| Hakem | 5 | ready | `keyed/p1-referee-whistle.png` |
| Sunucu | 6 | ready | `marketing/social/public/art/puhu-host.png` |
| Kahraman | 8 | ready | `puhu-premium-hero.png` |
| 10 meslek | 7 | ready at sticker size only (320 px) | `apps/web/public/mascot/career-3d/` |
| Navigasyon | 2 | to generate (B2) | |
| Dedektif | 3 | to generate (B3) | |
| Hava durumu spikeri | 4 | to generate (B4) | |
| Maç spikeri | 9 | to generate (B5); pose reference `career-3d/sosyal_iletisim.webp` | |
| Ressam | 10 | to generate (B6); pose reference `career-3d/sanat_tasarim.webp` | |

### Generating a Puhu on Higgsfield

Found on 2026-11-10, on the free plan:

- Model `nano_banana_pro` (the job runs as `nano_banana_2`), 2K, 4:5: **2 credits** an image.
  `gpt_image_2_6` needs the Basic plan or higher.
- **References decide the style.** Use the 3D plush art (`p1-referee-whistle.png` and
  `puhu-host.png`). `apps/web/public/mascot/puhu/puhu-default.png` is a soft 2D drawing and
  returns a flat illustration.
- Prompt order: the character lock (round fluffy white plush owl, blue head tufts and wing tips,
  round blue glasses, orange beak, rosy cheeks, blue chest heart, short orange feet; "3D plush
  render, not a 2D drawing"), then costume and pose, then framing. Say "no whistle, no bow tie"
  because the references carry them. Ask for a flat `#FF00FF` ground, no floor, no shadow, no
  text. Never name another brand's mascot; add "not a green owl".
- Pose rule: one costume, one prop, one clear gesture toward the camera, snappy and exaggerated.
- Key the result with the launch kit's `key-alpha` command, then save raw and keyed files under
  `art-source.local/social/`.

| | Costume and pose |
|---|---|
| B2 Navigasyon | Small navy captain's cap. One wing holds a big unfolded paper map with a red pin, the other points sharply forward and up. Mid-stride, beak open. |
| B3 Dedektif | Tan deerstalker and short cape. Lunging forward with a huge magnifying glass over one eye, the other wing pointing down at a find. |
| B4 Hava durumu spikeri | Small navy blazer. A thin pointer stick aimed up and to the side, the other wing open in a presenter's gesture, wide TV smile. |
| B5 Maç spikeri | Headset with a boom microphone. One wing on the headset, the other fist in the air, beak wide open mid-shout. |
| B6 Ressam | Beret, brush raised like a baton, palette in the other wing, a dab of blue paint on one cheek. |

### Credits

| | Needs | Credits |
|---|---|---|
| Have now | | 6 |
| Wave 1 | B2 and B3, plus one retry | 6 |
| Wave 2 | B4, B5, B6, plus two retries | about 10 |
| Optional clip (Puhu itself moves) | 5 s, 720p, 9:16 | 5 each (`seedance_2_0_mini`, `grok_video_v15_lite`) or 10 (`kling3_0`); not tested, and video may need a paid plan |

Wave 1 fits the free credits. Wave 2 needs a top-up or a plan; the owner decides after seeing
wave 1.

## Left to the builder

- Shared components for the three templates (series feed, POV Story, 8 s Reel) so a new feature
  is copy, one Puhu and one feature element.
- The feature elements (route card, wanted card, nickname card, forecast board), each cut down
  from the real app screen it names.
- New `PieceId`s, copy in `src/copy.ts`, captions in `src/captions.ts`, art in `src/art.ts`;
  the copy check and safe-zone tests cover the new pieces.
- Compare references for IF1 and IS2 from the two approved canvas boards.

## Done when

Wave 1's 11 pieces render from one command into `out/` with captions. The copy check passes.
IF1 and IS2 match their canvas boards. Every wave-1 claim in the table above is checked. The
owner has reviewed the exports.
