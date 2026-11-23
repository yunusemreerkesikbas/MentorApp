# Feature ads, wave 2 design: "Her özelliğe kendi dünyası"

Date: 2026-11-23. Status: **direction and three sample boards approved by the owner in chat
(2026-11-22/23); builder check done, owner answers folded in (2026-11-23); this document waits
for approval. Not committed.**
Visual reference: the social canvas https://claude.ai/artifact/SbpcGU9oeauc78ZZM71yUK, row
"Özellik reklamları · Dalga 2" (v143; boards `D2-Pano-Post`, `D2-Album-Post`, `D2-Hikaye-Post`;
local copies and renders in `art-source.local/social/canvas/` and `reference/`, gitignored).
Builds on [wave 1](2026-11-10-feature-ads-design.md) and [the launch kit](2026-11-07-social-launch-kit-design.md):
same kit (`marketing/social`), tokens, copy rules and anti-goals. This spec lists only what is new.

## Intent

Four features sell well on sight but have no piece of their own, or only a joke piece: Yanlış
Defterim, the hedef panosu (vision board), the haftalık hikâye (weekly recap) and the kariyer
Puhu'ları (career variants). Wave 2 shows each one **inside its own app world**, so the viewer
sees the thing they would get, not a mascot acting it out. The owner wants one design core that
works twice: organic posts now (puhukoc.com), paid ads at the mobile launch (~mid-December 2026).

## Owner decisions (2026-11-22/23)

| Question | Decision |
|---|---|
| Purpose | Both. Organic now; at launch the same visuals become ads with store CTA and badges, 2–3 hook variants per feature, 18+ targeting. No paid spend before launch. |
| Wave 1 overlap | Keep IF3/IS3 (dedektif Yanlış Defterim) and IF6/IS6 (lakap). Wave 2 adds new angles. |
| Look | **B · Kendi dünyası.** Each feature on its own app ground; a shared brand layer ties them. |
| Format | **4:5 posts** (1080×1350), single and carousel. No Stories in this wave (owner, 2026-11-23). |
| Weekly story tag | No Coin/Premium tag, same as the wave 1 plan pieces (my call, carried from the owner's 11 Nov ruling). |

## Design stop before code

Owner (2026-11-23): the nine pieces without an approved board go to the canvas first. One canvas
round shows DFY in full, slides 1–2 of each carousel, and a frame strip for each Reel. Code starts
after the owner approves that row; the three designed posts can be coded in parallel.

## Approaches considered

- **A · Puhu iş başında, continued.** One costume per feature on the blue ground. Cheapest to
  build (the template exists), but repeats wave 1 and hides the feature behind the joke.
- **B · Kendi dünyası (picked).** Each feature in the app's own visual world. Shows the product,
  stands apart from wave 1, and reuses the app's real art. Costs four backgrounds instead of one.
- **C · Gece şehri.** Every feature in the night-city world of the landing and promo. Strong
  brand, but the four features would look alike.

## Goals

- 4 features × (1 feed post + 1 carousel) + 4 Reels = **12 organic pieces**.
- A paid twin for every feed post and carousel: same art, swapped hook, footer and button.
- No new generated art required to ship; Kling clips are an optional upgrade for the Reels.

## Non-goals

- Stories (owner, 2026-11-23). Wave 1 Stories keep running.
- Ad accounts, pixels, audiences, budget. Those belong to the digital marketing setup.
- English versions.

## Anti-goals (a failure even if it renders)

All of wave 1's, plus:

- A world that is not the app's. Colours, shapes and cards come from the app (recap palette,
  cork board, notebook, sticker set); nothing invented that the student will not find inside.
- Plain UI screenshots as the hero, or extra explanatory text. The art leads; one body line.
- Mocking the student's results (a low recap, a wrong answer used as a joke at their expense).
- Invite-only, KVKK or pricing details in the creative (those live in the aydınlatma and consent texts).
- "AI" anywhere; it is "yapay zekâ".

## The shared layer

Every wave 2 post carries: the lowercase `puhukoc` logo top left (ink of the world); a pill or
chip top right naming the feature; a two-line headline in Nunito 1000, second line rotated −3°
with an underline or a black text shadow; one body line at most; footer `puhukoc.com @puhukoc`
bottom left. Carousel slides 2..n drop the headline and keep logo, chip and a slide counter.

## The four worlds

| Feature | World | Ground | Ink | Art source |
|---|---|---|---|---|
| Hedef panosu | Warm wall, wooden cork board with pinned polaroids, a goal card, and the board as a phone lock screen | wall `#F6E4CC` (tweak `#FCEBD9`, `#EAF1FF`), cork `#C8955E`, wood `#8A5A33` | navy `#0F2233`, blue `#2F55D4`, gold underline `#F2B53A` | `marketing/social/public/art/t1/board-v1..v4`, career sticker |
| Kariyer Puhu'ları | Sticker album page, ten die-cut career stickers | sun `#FFD54A` (tweak `#FFE082`, `#9CCBF5`) with a dot grid | navy, blue | `apps/web/public/mascot/career/*.png` (1024 px; the `D2-Album-Post` board uses this set, not the kit's 320 px `art/t1/career-*`) |
| Haftalık hikâye | The app's recap: story slides with progress bars, black chips, recap shapes, and the gold nickname trading card | coral `#FF5B49` (tweak lavender `#AFB1FF`, mint `#16D0A6`) | black, white | `public/visuals/weekly-recap-2023/*`, `art/t1/char-*.png`, TradingCard |
| Yanlış Defterim | Cream spiral notebook page: subject band, taped question, red-pen note, green "ÇÖZDÜM" stamp | cream (C direction boards `C-Post`, `C-Story`) | navy, blue, red pen `#E5484D`, green stamp | IS3's notebook page (wave 1), dedektif Puhu `b3` |

## The pieces

IDs: `DF` feed post, `DC` carousel, `DR` Reel; letter = feature (`P` pano, `K` kariyer,
`H` hikâye, `Y` Yanlış Defterim). "Designed" means the canvas board is approved and is the spec.
Other copy is my proposal; the owner reviews it in the exports.

| ID | Format | Content |
|---|---|---|
| **DFP** | post | **designed** (`D2-Pano-Post`). "HEDEFİNİ / DUVARA AS!" · "Panonu kur, kilit ekranın yap. Her açışta hedefin karşında." · cork board + lock-screen phone, Caveat "kilit ekranın oldu!" |
| DCP | carousel, 5 | 1 hook = DFP's board without the phone, "Panonu 4 adımda kur →". 2 "Şehrini seç" (map pin over Konya photo). 3 "Alanını seç" (career sticker lands on the board). 4 "Fotoğraflarını as" (polaroids pinned). 5 "Kilit ekranın yap" = the phone, full size, plus CTA. |
| **DFK** | post | **designed** (`D2-Album-Post`). "SEN HANGİ / PUHU’SUN?" · "Alanını seç, Puhu o kıyafete bürünsün." · 10 stickers + empty "SENİNKİ? yorumlara yaz!" slot. Comment bait. |
| DCK | carousel, 7 | 1 hook "Puhu'n mesleğini giyiyor →". 2–6 two careers per slide (all ten), each sticker big with its field name and one line ("Sağlık: önlük hazır, stetoskop boynunda."; the other nine lines are my proposal, reviewed in the exports). 7 the empty slot, "Seninki hangisi? Yorumlara yaz." |
| **DFH** | post | **designed** (`D2-Hikaye-Post`). "HAFTA BİTTİ, / HİKÂYEN HAZIR!" · gold "Odak Makinesi" card in front, lavender "5 gün" and mint "312 dakika / MATEMATİK" slides behind. |
| DCH | carousel, 5 | The recap told as the app tells it, one slide per story page: 1 "HAFTANIN HİKÂYESİ" cover. 2 "5 gün buradaydın!" with the day strip. 3 "312 dakika tam odak". 4 "En çok: MATEMATİK". 5 the gold card face up, "Bu haftaki lakabın: Odak Makinesi". Slides alternate coral, lavender, mint. |
| DFY | post | "YANLIŞ MI YAPTIN? / DEFTERE YAPIŞTIR!" · "Soruyu fotoğrafla, deftere koy. Tekrar günü gelince karşına çıkar." · the notebook page large and tilted, taped question, red-pen "işlem hatası!", green ÇÖZDÜM stamp. |
| DCY | carousel, 4 | 1 hook "Aynı soruyu üçüncü kez mi yanlış yaptın? →". 2 taped question + "Soruyu fotoğrafla ya da yaz." 3 red pen "Neden kaçırdın? işlem hatası" + "Dersine, konusuna koy." 4 review card + ÇÖZDÜM stamp, "Tekrar günü gelince kart kart önüne gelir." |
| DRP | Reel 8 s | Empty cork board → four polaroids slam in on the beat with pins → goal card lands → camera pushes into the phone, the board becomes the lock screen, 07:30 ticks on. End card. |
| DRK | Reel 8 s | One sticker in the centre swaps costume on every beat through all ten fields (squash on each swap), ends on the empty slot "Sen hangisisin?". |
| DRH | Reel 8 s | Tap-through like the app: progress bar fills, 5 gün → 312 dakika → MATEMATİK → the gold card flips and lands. |
| DRY | Reel 8 s | A question is taped onto the page → red pen writes "işlem hatası" → calendar flips to the review day → the card comes back → ÇÖZDÜM stamp slams. |

Reels use wave 1's 8 s frame (hook 0–1.5 s, build 1.5–6 s, end card 6–8 s), silent master, motion
coded from stills. A Kling clip (below) can replace one beat if the owner makes it.

## Feature claims to check before export

Checked against `apps/web/messages/tr.json` on 2026-11-23 (the app's copy says it; launch flags
still to confirm):

| Pieces | Claim | Result |
|---|---|---|
| DFP, DCP, DRP | Pick a city, field and photos; turn the board into a lock-screen wallpaper. | Holds: "Hedef şehrini haritada seç, alanını ve fotoğraflarını panona ekle. İstersen duvar kâğıdı yap…", "Telefonunun kilit ekranına göre ölçülü." |
| DFK, DCK, DRK | Picking a field dresses Puhu in it. | Holds: "Hedef panonda Puhu seni bu alanla karşılar."; the career art replaces Puhu app-wide except the Premium variant. Do not claim more than ten fields. |
| DFH, DCH, DRH | A weekly story with days, minutes, top subject and a nickname. | Holds with a condition: the nickname comes after a full week; the story opens with Coin or Premium. No tag, no "ücretsiz". Numbers are samples. |
| DFY, DCY, DRY | Photograph or type a question, file it by subject, it returns on a review day. | Holds: "Soruyu fotoğrafla ya da yaz, dersine ve konusuna koy. Tekrar günü gelince sorular kart kart önüne gelir." Free photos have a quota, so never say "sınırsız". |

## Paid twins (at the mobile launch)

Scope (my call): each feed post gets three twins, one per hook; each carousel gets one twin that
swaps slide 1 to Hook A and the last slide's footer; Reels get no paid twin until organic data
picks which to promote. "Şimdi Yükle" is Meta's CTA field in `caption.txt`, not drawn into the
image (as in wave 1).

Same art. Changes: the footer becomes the App Store and Google Play badges; the button is
"Şimdi Yükle". No "ücretsiz" wording. Audience 18+. Owner (2026-11-23): **build the twins now with a
placeholder badge slot**; at launch the official Turkish badges (downloaded from Apple and Google,
with the owner's OK) replace it and one command re-exports. Three hooks per feature swap the headline:

| Feature | Hook A (organic) | Hook B | Hook C |
|---|---|---|---|
| Hedef panosu | HEDEFİNİ / DUVARA AS! | KİLİT EKRANIN / HEDEFİN OLSUN! | HER AÇIŞTA / HEDEFİN KARŞINDA! |
| Kariyer | SEN HANGİ / PUHU’SUN? | DOKTOR MU, / MÜHENDİS Mİ? | PUHU'N / ÖNLÜĞÜNÜ GİYDİ! |
| Haftalık hikâye | HAFTA BİTTİ, / HİKÂYEN HAZIR! | BU HAFTAKİ / LAKABIN NE? | 5 GÜN, 312 DAKİKA, / 1 LAKAP! |
| Yanlış Defterim | YANLIŞ MI YAPTIN? / DEFTERE YAPIŞTIR! | AYNI SORU / BİR DAHA KAÇMAZ! | TEKRAR GÜNÜ / GELDİ! |

Kariyer can also run per field to interest audiences (health, engineering, law, design…): one
post per field with that sticker alone and "Hedefin [alan] mı? Puhu'n hazır." That needs the
hi-res 3D career set below; the flat stickers look thin at full-post size.

## Art

Ready, no generation needed: board photos, ten flat career stickers (1024 px), recap shapes,
nickname character art, dedektif Puhu, notebook page.

Optional, made by the owner from these prompts:

**ChatGPT image · hi-res 3D career Puhu (for the per-field paid posts), one per field.**
Attach `apps/web/public/mascot/career-3d/<field>.webp` and `keyed/p1-referee-whistle.png` as
references.
> A 3D plush render of a round, fluffy white owl mascot with blue head tufts and blue wing tips,
> round blue glasses, a small orange beak, rosy cheeks, a small blue heart on the chest and short
> orange feet. Not a green owl, not a 2D drawing. Same costume and props as the first reference:
> [costume from the career-3d file, e.g. "a white doctor's coat with a stethoscope"]. Snappy,
> exaggerated pose toward the camera: [one gesture, e.g. "one wing thrown up in a proud wave,
> beak open in a laugh"]. Full body, centred, soft studio light, flat #FF00FF background, no
> floor, no shadow, no text. 2048×2048.

Key with the kit's `key-alpha` and save raw + keyed under `art-source.local/social/`.

**Kling clips (image-to-video, 5 s, 9:16), one per Reel, each replacing its build beat.** Start
frame = a kit render of the scene. Never name another brand; keep "not a green owl".
- DRP: "The fluffy white 3D plush owl with blue glasses jumps up to the cork board and pins a
  photo with a quick, snappy wing slap, bounces back and points at it proudly. Energetic,
  cartoon timing, squash and stretch. Camera static. Not a green owl."
- DRK: "The same plush owl spins once on the spot and its outfit pops into a doctor's coat in a
  burst of confetti, it strikes a proud pose. Fast, punchy, exaggerated. Camera static."
- DRH: "The plush owl in a diver's suit bursts out of a swirling cosmic portal toward the
  camera, gives a big salute, glowing stars fly past. Fast and energetic. Camera slowly pushes in."
- DRY: "The plush owl in a detective hat slams a big green stamp onto a notebook page, the page
  jumps, the owl throws both wings up in triumph. Snappy, exaggerated cartoon motion. Camera static."

## Captions and tracking

As wave 1: `caption.txt` per piece (post text, hashtag line starting `#yks #tyt #ayt`, alt text)
plus paid headline (≤ 40 characters) and button. Links use
`utm_campaign=kendi-dunyasi&utm_content=<piece id>`; paid twins add `utm_source=meta&utm_medium=paid`.

## Posting order (organic, no dates)

| Day | Piece | Day | Piece |
|---|---|---|---|
| 1 | DFP | 6 | DRK |
| 2 | DCY | 7 | rest, answer DFK comments |
| 3 | DFK | 8 | DCH (Monday, after a week ends) |
| 4 | DRP | 9 | DFY |
| 5 | DFH (Sunday evening) | 10 | DCP |

DRH, DRY, DCK fill later days. Nothing is posted or scheduled without the owner's OK per piece.

## How it is built (owner, 2026-11-23)

Posts, carousels and paid twins are **canvas boards exported straight to PNG** with
`art-source.local/social/tools/render.mjs`; they are not rebuilt in the kit. Only the four Reels
are built in `marketing/social` (Remotion), because they move.

- Paid twins are props on the same board: `hook` (A/B/C swaps the headline) and `paid` (footer
  becomes a "App Store · Google Play" placeholder slot). Carousels: `slide` picks the slide.
- Exports land in `art-source.local/social/out/D2/<piece id>/` with `caption.txt` (post text,
  `#yks #tyt #ayt` hashtag line, alt text, paid headline ≤ 40 characters and button
  "Şimdi Yükle", link with UTM).
- Before export, check that the four features are on in the launch config; if one is off, drop
  its pieces from the order rather than soften the copy (wave 1's rule).

## Done when

All 12 organic pieces and their paid twins are exported with captions, the posts and carousels
from their approved boards and the Reels from the kit. Every claim above is still true at export.
The owner has reviewed the exports.
