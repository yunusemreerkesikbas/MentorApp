# PuhuKoç sosyal kit · ChatGPT + Kling prompt paketi

Bu paket, kodla ürettiğimiz kitin (`out/`) yanında **alternatif üretim yolu**. Görselleri
ChatGPT, videoları Kling üretir. Promptlar İngilizce (modeller daha tutarlı); görsellerin
içindeki yazılar Türkçe ve birebir.

## Nasıl kullanılır

**ChatGPT (görsel)**
1. Yeni bir sohbet aç. İlk mesaj olarak §1'deki **kilit mesajını** gönder ve şu dosyaları ekle:
   `apps/web/public/mascot/puhu/puhu-default.png`, `puhu-happy.png`, `motion/wave.png`, ayrıca
   stil örneği olarak `marketing/social/out/F1/F1.png` ve `out/S1/S1.png`.
2. Sonra her parça için tek bir mesaj gönder (§2). Aynı sohbette kal, karakter böyle sabit kalır.
3. **Boyut:** ChatGPT en fazla 2:3 dikey (1024×1536) ya da 3:2 yatay verir.
   - Feed 4:5 ve Story/Reel 9:16 için zemin düz renk; ben üstten/alttan uzatıp kırparım.
   - Story'lerde üst ve alt 250 px'lik bantta yazı olmaz (Instagram arayüzü kapatır).
4. **Yazı bozulursa** (ı, İ, ş, ğ en sık bozulanlar): aynı sohbete
   `Same image, but with no text at all.` yaz. Yazıyı ben kodla ya da Canva'da eklerim.
5. **Logo:** logo artık küçük harfle **puhukoc** (ç yok, sembol yok). ChatGPT onu birebir çizemez; gelen yazının üstüne gerçek logoyu
   koyarız.
6. Dosyaları `art-source.local/social/gen/<parça>.png` olarak kaydet (ör. `gen/F1.png`).

**Kling (video)**
- Image to Video. Ayarlar: 9:16, Professional / High Quality, Relevance (cfg) yaklaşık 0.6.
  Süre her klipte yazılı.
- Başlangıç karesi ve varsa bitiş karesi §3'teki **yazısız** ChatGPT karelerinden gelir.
- Her klipte 2–3 deneme yap. Puhu yeterince enerjik değilse prompta şunu ekle:
  `even faster, more exaggerated, bigger squash and stretch`.
- Kling'e yazı yazdırmıyoruz. Yazılar kurguda eklenir (bizim Remotion kitimiz ya da CapCut).
- Telefon ekranları düz `#00FF00` yeşil: kendi ekranımızı sonradan oturturuz.
- Kling logosu çıkarsa kırparım.
- Klipleri `art-source.local/social/gen/` altına koy. Remotion reel'lerine gömebilirim.

---

## 1. Kilit mesajı (ChatGPT, ilk mesaj)

```
We are making a social media launch kit for PuhuKoç, a Turkish exam-prep study app. Keep these
locks in every image in this chat.

CHARACTER: Puhu (see the attached references). A fluffy white cloud-like owl chick with big round
dark-blue wire glasses, two light-blue feather tufts on the head, light-blue wing tips, a small
light-blue heart on the chest, an orange beak, pink cheeks and tiny orange feet. Soft premium 3D
plush render with clean edges. Same face and proportions every time. Always high energy: big
exaggerated cartoon poses, squash and stretch, caught mid-action, expressive eyes, beak open.

BRAND: flat saturated colour, no gradients unless I ask. Royal blue #2F55D4, butter yellow
#FFE082, navy ink #0F2233, white, light tint #DCE6FF. Night scenes: deep navy #0B1636 with warm
lamp light. Paper scenes: cream #FAF6F0 with a faint dot grid #E6DEC8, off-white cards #FFFDF8,
handwriting in ink blue #1A5FA3.

LOGO: the wordmark is "puhukoc", all lowercase, no ç, no symbol, in a bold geometric sans (like Outfit
Bold), one solid colour. Write it exactly like that wherever I ask for the logo.

TYPE: huge, heavy, rounded geometric sans-serif (like Nunito Black) with tight letter spacing.
Handwritten notes in a casual marker script (like Caveat). Render Turkish text exactly as I give
it, letter for letter, including ı İ ş ğ ç ö ü. Never add words I did not give you.

STYLE: bold mascot-brand social post. Flat colour ground, oversized type, the mascot bursting out
of the frame, chunky pills with a hard navy drop shadow, small 4-point sparkle stars.

NEVER: a green owl, any other mascot, photorealism, people, brand logos, store badges, drawn
buttons or links, watermarks, calm or sleepy poses (unless I ask for one).

Reply only "Hazır" to this message.
```

---

## 2. Tasarım promptları (ChatGPT)

Her prompt tek mesaj. Sonundaki **Exact text** satırı, görselde olabilecek yazıların tamamı.

### F1 · Yalnız çalışmak yasak (feed 4:5, yön A)

```
F1: Instagram feed post, 4:5 portrait. If you can only make 2:3, add plain blue above and below.
Royal blue ground with one big translucent white circle in the bottom-left corner.
Top-left: the "puhukoc" logo in white. Top-right: a yellow pill tilted -4° with navy
text "ÇOK YAKINDA" and a hard navy shadow.
Headline, left-aligned, filling the top half: "YALNIZ" and "ÇALIŞMAK" in giant white letters,
then "YASAK!" even bigger in yellow, tilted -3°, with a hand-drawn yellow double underline. Three
yellow burst lines next to the headline, like a whistle blast.
Small row under it: "KPSS · YKS · LGS · ALES · DGS" in light tint.
Bottom-left: Puhu as a referee, blowing an orange whistle so hard his cheeks puff, one wing
jabbing toward a big smartphone on the right. The phone is tilted 4° and cut off by the bottom
edge. On its light screen: a small "Masada 4 kişi" chip and a big focus-ring timer "18:42" with
"odak" under it. Four Puhus around a round wooden study table under a lamp burst out of the top
of the screen.
Bottom-left text: "puhukoc.com" in bold white, "@puhukoc" in light tint.
Exact text: puhukoc, ÇOK YAKINDA, YALNIZ, ÇALIŞMAK, YASAK!, KPSS · YKS · LGS · ALES · DGS,
Masada 4 kişi, 18:42, odak, puhukoc.com, @puhukoc
```

### F2 · Sınava çalışmak zor (feed 4:5, yön C)

```
F2: Instagram feed post, 4:5 portrait. Cream paper ground with a faint dot grid.
Big heavy rounded headline, left-aligned, all lowercase, five lines:
line 1 "sınava çalışmak" in navy;
line 2 three die-cut Puhu stickers with white borders (mind blown with stars around his head,
wide-eyed in a nightcap clutching a coffee mug, facepalm), then the word "zor." in navy;
lines 3–5 "o yüzden", "birlikte", "çalışıyoruz." in royal blue.
A hand-drawn ink-blue arrow curves from the right of "çalışıyoruz." up toward a handwritten
marker note in ink blue, tilted -3°: "evet, sen de dahilsin."
Bottom-left: Puhu pops up from the bottom edge with a big wink and a cheeky grin, only his top
half visible.
Bottom-right: the "puhukoc" logo in near-black, under it "puhukoc.com · @puhukoc" in ink blue.
Exact text: sınava çalışmak, zor., o yüzden, birlikte, çalışıyoruz., evet, sen de dahilsin.,
puhukoc, puhukoc.com · @puhukoc
```

### F3 · Yerini şimdiden ayıralım (feed 4:5, yön B)

```
F3: Instagram feed post, 4:5 portrait, night mood.
Top 60%: Puhu leaps with joy in a glowing open window at night, holding a small lantern high,
feet off the sill, warm curtains and a flower box, deep navy wall around the window.
Top-left: yellow pill tilted -3° with navy text "ÇOK YAKINDA" and a hard navy shadow.
Top-right: the "puhukoc" logo in white.
On the right, over the scene: an off-white paper note taped with yellow tape, tilted 4°.
Handwritten in navy: "Tüm sınavlara tek puhu yeter"; under it in small grey caps
"KPSS · YKS · LGS · ALES · DGS".
Bottom 40%: a deep navy #0B1636 panel with rounded top corners. Text, left-aligned:
"Yerini şimdiden" in white, then "ayıralım!" bigger in yellow, then a short paragraph in light
grey-blue: "PuhuKoç'u senin için hazırlıyoruz. E-postanı bırak, açıldığında ilk sana haber
verelim." Bottom-left: "@puhukoc" in grey-blue.
Exact text: ÇOK YAKINDA, puhukoc, Tüm sınavlara tek puhu yeter, KPSS · YKS · LGS · ALES · DGS,
Yerini şimdiden, ayıralım!, PuhuKoç'u senin için hazırlıyoruz. E-postanı bırak, açıldığında ilk
sana haber verelim., @puhukoc
```

### F4 · Puhu'yla bir gün (carousel, 5 kart, feed 4:5, yön A)

Önce bu stil mesajını gönder, sonra beş kartı ayrı ayrı iste.

```
F4 carousel style for the next five cards: 4:5 portrait, royal blue ground, a big translucent
white circle bottom-left, small yellow and white 4-point sparkles, the "puhukoc" logo in white top-left.
Layout on cards 1–4: a giant yellow time word top-left, one white line under it (max 4 short
lines), a smartphone on the right tilted 4–6° and cut off by the bottom edge with a simple light
app screen (two or three big elements, no clutter), and an energetic Puhu bottom-left.
Reply only "Hazır".
```

```
F4 card 1: top-right yellow pill "Puhu'yla bir gün" with a navy shadow. Time word "Sabah". Line:
"Puhu günün planını hazırlar. Sen sadece başla." Phone screen: title "Bugün", a small chip
"Puhu planını hazırladı", three white rows with checkboxes: "2 seans çalış" (ticked and
struck through), "40 paragraf çöz", "10 dk tekrar". Puhu in a blue bow tie throws one wing wide
toward the phone like a game-show host.
Exact text: puhukoc, Puhu'yla bir gün, Sabah, Puhu günün planını hazırlar. Sen sadece başla.,
Bugün, Puhu planını hazırladı, 2 seans çalış, 40 paragraf çöz, 10 dk tekrar
```

```
F4 card 2: time word "Öğlen". Line: "Masada 4 kişi. Kimse yalnız çalışmıyor." Phone screen: four
Puhus around a round wooden study table under a lamp, bursting out of the top of the screen;
under it a chip "Masada 4 kişi" and a focus-ring timer "18:42" with "odak". No extra Puhu on
the card.
Exact text: puhukoc, Öğlen, Masada 4 kişi. Kimse yalnız çalışmıyor., Masada 4 kişi, 18:42, odak
```

```
F4 card 3: time word "Akşam". Line: "Haftalık özetin hazır. Bu haftaki lakabın: Gizli Kahraman."
Phone screen: title "Bu hafta", a big blue number "6 sa 40 dk" with "toplam odak" under it,
seven small bar columns, and a yellow card tilted -2° reading "Bu haftaki lakabın" over
"Gizli Kahraman". Puhu bottom-left with a mind-blown face, stars popping around his head.
Exact text: puhukoc, Akşam, Haftalık özetin hazır. Bu haftaki lakabın: Gizli Kahraman.,
Bu hafta, 6 sa 40 dk, toplam odak, Bu haftaki lakabın, Gizli Kahraman
```

```
F4 card 4: time word "İstersen". Line: "Gerçek bir koç da masana katılır." Phone screen: title
"Koçum", a chat bubble from a plain ink-blue avatar circle (no face, no name) with small label
"Koçun" and the message "Bu hafta harika gidiyorsun.", a blue reply bubble "Teşekkürler!", and a
small typing bubble with three dots. Puhu peeks up from the bottom-left edge with a big wink.
Exact text: puhukoc, İstersen, Gerçek bir koç da masana katılır., Koçum, Koçun,
Bu hafta harika gidiyorsun., Teşekkürler!
```

```
F4 card 5 (closing, no phone): top-right yellow pill "ÇOK YAKINDA". Giant yellow "Yerini" /
"kap!" on two lines top-left with a hand-drawn yellow underline. Under it "puhukoc.com" in big
white and "@puhukoc" in tint. Puhu the referee bursts in from the right edge, huge in the frame,
blowing the whistle and pointing straight at "puhukoc.com". Bottom-left small row
"KPSS · YKS · LGS · ALES · DGS".
Exact text: puhukoc, ÇOK YAKINDA, Yerini, kap!, puhukoc.com, @puhukoc,
KPSS · YKS · LGS · ALES · DGS
```

### F5 · Hangi sınava hazırlanıyorsun? (feed 4:5, yön C)

```
F5: Instagram feed post, 4:5 portrait. Cream paper ground with a faint dot grid.
Headline top-left, heavy rounded: "Hangi sınava" in navy, "hazırlanıyorsun?" in royal blue.
Five round rubber-stamp badges, equal size, white fill, thick navy ring, hard navy drop shadow,
each slightly tilted (between -6° and 6°), laid out 3 on top and 2 below. One word each in heavy
royal blue: "KPSS", "YKS", "LGS", "ALES", "DGS".
Right side: Puhu in a blue bow tie, mid-shout, one wing flung out pointing at the stamps, feet
off the ground. Handwritten ink-blue marker note under the stamps, tilted -3°: "yorumlara yaz,"
on one line and "Puhu sayıyor." on the next.
Bottom-left: the "puhukoc" logo in near-black, then "puhukoc.com · @puhukoc" in ink blue.
Exact text: Hangi sınava, hazırlanıyorsun?, KPSS, YKS, LGS, ALES, DGS, yorumlara yaz,
Puhu sayıyor., puhukoc, puhukoc.com · @puhukoc
```

### F6 · Tek başına ben / masada ben (feed 4:5, yön C)

```
F6: two-panel meme, 4:5 portrait. Cream paper ground with a faint dot grid.
Two tall off-white paper panels side by side, each taped at the top with yellow tape, the left
one tilted -2°, the right one 2°. Each has a heavy navy caption at the top, and a big die-cut
Puhu sticker with a white border bursting out of the bottom edge of the panel.
Left caption "Tek başına çalışırken ben:" over Puhu in a starry nightcap clutching a coffee mug,
one eye twitching, funny-tired.
Right caption "Masada Puhu'larla ben:" over Puhu laughing so hard that tears fly sideways,
kicking his feet.
Bottom centre: the "puhukoc" logo in near-black, under it "puhukoc.com · @puhukoc" in ink blue.
Exact text: Tek başına çalışırken ben:, Masada Puhu'larla ben:, puhukoc, puhukoc.com · @puhukoc
```

### S1 · POV: son bir video (Story 9:16, yön A)

```
S1: Instagram Story, 9:16 portrait (if you can only make 2:3, keep everything in the middle and
I will extend the blue). Keep the top and bottom 13% free of text.
Royal blue ground with soft white sunburst rays from the lower right, a few sparkles.
Centred near the top: the "puhukoc" logo in white. Under it a yellow pill tilted -4° "POV:", then giant
white "“Son bir video”" and an even bigger "dedin." below.
Middle-left: a white speech bubble tilted -4° with a hard navy shadow and a tail pointing right:
"Kanka," in navy, "bu 7. son." in royal blue.
Right: Puhu peers over his glasses with a long suspicious side-eye, rising from behind a giant
smartphone that fills the bottom of the frame and is cut off by the bottom edge. The phone
screen is light: a status bar "01:47", the line "Telefon zaten elinde." and below it big royal
blue "Yerini kap!" on a yellow marker stroke. Leave the space under "Yerini kap!" empty.
Exact text: puhukoc, POV:, “Son bir video”, dedin., Kanka,, bu 7. son., 01:47,
Telefon zaten elinde., Yerini kap!
```

### S2 · Gece çalışan tek kişi sen değilsin (Story 9:16, yön B)

```
S2: Instagram Story, 9:16 portrait. Keep the top and bottom 13% free of text.
Full-bleed night city: a cosy apartment building at night, every window lit warm yellow, and in
every window a Puhu studying at a desk (reading, writing, one stretching with a cheer).
A dark navy fade over the top half so the text reads.
Top centre: the "puhukoc" logo in white. Headline centred: "Gece çalışan" and "tek kişi" in giant white,
"sen değilsin." in yellow.
Lower third: an off-white paper note tilted -3°, taped with yellow tape, handwritten in navy
marker: "Masaya otur, birlikte çalışalım!". Leave empty space under the note.
Exact text: puhukoc, Gece çalışan, tek kişi, sen değilsin., Masaya otur, birlikte çalışalım!
```

### S3 · Bugünün listesi (Story 9:16, yön C)

```
S3: Instagram Story, 9:16 portrait. Keep the top and bottom 13% free of text.
Cream paper ground with a faint dot grid. Top centre: a small "puhukoc" logo in near-black, under it a
big handwritten royal-blue "bugünün listesi" tilted -2°.
A lined notepad page taped with yellow tape, tilted -2°, with four rows, each a navy checkbox:
"2 seans çalış", "40 paragraf çöz", "Puhu'ya haftanı kurdur" ticked in blue and struck through
in grey; the last row "Yerini ayır" unticked, bold navy, on a yellow highlighter stroke.
Under the pad, handwritten in navy: "sonuncusu 10 saniye sürüyor."
Bottom: Puhu speed-studying on a stack of books, flipping pages so fast they blur, motion lines,
a pencil tucked behind a tuft, a determined grin. Leave empty space under him.
Exact text: puhukoc, bugünün listesi, 2 seans çalış, 40 paragraf çöz, Puhu'ya haftanı kurdur,
Yerini ayır, sonuncusu 10 saniye sürüyor.
```

### S4 · Hangi çalışma tipisin (anket Story 9:16, yön A)

```
S4: Instagram poll Story, 9:16 portrait. Keep the top and bottom 13% free of text.
The frame is split by a diagonal from the lower left up to the upper right, with a thin yellow
stripe on the split line. Above the line: deep navy night with small stars. Below the line:
royal blue day with yellow sparkles.
Top centre: the "puhukoc" logo in white, then centred giant white "Sen hangi" / "çalışma tipisin?".
Night half (left): Puhu in a starry nightcap, wide awake and grinning, raising a glowing mug like
a rock star, a desk lamp beside him; a white pill tilted -4° under him "Gece kuşu".
Day half (right): Puhu leaping up with both wings stretched to a rising sun, beak wide open; a
yellow pill tilted 4° under him "Sabahçı".
Leave a wide empty band in the lower blue part for the poll sticker.
Exact text: puhukoc, Sen hangi, çalışma tipisin?, Gece kuşu, Sabahçı
```

### X1 · X kartı (yatay 16:9, yön A)

```
X1: landscape 16:9 card for X (if you can only make 3:2, add plain blue above and below).
F1 in landscape. Royal blue ground, sparkles. Top-left the "puhukoc" logo in white, top-right yellow pill
"ÇOK YAKINDA". Left half: "YALNIZ" / "ÇALIŞMAK" in giant white, "YASAK!" bigger in yellow tilted
-3° with a yellow underline, a small row "KPSS · YKS · LGS · ALES · DGS", and at the bottom-left
"puhukoc.com" in white with "@puhukoc" in tint.
Right half: the referee Puhu blowing the whistle and pointing at a tilted smartphone; four Puhus
around a study table burst out of the phone screen.
Exact text: puhukoc, ÇOK YAKINDA, YALNIZ, ÇALIŞMAK, YASAK!, KPSS · YKS · LGS · ALES · DGS,
puhukoc.com, @puhukoc
```

### L1 · LinkedIn kartı (yatay 16:9, sakin dil)

```
L1: landscape 16:9 LinkedIn card, calm and clean: no sparkles, no stamps.
Left half: deep navy #0B1636. a small "puhukoc" logo in white at top-left. Headline in white heavy type:
"Sınava birlikte hazırlanmak daha kolay." A short paragraph in light grey-blue: "PuhuKoç; KPSS,
YKS, LGS, ALES ve DGS'ye hazırlananlar için günlük plan, birlikte çalışma masası ve haftalık özet
sunar. Çok yakında." At the bottom-left "puhukoc.com" in white.
Right half: Puhu happily leaping in a warm glowing window at night with a small lantern, curtains
and a flower box, fading softly into the navy on the left.
Exact text: puhukoc, Sınava birlikte hazırlanmak daha kolay., PuhuKoç; KPSS, YKS, LGS, ALES ve
DGS'ye hazırlananlar için günlük plan, birlikte çalışma masası ve haftalık özet sunar. Çok
yakında., puhukoc.com
```

---

## 3. Video (Kling)

Kareler ChatGPT'de **yazısız** üretilir (aynı sohbette, kilit mesajından sonra). Kling'e başlangıç
ve varsa bitiş karesi olarak verilir. Yazılar kurguda eklenir.

**Ortak Kling negatif prompt:**

```
green owl, calm, subtle, slow, floaty, gentle, sleepy, morphing face, changing glasses, extra
limbs, extra characters, people, hands, text, letters, subtitles, watermark, logo, camera shake,
flicker, blur, colour shift, background change
```

### R1 · POV reel (2 klip)

**Klip 1 · Puhu telefonun arkasından fırlar (10 sn)**

Başlangıç karesi (ChatGPT):
```
Video start frame, 9:16 portrait, no text at all. Royal blue ground with soft white sunburst
rays. A giant smartphone fills the bottom 45% of the frame, seen slightly from below, cut off by
the bottom edge; its screen is a flat pure #00FF00 green rectangle, no UI, no reflections. Only
the tips of Puhu's two light-blue head tufts show above the top edge of the phone. The top half
of the frame is empty blue.
```

Bitiş karesi (ChatGPT):
```
Same frame and camera. Puhu has popped up behind the phone: chin resting on the phone's top
edge, glasses pushed down his beak, a long suspicious side-eye at the viewer with one eyebrow
up, one wing tip raised in a "no-no" wag, the other wing gripping the phone. Screen still flat
#00FF00. Top third of the frame still empty blue. No text.
```

Kling prompt:
```
Puhu shoots up from behind the phone like a jack-in-the-box with big squash and stretch,
overshoots high, drops back and lands his chin on the phone's edge. He pushes his glasses down
with one wing, gives the camera a long suspicious side-eye, then wags a wing tip "no-no" in fast
snappy beats and does a quick double head shake. Snappy cartoon timing, anticipation and
overshoot, short holds on the hit poses. Locked camera, the phone does not move, the green
screen stays flat green, the top of the frame stays empty blue.
```

**Klip 2 · Kapanış: telefona sarılma (5 sn)**

Başlangıç karesi (ChatGPT):
```
Video start frame, 9:16 portrait, no text. Royal blue ground. Puhu in the upper-middle of the
frame, mid-jump, hugging a smartphone with both wings, cheek squished against it, eyes shut in a
huge happy grin. The phone screen is flat pure #00FF00. The bottom 45% of the frame is empty
blue.
```

Kling prompt:
```
Puhu squeezes the phone in a big bouncy hug, spins once in the air with the phone, lands with
squash and stretch, then pops one wing up in a cheer and winks at the camera. Energetic,
snappy, short holds. Locked camera, the bottom of the frame stays empty blue, the screen stays
flat green.
```

Kurgu (Remotion ya da CapCut, 30 fps, vuruş 0,5 sn):
- 0,0 sn: "POV:" pop.
- 0,5 sn: "“Son bir video”" çarpar.
- 1,0 sn: "dedin." damgalanır.
- 1,5 sn: Klip 1 başlar.
- 3,0 sn: "Kanka, bu 7. son." balonu titreyerek çıkar.
- 4,5 sn: yeşil ekrana önce video ekranı, sonra PuhuKoç ekranı oturur; "Yerini kap!" altı sarıyla çizilir.
- 6,0 sn: Klip 2 başlar; altta logo, puhukoc.com, @puhukoc, "ÇOK YAKINDA".
- 10 sn'ye kadar bekler.

### R2 · Masa doluyor (10 sn)

Başlangıç karesi (ChatGPT, `apps/web/public/visuals/landing/room-masa.webp` dosyasını ekle):
```
Edit the attached image: remove all four Puhus and keep everything else identical (the round
wooden table, the lamp, the books, the chairs, the light). The four chairs are now empty. 9:16
portrait crop centred on the table, with empty wall above it. No text.
```

Bitiş karesi: aynı dosyanın 9:16 kırpılmış hali (`room-masa.webp`, Puhu'lar yerinde).

Kling prompt:
```
One by one, on a steady beat (about one per second), four Puhus drop into the empty chairs from
above: each falls in with squash and stretch, bounces on the seat and snaps into a pose, ending
exactly as in the end frame. After the fourth lands, all four throw their wings up in a cheer and
the lamp flares brighter for a moment. Fast and rhythmic. Steady push-in camera. The room, table
and lamp do not change.
```

Kurgu: üstte "Masada 0 kişi" çipi her inişte bir artar (1, 2, 3, 4). Dördüncüden sonra
"YALNIZ ÇALIŞMAK YASAK!" ekrana damgalanır, ardından kapanış kartı gelir.

### R3 · Rozet ritmi (5 sn, döngü)

Başlangıç karesi (ChatGPT):
```
Video start frame, 9:16 portrait, no text. Top-down view of cream paper with a faint dot grid.
Puhu stands on the paper holding a giant wooden rubber stamp over his head with both wings, ready
to slam it down, tongue out in focus. The paper is otherwise empty.
```

Kling prompt:
```
Puhu slams the stamp down five times on a strong beat, hopping to a new spot after each hit. Each
hit leaves a plain round navy ring on the paper (no letters inside), and the paper jumps a little
on impact. After the fifth, he blows on the stamp like a smoking gun and strikes a proud pose.
Snappy, rhythmic, exaggerated squash and stretch. Locked top-down camera.
```

Kurgu: halkaların içine sırayla KPSS, YKS, LGS, ALES, DGS rozetleri oturur. Ardından
"Hangisi senin?" ve "Yorumlara yaz." gelir, sonra kapanış kartı.

### Bonus · Canlı postlar (isteğe bağlı, 5 sn döngü)

- **F1 düdük:** başlangıç ve bitiş karesi olarak aynı görseli ver
  (magenta zeminli ham dosya: `art-source.local/social/raw/p1-raw.webp`; ayrılmış PNG şeffaf olduğu için Kling'e uymaz).
  ```
  Puhu blows the whistle in three sharp bursts, cheeks puffing on each one, his pointing wing
  jabbing forward on every blast, then settles back exactly into the starting pose. Snappy
  cartoon timing. Locked camera, magenta background unchanged.
  ```
- **S2 gece şehri:** başlangıç karesi olarak `out/S2/S2.png` dosyasının yazısız ChatGPT
  versiyonunu ver.
  ```
  Window lights blink on one after another across the building. In two windows a Puhu throws
  his wings up in a quick cheer and goes back to studying. Everything else stays still. Locked
  camera.
  ```

---

## 4. Kitte eksik iki karakter görseli (P5, P6)

Bu ikisi gelirse kod kitine de girer: P5 S3'teki okuyan Puhu'nun yerine, P6 R1 kapanışına.
Magenta zemin, ayırıp şeffaf PNG yaparım.

**P5 · Hızlı çalışma**
```
Puhu speed-studying: sitting on a tall wobbly stack of books, flipping the pages of an open book
so fast they blur into a fan, motion lines, two more books flying up behind him, a pencil tucked
behind one tuft, a determined grin. Full body, slightly low 3/4 camera, the character fills 85%
of the frame. Solid flat #FF00FF magenta background, no floor, no shadow on the background.
1:1, 2048×2048. No text.
```

**P6 · Telefona sarılma**
```
High-energy hero moment, mid-jump with squash and stretch: one wing hugs a modern smartphone (no
brand, thin dark bezel, rounded corners) tilted 8° toward the viewer, the other wing thrown up in
a big excited wave, beak wide open in a cheer, feet off the ground. The phone screen is a flat,
pure #00FF00 green rectangle edge to edge inside the bezel: no UI, no text, no reflections.
Slightly low 3/4 camera, full body visible, character and phone fill 85% of the frame. Bright
soft studio light with a gentle rim light. Solid flat #FF00FF magenta background, no floor, no
shadow on the background. 1:1, 2048×2048.
```

**Ortak ChatGPT negatif (gerekirse mesaj sonuna ekle):**
```
Avoid: green owl, other mascots, photorealism, people, hands, extra words, misspelled Turkish
letters, logos, watermarks, drawn buttons or links, cluttered UI, calm or sleepy poses.
```

---

## 5. Premium

Kitte hazır olanlar: PF1, PS1 ve PR1 (Kahraman modu), PF2, PS2 ve PR2 (Gece uçuşu). Altı parça da tamam.

PR1 (2026-11-08) sahibinin Kling klibiyle kuruldu (`public/art/puhu-premium-landing.mp4`): Puhu ışıkta
çömelir, kadrajın tepesinden çıkarken "KAHRAMAN" ve "MODU" damgalanır, kahraman gibi iner (kare sarsılır),
"AÇIK" düğmesi patlar, lacivert zeminde iki satır kayar, kapanış kartında maskeli Puhu ve PREMIUM etiketi.
Klibin sağ altındaki KlingAI yazısı lacivert zeminin altında kalıyor, kırpılmadı. "ÇOK YAKINDA" yazmaz,
çünkü reel profilde kalıcı. Aşağıdaki promptlar klibi yeniden üretmek gerekirse diye duruyor.

**Kilit eki (aynı sohbette, §1'den sonra ikinci mesaj).** Şu dosyayı ekle:
`apps/web/public/mascot/puhu/puhu-premium-hero.png`.

```
From now on, Puhu is PREMIUM PUHU (see the attached hero image): the same Puhu, but instead of
glasses he wears a night-blue #1E2A5A hero domino mask with a thin gold #F2B544 edge and gold
rings around the eye holes. His eyes stay clearly visible through it, with round white glints. A
cape-blue #2F55D4 cape with a starry deep-blue inside and a round gold clasp with a blue star at
the neck. Confident closed-beak smile. No glasses, no crown, no star on the mask.
Reply only "Hazır".
```

### PR1 · Kahraman modu reel (5 sn)

Zemin afişle aynı düz krem `#FAF6F0`, böylece klip PF1'in ışığının içine dikişsiz oturur.

Başlangıç karesi (ChatGPT):
```
Video start frame, 9:16 portrait, no text at all. Flat cream #FAF6F0 ground. A flat pale-gold
#FFE29A light beam shaped like a tall trapezoid, cut from paper, falls from the upper middle of
the frame and widens to the bottom edge: no glow, no gradient. At the bottom of the beam Premium
Puhu crouches low in a big squash, about to launch, cape bunched up behind him, looking up with a
determined grin. Puhu fills the lower 45% of the frame; the upper half is empty cream.
```

Bitiş karesi (ChatGPT):
```
Same frame, same ground and beam. Premium Puhu has just landed in a big hero pose at the bottom
of the beam: chest out, both wings on his hips, feet planted, cape snapping out wide to the left,
confident closed-beak smile at the camera, a few small gold 4-point sparkles at his feet. Same
size and place as in the start frame, lower 45% of the frame. Upper half empty cream. No text.
```

Kling (başlangıç + bitiş karesi, 5 sn, 9:16):
```
Premium Puhu crouches, springs straight up fast and out of the top of the frame, drops back down
and lands hard in a hero pose at the bottom of the light beam: wings on hips, chest out, cape
snapping wide, a squash on landing, a burst of small gold 4-point sparkles at his feet. Snappy,
exaggerated cartoon motion. Static camera. The cream ground and the paper light beam never move
or change colour.
```

Negatif: §3'teki ortak listeye şunları ekle: `glasses, crown, star on the mask, glow, gradient`.

---

## 6. Tanıtım videosu · Ekrana dalış (T1, 62 sn, 9:16)

Storyboard: sosyal tuvalde "Tanıtım videosu · Ekrana dalış" satırı (17 kare). Tasarım:
[docs/plans/2026-11-08-promo-video-design.md](../../docs/plans/2026-11-08-promo-video-design.md).

Üretilecek dört klip var: K1, K3, K4, K5. K2 çıktı: 7. sahnede uygulamanın kendi sihir döngüsü
oynar (`apps/web/public/mascot/puhu/motion/puhu-hero-magic-loop.mp4`). Diğer sahneler yeni üretim istemez:
- Meslek albümü, hedef panosu ve Yanlış Defterim kodla kurulur. Albümde uygulamanın meslek
  Puhu'ları var (`apps/web/public/mascot/career-3d/`).
- Sandık için uygulamanın hazır klibi var: `apps/web/public/visuals/chest/chest-open-tall.mp4`.
- Lakap kartında uygulamanın karakter klibi oynar: `apps/web/public/video/character/nebula-diver.mp4`.

Klipler **tam ekran** oynar: kamera odaya dalar, oda bütün ekranı kaplar. Yazılar odanın üst
üçte birindeki sade duvara gelir; bu yüzden K3–K5'in başlangıç karelerinde üst üçte bir boş duvar.
KlingAI yazısını kurguda ben atarım: klibi %6 büyütürüm, alttaki %5'lik şerit kadrajdan çıkar.

| Klip | Filmde | Ekranda kalma | En-boy | Başlangıç karesi |
|---|---|---|---|---|
| K1 · Puhu telefondan fırlar | 0:02,5 | 3,5 sn | 9:16 | ChatGPT (aşağıda) |
| K3 · Puhu'nun odası | 0:28 | 4 sn | 9:16 | ChatGPT dikey kare (aşağıda) |
| K4 · Masa | 0:36 | 4 sn | 9:16 | ChatGPT dikey kare (aşağıda) |
| K5 · Senin odan | 0:56,5 | 2 sn (atlamalı kesim) | 9:16 | ChatGPT dikey kare (aşağıda) |

`kling-start/` = `art-source.local/social/promo/kling-start/`. Oradaki yatay K3–K5 kareleri
(landing'in oda görselleri, sıcak duvara oturtulmuş) artık Kling'e gitmez: dikey karelerin
referansıdır. Dikey kareler gelene kadar kurguda kaba taslaklar durur
(`art-source.local/social/promo/tall-mock/`).

### K3–K5 dikey başlangıç kareleri (ChatGPT)

§1 kilit mesajından sonra aynı sohbette, o klibin eski yatay karesini ekle ve şunu yaz;
`<SAHNE>` yerine aşağıdaki satırı koy:
```
Recompose the attached image as a tall portrait frame for a vertical video. Keep the same world,
render style, warm lamp light and colours, and the same Puhu: white fluffy owl, round navy
glasses, light-blue ear tufts and wing tips, blue heart on the chest, same outfit, no bow tie (the bow tie is only for
the host Puhu in K1). Layout from top
to bottom: the top 30% is a plain warm wall in one flat colour and stays empty, with no shelves,
frames, windows, lamps or plants on it. The bottom 70% is the scene, seen closer than in the
attached image so that it fills the width. Keep Puhu and every prop inside the middle 80% of the
width; the bottom edge is plain desk or floor. Scene: <SAHNE>. No text, letters or numbers
anywhere.
```
- **K3:** `Puhu sits behind his desk with an open book, close and big, his body filling the middle of the frame, his head at about 45% of the frame height. A brass desk lamp on the left, a pencil cup on the right, a short stack of books at the front. Behind him, just below the plain wall, a low bookshelf and a plant`
- **K4:** `four Puhus study around one round wooden table seen from slightly above, close, the table and the four of them filling the width. From left to right: green beanie, blue cape, red scarf, no outfit. The two outer Puhus sit a little nearer the camera, the two middle ones a little further back, all facing the camera over open books. A brass lamp stands in the middle of the table between the two middle Puhus; books, three small hourglasses and a plant pot lie on the table`
- **K5:** `the same study room, empty, with nobody in it. A wooden desk across the lower third with a closed laptop in the middle, a mug of pencils and a lit brass desk lamp on the left, a stack of books on the right and an empty upholstered chair behind the desk. A plant and a small bookshelf at the sides, below the plain wall. A clear space behind the desk`

ChatGPT kareyi 2:3 verir. Bana ver: iki yandan kırpıp 9:16 yaparım ve
`kling-start/K3-puhu-start-9x16.png` … `K5-senin-start-9x16.png` diye kaydederim. Kling'e bu
dosyaları ver. Puhu modelden çıkarsa (gözlük, kulak tüyleri, renk) kareyi at, yeniden üret.

### AI görüntüsünden nasıl kaçıyoruz

AI videoyu ucuz gösteren şeyler belli: eriyen kanatlar, kendiliğinden beliren eşyalar, havada
uçuşan parıltılar, yavaş çekimde süzülen kamera, şekil değiştiren yüz. Promptlar bunlara göre
yazıldı.

1. **Tek gag, net son poz.** Her prompt saniye saniye bölündü. Kling süreleri birebir tutmaz ama
   sırayı tutar. Hızı ve kesimi ben kurguda ayarlarım.
2. **Sadece karede olan hareket eder.** K3'teki kitap ve K4'teki kum saatleri
   masada zaten var. Yeni nesne istemek eriyen görüntünün bir numaralı sebebi.
3. **Kamera kilitli.** Kayan, dönen, "sinematik" kamera yok. Dalışları ben kurguda yaparım.
4. **Işık sabit.** Parlayan toz, bokeh, lens parlaması, ışık huzmesi, büyü tozu yok. Sıcak ışık
   başlangıç karesindeki gibi kalır.
5. **Boş sıfat yok.** "epic, magical, stunning, cinematic, vibrant, 8k, masterpiece" gibi
   kelimeler yazmıyoruz. Hareket fiille anlatılır: fırlar, çarpar, savurur, fırlatır.
6. **Çizgi film zamanlaması.** Önce hazırlık (eğilir, çömelir), sonra hızlı hareket, hedefi biraz
   aşma, kısa duruş. Yavaş çekim yok.

**Deneme seçerken:** 2–3 deneme üret, sonra şunlara bak. Birinde bile sorun varsa o denemeyi at.
- Gözlük, kafa tüyleri ve kanat uçları baştan sona aynı mı?
- Eşyalar yerinde mi, yeni bir şey belirdi mi?
- Puhu'nun yüzü kayıyor mu?
- Filmde görünecek bölümde (tabloda "ekranda kalma") enerji var mı?

### Ayarlar

- Image to Video, Professional, 5 sn, Relevance (cfg) 0.6. Puhu yine sakin kalırsa prompta
  `even faster, more exaggerated, bigger squash and stretch` ekle.
- Bitiş karesi isteğe bağlı. Kling sırayı karıştırır ya da Puhu dağılırsa, bitiş karesi
  destekleyen modda başlangıç + bitiş karesi ver (bitiş kareleri aşağıda).
- En-boy başlangıç karesinden gelir: dört klip de 9:16.
- Klipleri `art-source.local/social/gen/promo-K1.mp4` … `promo-K5.mp4` diye kaydet.

**Ortak negatif (K1–K5):**
```
green owl, different owl, owl without glasses, glasses changing shape, extra owls, extra wings,
extra limbs, morphing, melting, warping, face changing, objects appearing, objects disappearing,
slow motion, floating, drifting camera, camera move, zoom, pan, orbit, dolly, handheld, shake,
glowing particles, sparkles, bokeh, lens flare, light rays, magic dust, smoke, confetti, motion
trails, colour shift, lighting change, text, letters, numbers, watermark, logo, people, hands
```

### Müzik (ben seçerim ve keserim)

Telifsiz ve sosyal medyada kullanılabilir lisanslı bir parça.
- **His:** zıplayan, şakacı bir funk-pop. Bakır nefesli vuruşlar ve el çırpma olsun. Kurumsal
  ukulele, "ilham verici" piyano ve lo-fi olmasın.
- **Tempo ve süre:** 118–124 BPM, 62 sn.
- **Yapı:** ilk 6 sn hafif bir giriş (tık tık eden hi-hat yeter, bildirim sesine yer kalsın).
  Asıl vuruş ("drop") 0:08'de, meslek albümünün çıkartmaları o vuruşta yapışmaya başlar.
  PLANLA 0:12'deki bir sonraki sert vuruşta çarpar. 0:44'te davul çekilir ya da yarım tempoya iner
  (gece, sandık). 0:48'den sonra yükselir (lakap kartı döner). 0:58,5'ten itibaren
  üç sert vuruş gelir (PLANLA. ODAKLAN. PUHU İLE.). Sonu temiz bir kapanış vuruşuyla biter.
- Parçada bu kırılma yoksa ben keserek oluştururum. Tempo farklıysa vuruş ızgarasını parçaya göre
  kurarım.
- Kaynak: Pixabay (Pixabay Content License). Sanatçısı Content ID talebi açmadığını yazan parçalar
  seçilir, yoksa Instagram/TikTok telif uyarısı verebilir. Seçilen: NickPanek "Dirty Igloo" (318363,
  105 BPM). Bölümleri filme göre dizildi, perdesi bozulmadan 120 BPM'e hızlandırıldı.
- Kesilen parça `art-source.local/social/gen/promo-music.mp3` olarak kaydedilir.

**Efektler (ben seçerim, sen onaylarsın):**
- 02: bildirim sesi
- 03: dalışta "vuuş" ve jöle "blop"
- büyük kelimeler: tok bir damga sesi
- çipler: "pop"
- 05: çıkartmalar "şap" ×5 (ikişer ikişer), Kodcu çıkartması kopunca "cırt"
- 06: panoda raptiye "tık"
- 07: asanın her değişinde parlak bir "tıring", kartlar "pop"
- 08: kartlar "fış"
- 09: odalar kayarken "vuş" ×3, kadran "klik"
- 11: kâğıt "fırt", defter kapağı "pat", sayfalar "fış" ×3 ve ÇÖZDÜM damgası
- 12: çak bir beşlik "şap"
- 14: yazılar "pop", pencereye dalışta "vuuş", sandık kapağı gıcırtısı ve parlak bir çan
- 15: kart dönüşü ("fıt" ×3) ve "tak"
- 16: pencere ışığı "klik", dalışta "vuuş"

### K1 · Puhu telefondan fırlar (5 sn, 9:16)

Puhu başlangıç karesinde zaten olsun: Kling Puhu'yu sıfırdan çizerse başka bir baykuş çıkıyor.

Başlangıç karesi (ChatGPT, §1 kilit mesajından sonra aynı sohbette;
`art-source.local/social/raw/phone-raw.png` ve `apps/web/public/mascot/puhu/puhu-host.png` dosyalarını
ekle; Puhu sunucu Puhu olsun, papyonuyla):
```
Video start frame, portrait, no text at all. Flat deep night-navy #0D0E25 ground, nothing else
on it. The chunky navy toy smartphone from the attached reference stands upright in the lower
middle of the frame, tilted 6 degrees to the right, its bottom cut off by the frame edge; it fills
the bottom 55% of the frame. Its screen is a flat pale blue #DCE6FF with no UI and no reflections.
Puhu is the host Puhu from the second reference, with his shiny blue-purple bow tie. He is
climbing OUT of the screen as if it were a window: his head, chest and both wings are
already out and leaning toward the viewer, his body disappears into the screen at the waist.
Both wing tips grip the phone's top corners. Beak wide open in an excited "psst!", eyebrows up,
glasses knocked slightly crooked. The top 30% of the frame is empty navy.
```
ChatGPT kareyi 2:3 verir. Önce bana ver, gece zeminini 9:16'ya uzatayım, sonra Kling'e ver.

Bitiş karesi (isteğe bağlı, aynı sohbette):
```
Same frame and camera. Puhu has dived head-first back into the screen: only his two tiny orange
feet stick out of it, kicking. Three flat white rings spread across the pale-blue screen around
his feet, like ripples on jelly. Nothing else changes. No text.
```

Kling:
```
0-1 s: Puhu heaves himself out of the phone screen with a big stretch and pops toward the camera
until his face nearly fills the frame, glasses bouncing on his beak.
1-2.5 s: He beckons twice with one wing, fast and big, "come on!", eyebrows jumping on each beckon.
2.5-3 s: He crouches back against the screen, cheeks puffed, ready.
3-4 s: He spins round and dives head-first back into the screen like a swimmer into a pool; the
screen surface wobbles like jelly around him.
4-5 s: Only his feet stick out, kick twice and get sucked in with a pop. The wobble settles.
Cartoon timing: fast moves, overshoot, short holds on the hit poses. Locked camera. The phone
never moves or changes shape; the navy ground stays flat and empty.
```

### K3 · Puhu'nun odası (5 sn, 9:16) · başlangıç: `kling-start/K3-puhu-start-9x16.png`

Kitap kapanırken içinden fırlayıp deftere uçan soru kâğıdını kurguda ben eklerim.

```
Puhu sits behind the open book at his desk.
0-0.5 s: He narrows his eyes, pushes his glasses up with one wing tip and leans in.
0.5-3 s: Turbo study: his head snaps left and right along the lines in fast bursts, the pages flip
in a blur under his wing, he grabs a pencil from the cup and scribbles at lightning speed, his
head tufts flapping like flags.
3-3.5 s: He slams the book shut with both wings; the desk jolts and his glasses jump.
3.5-5 s: Both wings shoot up, beak wide open in a cheer, he bounces twice in his seat. Hold.
Cartoon timing: fast, snappy, big squash and stretch, short holds. Locked camera. The lamp, the
shelf and the warm light stay exactly the same; the plain wall in the top third stays empty.
```

### K4 · Masa (5 sn, 9:16) · başlangıç: `kling-start/K4-masa-start-9x16.png`

Çak bir beşlik yan yana oturan ikililerde olur; ortadaki iki Puhu'nun arasında lamba var.

```
Four Puhus study around the round table. From left to right: green beanie, blue cape, red scarf,
no outfit.
0-2 s: A stadium wave from left to right, one Puhu every half second: each pops up from his book
with both wings thrown up and beak open, then drops back down as the next one pops up.
2-3 s: All four look up at the same moment and grin at each other.
3-4 s: Two high-fives at the same moment: the beanie Puhu with the caped Puhu on the left, the
scarf Puhu with the last Puhu on the right. Wings smack together.
4-5 s: All four snap back to their books in focused, happy poses. Hold.
Each Puhu keeps his own hat, cape or scarf and his glasses. Cartoon timing, snappy, short holds.
Locked camera. The table, the lamp, the hourglasses and the books stay where they are; the
plain wall in the top third stays empty.
```

Negatif ek: `more than four owls, owls swapping hats or scarves`.

### K5 · Senin odan (5 sn, 9:16) · başlangıç: `kling-start/K5-senin-start-9x16.png`

Cepheden pencereye dalışı kurguda yaparım; klip ışık açıkken başlar. Başlangıçta Puhu yok, o
yüzden burada bitiş karesi şart (aşağıda): Kling Puhu'yu oradan alır, yoksa başka bir baykuş çizer.

```
The study room is empty, the lamp is on.
0-1 s: Puhu springs up from behind the desk and lands on it next to the closed laptop with a big
squash; the pencils in the mug rattle.
1-2 s: He spins to face the camera and waves both wings hard, beak wide open.
2-3.5 s: He hops onto the chair's armrest, pats the backrest twice with one wing and nudges the
chair a little toward the viewer.
3.5-5 s: He points both wings straight at the viewer with a huge grin, "this seat is yours". Hold.
Cartoon timing, anticipation and overshoot, short holds. Locked camera. The laptop stays closed;
the lamp light, the plant and the shelf stay exactly the same; the plain wall in the top third
stays empty.
```

### Bitiş kareleri K3–K5 (isteğe bağlı, ChatGPT)

Dikey başlangıç karesini (`-9x16.png`) ekle ve şunu yaz; `<SON POZ>` yerine aşağıdaki satırı koy.
K5 için bu kare şart, diğerlerinde isteğe bağlı:
```
Edit the attached image and keep everything identical: the room, the light, every object, the
colours and Puhu's glasses and outfit. Only change: <SON POZ>. No text anywhere.
```
- **K3:** `the book is closed and Puhu has both wings thrown up in a cheer, beak wide open`
- **K4:** `all four Puhus are reading their books again, focused and smiling, same seats and outfits`
- **K5:** `Puhu stands on the desk next to the closed laptop, pointing both wings straight at the viewer with a huge grin`

ChatGPT düzenlerken renkleri ya da ışığı kaydırırsa bitiş karesini kullanma. Kling iki kare
arasında renk geçişi yapar ve oda kayar.
