# Haftalık sandık · "Masa lambası" açılış sahnesi

Tarih: 2026-11-01. Durum: kullanıcı onayladı (2026-11-01, A · Masa lambası). Arka uç dilimi yazıldı (2026-11-01, plan `docs/superpowers/plans/2026-11-01-weekly-chest-backend.md`); web dilimi görselleri bekliyor.
Tuval: https://claude.ai/artifact/1EdSa1LKCQ3JffZwHFFgTd

## Context

Haftalık sandık, `weekly.effort-allowance` görevidir (`apps/api/src/modules/economy/domain/quest.catalog.ts`):
ISO haftada `economy.quest.weekly_allowance_active_days_target` (varsayılan 5) aktif gün (≥1 biten odak
seansı veya ≥1 biten plan görevi) → `economy.quest.weekly_allowance_reward_coin` (varsayılan 15) Coin,
haftada bir kez, arka uç kendiliğinden yazar. Ücretsiz kullanıcının tek tekrarlı Coin kaynağıdır.

Bugünkü hâli:
- Panelde "Bugün" yolunun sonunda çizgi ikonlu bir durak (`today-path.tsx`, `role="img"`, dokunulamaz),
  Günlük görevler kartında bir satır (`daily-quests-card.tsx`), görev penceresinde "Bu hafta 5 gün aktif ol".
- "Açılış" anı yok: Coin, `EconomySync` üzerinden her ödülde çıkan genel `CoinCelebration` penceresiyle gelir.
- Deneme sürümünde `economy.enabled=false`: yoldaki sandık gizlenir, kart satırı "Haftalık sandık açıldı"
  der ama içinden bir şey çıkmaz. Hoş geldin ekranı "haftanın sandığını aç" diye söz verir.
- DESIGN.md backlog'unda "Weekly chest art (soft-3D, closed/open)" açık.

## Hedefler
- Haftanın emeğini görünür kılan, sandığa özel, dokunarak açılan bir an.
- Ekonomi kapalıyken de anlamlı: sandığın içinde her zaman haftanın emeği var, Coin yalnızca açıkken.
- Sandık kendini anlatsın: hangi günler sayıldı, kaç gün kaldı, içinde ne var.

## Hedef dışı
- Ödül tutarı, hedef gün sayısı, ekonomi kuralları (değişmez; config'den gelmeye devam eder).
- UTC gün sınırı (00:00–03:00 TR önceki güne yazılıyor). Bilinen MVP notu, ayrı konu.
- Haftalık özet (Wrapped) ile birleştirme, paylaşım, mobil uygulama.

## Anti-hedefler (çalışsa bile başarısızlık sayılır)
- Şans mekaniği, rastgele içerik, "yükselt" teklifi. İçerik her zaman belli: emek + varsa sabit Coin.
- Genel coin penceresinin bu ödül için de çıkması (çift kutlama).
- Glow + parçacık + cam kart "AI slop" görünümü. Işık sahnenin kendi lambasından gelir; not kâğıttır.
- Öğrenciyi seansın ortasında tam ekran sahneyle yakalamak.

## Kullanıcının verdiği kararlar (2026-11-01)
1. Kapsam B: sandığa özel açılış anı. Küçük düzeltmeler (dokunulabilir sandık, bilgi penceresi, tek isim) dahil.
2. Ekonomi kapalı: sandık yine açılır, içinden haftanın emeği çıkar. Coin yalnızca ekonomi açıkken eklenir.
3. Tetikleme: dokununca. Panelde sandık "Hazır!" olur ve parlar; başka sayfadaysa küçük bildirim.
4. Görsel: en iyi kalite. ChatGPT görselleri + Kling videosu, prompt'lar aşağıda, kullanıcı üretir.
5. Yön: A · Masa lambası. Sandık lambanın altında Puhu'nun masasında; Puhu kapağı açar.
6. Açılmayan sandık bir hafta bekler: Pazartesi panelde önce "Geçen haftanın sandığı" durur, açılınca
   yeni haftanın sandığı başlar. Daha eskisi beklemez.

## Durumlar

| Durum | Ne zaman | Panel yolu | Görevler kartı satırı | Dokununca |
|---|---|---|---|---|
| `PROGRESS` | hedefe ulaşılmadı | sandık + pip'ler (●●●○○) | "Haftalık sandık" · pip'ler · "{left} gün kaldı" · Coin (açıksa) | Bilgi penceresi |
| `READY` | hedef tuttu, açılmadı | büyük düğüm, "Hazır!" etiketi, hafif zıplama | "{target} gün tamam!" + **Aç** | Açılış sahnesi |
| `READY` (devreden) | geçen hafta tuttu, açılmadı | aynı, başlık "Geçen haftanın sandığı" | aynı | Açılış sahnesi (geçen haftanın notu) |
| `OPENED` | açıldı | açık sandık, "Açıldı · {reward} Coin" / "Açıldı" | "Bu haftanın sandığı açıldı" + **Özeti gör** | Not, animasyonsuz |

Ekonomi kapalıyken tüm durumlar aynı, sadece Coin satırları ve tutarlar yok.
Coin earning cap'e takıldıysa (`rewardPendingMessage`): sahne notu gösterir, Coin satırı yerine bekleyen
mesaj; hak sonra yatınca normal bildirim akışı yalnızca bu durumda genel pencereyi kullanabilir.

## Sahne (A · Masa lambası)

Tam ekran, kapsamlı sıcak gece teması (ışık/karanlık çerezinden bağımsız; başarı sahnesi gibi DESIGN.md §9
istisnası). Mobil: üstte 1:1 sahne görseli/video, altında masa şeridi, altında metin ve butonlar.
Masaüstü: aynı sütun ortada (`max-w` ~480 px), yanlar koyu sıcak zemin.

Akış:
1. **Hazır** (`desk-chest-closed` görseli, isteğe bağlı bekleme döngüsü): sandığın pirinç şeridinde
   hedef sayısı kadar lamba (kod katmanı), hepsi yanık. Başlık, alt cümle, **Sandığı aç**, **Sonra**.
   Sandığa dokunmak da açar.
2. **Lambalar kilide akar** (kod, ~400 ms): lambalar kilit plakasına (gözlük) doğru küçülerek akar.
3. **Açılış** (Kling klibi, 5 sn, dokununca atlanır): Puhu kapağı açar, ışık yüzüne vurur.
4. **İçinde**: klibin son karesi kararır (opacity ~0.25, blur), bantlı kâğıt not yukarı süzülür ve hafif
   eğik yerine oturur. Ekonomi açıksa altında Coin (mevcut 3D coin + `playCoinChime`) ve "+{reward} Coin".
   Ekonomi kapalıysa Puhu (küçük) + konuşma balonu. **Devam edelim** kapatır.

Notun satırları (0 olanlar yazılmaz): "{days} gün masadaydın", "{sessions} odak seansı",
"{tasks} plan görevi", "{focus} odak" (`3 sa 20 dk` biçimi). Altta gözlük karalaması + "Puhu" imzası.

Azaltılmış hareket: video yok; kapalı → açık görsel çapraz geçiş (200 ms), not ve Coin anında görünür.
Erişilebilirlik: `role="dialog"`, odak tuzağı, Escape ve **Sonra** kapatır (durum `READY` kalır),
video `aria-hidden`, not metni gerçek metin, Coin tutarı ekran okuyucuya bir kez okunur.

## Metinler (Puhu sesi kutlamada, companion açıklamada; em dash yok)

| Yer | TR | EN |
|---|---|---|
| Yol başlığı | Haftalık sandık | Weekly chest |
| Yol etiketi (hazır) | Hazır! | Ready! |
| Yol başlığı (hazır) | Sandığın hazır! | Your chest is ready! |
| Yol alt (hazır) | Dokun, açalım | Tap to open |
| Yol başlığı (devreden) | Geçen haftanın sandığı | Last week's chest |
| Yol alt (açıldı) | Açıldı · {reward} Coin / Açıldı | Opened · {reward} Coin / Opened |
| Kart (sürüyor) | {left} gün kaldı | {left} days to go |
| Kart (ekonomi kapalı) | İçinde haftanın özeti var | Your week's story is inside |
| Kart (hazır) | {target} gün tamam! / Sandığın seni bekliyor. / Aç | {target} days done! / Your chest is waiting. / Open |
| Kart (açıldı) | Bu haftanın sandığı açıldı / Pazartesi yenisi geliyor / Özeti gör | This week's chest is open / A new one comes Monday / See the story |
| Pencere başlığı | Haftalık sandık | Weekly chest |
| Pencere başlık cümlesi | {left} gün daha, sandık açılıyor! | {left} more days and it opens! |
| Pencere kural | Bir gün sayılır: 1 odak seansı ya da 1 biten plan görevi. | A day counts with 1 focus session or 1 finished plan task. |
| Pencere "İçinde" | Haftanın özeti · Seansların, görevlerin, odak süren | Your week's story · Your sessions, tasks and focus time |
| Pencere Coin | {reward} Coin (+ canlı kullanım satırı, ör. "3 Puhu sohbeti eder", yalnız o kullanım açıksa) | {reward} Coin |
| Pencere alt | Her pazartesi yeni sandık. | A new chest every Monday. |
| Bildirim | Haftalık sandığın hazır! / {target} gün tamam. / Aç | Your weekly chest is ready! / {target} days done. / Open |
| Sahne başlık | {days} gün masadaydın! (devreden: Geçen hafta {days} gün masadaydın!) | You were at your desk {days} days! |
| Sahne alt | Sandık senin. Hadi açalım! | The chest is yours. Let's open it! |
| Sahne butonlar | Sandığı aç / Sonra / Devam edelim | Open the chest / Later / Let's go on |
| Not başlığı | Bu haftanın emeği (devreden: Geçen haftanın emeği) | This week's effort |
| Coin alt | Hesabına geçti. | It's in your account. |
| Ekonomi kapalı balon | Pazartesi yeni sandık geliyor! | A new chest comes Monday! |

Görev penceresinde başlık aynı kalır ("Bu hafta {target} gün aktif ol"), rozet "Ritim" → "Sandık".
Hoş geldin ekranındaki "haftanın sandığını aç" artık doğru, değişmez.

## Varlıklar (kullanıcı üretir, ben işlerim)

| Dosya | Kaynak | Kullanım |
|---|---|---|
| `chest-closed.png` | ChatGPT #1, şeffaf | Panel düğümü, kart satırı, bilgi penceresi (lamba katmanıyla) |
| `chest-open.png` | ChatGPT #2, şeffaf | Açılmış düğüm ve satır |
| `desk-chest-closed.png` | ChatGPT #3, 1:1 | Sahne "Hazır" karesi, klibin başlangıcı, poster |
| `desk-chest-open.png` | ChatGPT #4, 1:1 | Klibin bitişi, azaltılmış hareket karesi, "İçinde" arka planı |
| `chest-open.mp4` | Kling #5 | Açılış klibi |
| `chest-idle.mp4` (isteğe bağlı) | Kling #6 | "Hazır" ekranında sessiz döngü |

**Gelen medya (2026-11-01):** 1–4 ChatGPT (1254², 1 ve 2 şeffaf) + Kling 4.0 klibi (940², 24 fps, 5.04 sn).
Kling ilk kareyi 3. görselden, son kareyi 4. görselden biraz farklı çiziyor (Puhu daha büyük, poz farklı).
Bu yüzden sahnenin "Hazır" ve "Açıldı" kareleri ChatGPT görsellerinden değil, **klibin kendi ilk ve son
karesinden** çıkarılır; geçişte sıçrama olmaz. 3 ve 4 yedek kalır. Filigran "KlingAI 4.0" sağ altta
(x 748–912, y 889–919): üstten 885 satır + yatayda ortalanmış 885² kırp, 720²'ye indir. Açık sandığın
gövdesi kapalıya göre ~%2.6 aşağıda; panel geçişinde kodla hizalanır. Bekleme döngüsü yapılacaksa
başlangıç/bitiş karesi klibin filigransız ilk karesidir.

İşleme: Kling filigranı WinRT ile kırpılır (bkz. hafıza notu), 720² H.264 ~2 MB, PNG'ler webp/avif,
düğüm için 128/256 px türevler. Konum: `apps/web/public/visuals/chest/`. Lamba katmanının koordinatları
(`#3`teki pirinç şeridin yüzde konumu) görseller gelince ölçülür ve tek sabitte tutulur.

## Promptlar

Ek olarak her ChatGPT isteğine `apps/web/public/visuals/landing/room-puhu.webp` (stil ve sahne) ve
`apps/web/public/mascot/puhu/motion/rest.png` (karakter) eklenir.

### 1. Kapalı sandık (ChatGPT, şeffaf)
```
Create a single object in the exact soft 3D style of the attached reference images: cozy miniature-diorama look, matte clay and plush materials, soft rounded shapes, warm amber lamp light with gentle subsurface glow.
Object: a small wooden study treasure chest, seen from the front and slightly above (about 15 degrees). Warm walnut wood with soft rounded planks, a rounded domed lid, two brass bands on the left and right that wrap over the lid and down the body. The brass lock plate in the center, right where the lid meets the body, is shaped like a pair of round eyeglasses: two round rings joined by a small bridge, the rings painted soft blue (#2F63B8), exactly like the owl's glasses in the reference. Across the lower front of the body runs one smooth, plain horizontal brass strip. The strip must stay completely blank: no studs, gems, lights, holes or decorations on it.
The chest is closed. Friendly, inviting, slightly chunky proportions, like a well-loved toy.
Transparent background (PNG with alpha). No floor, no shadow, no text, no other objects. Object centered, filling about 70% of a square 2048x2048 frame.
```

### 2. Açık sandık (ChatGPT, şeffaf, 1. görsel ekli)
```
Using the attached chest as the exact reference (same wood, brass bands, glasses-shaped lock plate, blank brass strip), show the same chest with its lid swung fully open backwards. Warm golden light glows from inside and spills softly upward. A folded cream paper note and a single gold coin are just visible inside, nothing else.
Keep exactly the same camera angle, scale and position of the chest body as the reference, so the two images line up perfectly when crossfaded. Only the lid and the light change.
Transparent background (PNG with alpha), no floor, no shadow, no text. Square 2048x2048.
```

### 3. Masada kapalı sandık (ChatGPT, 1:1; `room-puhu.webp` + 1. görsel ekli)
```
Recreate the attached room scene exactly: the same white fluffy owl with round blue glasses, blue ear tufts and a blue heart on its chest, the same brass desk lamp on the left, the same cozy bookshelf room, the same warm night lighting. Square 1:1, 2048x2048.
One change: the open book on the desk in front of the owl is replaced by the attached wooden chest, closed, standing on the desk directly in front of the owl, centered horizontally, about 40% of the frame width, its front facing the viewer. The lamp light falls on the chest's lid.
The owl is bursting with excitement: leaning eagerly over the chest, up on its toes, both wings spread wide on the desk to the left and right of the chest as if about to grab the lid, eyes huge and sparkling behind its glasses, beak open in an eager grin, ear tufts standing straight up. The owl stays behind the chest and never covers its front.
The chest's blank brass strip must be fully visible and unobstructed. The bottom 12% of the frame is plain wooden desk surface. No text, no extra objects.
```

### 4. Masada açık sandık (ChatGPT, 1:1; 3. görsel + 2. görsel ekli)
```
Using the first attached image as the exact reference, keep the same camera, composition, room, lamp and the same position and size of the owl and the chest. Changes only:
The chest lid (as in the second attached image) is now swung fully open. Warm golden light pours up out of the chest, lighting the owl's face from below and glinting on its round glasses. The owl is in a big triumphant celebration pose: body stretched tall, both wings thrown high above its head, beak wide open in a huge joyful smile, eyes squeezed into happy crescents behind its glasses, ear tufts flung up. The corner of a folded cream paper note peeks out of the chest. Gold sparkles and tiny star bursts pop in the air above the chest.
Square 1:1, 2048x2048. No text.
```

### 5. Açılış klibi (Kling; başlangıç 3. görsel, bitiş 4. görsel; 5 sn, 1:1, Professional, yüksek prompt bağlılığı)
```
High-energy, cartoony 3D mascot animation with snappy cartoon timing: fast moves, big exaggerated poses, strong squash and stretch, quick anticipation, springy overshoot and a short hold on each key pose. Joyful, playful, full of personality. Punchy and lively, never slow or floaty.
0.0-0.8s: the owl bounces on its toes twice with excitement, drumming both wings on the desk beside the chest, ear tufts springing up and down.
0.8-1.6s: it squashes down low, then springs up and flings the lid open with both wings in one fast snap; the lid swings back and wobbles with a springy overshoot.
1.6-2.4s: a burst of warm golden light pops out of the chest with a puff of gold sparkles and tiny star bursts, lighting the owl's face from below and glinting on its glasses; the owl's eyes go huge and its whole body stretches tall in surprise.
2.4-4.0s: the owl does one big happy jump straight up, wings thrown high, stretching in the air and squashing on landing, ear tufts flopping.
4.0-5.0s: it snaps into the final pose, wings high in triumph, beaming, a quick happy wiggle, then holds.
The camera is completely static. The chest body stays fixed on the desk and keeps its shape; only the lid moves. The owl stays inside the frame and behind the chest. The room, lamp and bookshelf stay exactly the same. No text.
```
Negatif:
```
slow motion, slow, sluggish, calm, gentle, subtle movement, low energy, hesitant, floaty, stiff, realistic motion, camera movement, zoom, pan, chest moving, chest deforming, lid detaching, extra chests, coins flying everywhere, background change, text, watermark, logo, extra characters, extra limbs, extra wings, morphing, melting, deformed wings, deformed face, deformed glasses, glasses falling off, green owl, flicker
```
Not: promptta marka adı yok. Puhu da bir baykuş; "Duolingo" yazmak yeşil Duo benzeri bir karakter üretebilir.
Enerjiyi duraklar (3. ve 4. görseldeki pozlar) ve hareket kelimeleri taşır. 2–3 varyasyon üretip en canlısını seç.

### 6. Bekleme döngüsü (isteğe bağlı; Kling, 3. görsel hem başlangıç hem bitiş, 5 sn, 1:1)
```
Lively, bouncy idle loop with snappy cartoon timing. The owl bounces on its toes with excitement, does a quick double blink, wiggles its ear tufts, drums both wings on the desk beside the chest twice, then looks up at the viewer with an eager grin as if saying "open it!", and looks back at the chest. The lamp light pulses softly. The chest stays closed and in place; its lid never opens. Static camera. Seamless loop: the last frame exactly matches the first frame.
```

### 7–9. Telefon için dikey set (9:16, 2026-11-01 tur 3)

Kare set masaüstünde kalır; telefonda sahne bu dikey setle ekranı boydan boya doldurur, başlık ve
düğmeler alttaki karanlık masa önüne biner. Her ChatGPT isteğine `room-puhu.webp` ve `rest.png` de eklenir.

**7. Masada kapalı sandık, dikey** (ChatGPT; `public/visuals/chest/desk-chest-closed.webp` ekli)
```
Extend the attached square scene into a tall portrait image, 9:16, 1152x2048. Keep the owl, its round blue glasses, blue ear tufts and blue heart, the wooden chest with its glasses-shaped lock plate and blank brass strip, the brass desk lamp and the cozy bookshelf room exactly as they are: same soft 3D style, same materials, same warm night lighting. Do not redraw or restyle them.
Frame it for a phone screen. Zoom in slightly so the owl and the chest are a little larger than in the reference: the owl's spread wings almost reach the left and right edges, the lamp head stays visible in the upper left, and nothing important is cut by the side edges.
Top 20% of the frame: more of the room above the owl, shelves with books continuing upward, the starry night window on the left, a few hanging plants, warm lamp glow. Atmosphere only.
Middle, from about 20% to 68% of the height: the owl leaning eagerly over the closed chest, exactly the pose of the reference. The chest's blank brass strip is fully visible and unobstructed.
Bottom 32%: the front of the wooden desk continues down as plain warm wood that fades smoothly into deep warm shadow toward the bottom edge, so white text and buttons can sit on it. No objects, books or papers there.
No text, no extra characters, no extra objects.
```

**8. Masada açık sandık, dikey** (ChatGPT; 7. görsel + `public/visuals/chest/desk-chest-open.webp` ekli)
```
Using the first attached image as the exact reference, keep the same 9:16 frame, camera, composition, room, lamp, and the same position and size of the owl and the chest. Changes only, taken from the second attached image:
The chest lid is now swung fully open. Warm golden light pours up out of the chest, lighting the owl's face from below and glinting on its round glasses. The owl is in a big triumphant celebration pose: body stretched tall, both wings thrown high above its head, beak wide open in a huge joyful smile, eyes squeezed into happy crescents, ear tufts flung up. The corner of a folded cream paper note and one gold coin peek out of the chest. Gold sparkles and tiny star bursts pop in the air above the chest.
The bottom 32% stays plain desk front fading into deep shadow, exactly as in the first image. The raised wings stay inside the frame. No text.
```

**9. Açılış klibi, dikey** (Kling; başlangıç 7, bitiş 8; 5 sn, 9:16, 1080x1920, Professional, yüksek prompt bağlılığı)
```
High-energy, cartoony 3D mascot animation with snappy cartoon timing: fast moves, big exaggerated poses, strong squash and stretch, quick anticipation, springy overshoot and a short hold on each key pose. Joyful, playful, full of personality. Punchy and lively, never slow or floaty.
0.0-0.8s: the owl bounces on its toes twice with excitement, drumming both wings on the desk beside the chest, ear tufts springing up and down.
0.8-1.6s: it squashes down low, then springs up and flings the lid open with both wings in one fast snap; the lid swings back and wobbles with a springy overshoot.
1.6-2.4s: a burst of warm golden light pops out of the chest with a puff of gold sparkles and tiny star bursts, lighting the owl's face from below and glinting on its glasses; the owl's eyes go huge and its whole body stretches tall in surprise.
2.4-4.0s: the owl does one big happy jump straight up, wings thrown high, stretching in the air and squashing on landing, ear tufts flopping.
4.0-5.0s: it snaps into the final pose, wings high in triumph, beaming, a quick happy wiggle, then holds.
The camera is completely static. The chest body stays fixed on the desk and keeps its shape; only the lid moves. The owl stays inside the frame, behind the chest, and its wings never leave the frame, even at the top of the jump. The room, lamp and bookshelf stay exactly the same. The bottom third of the frame stays plain dark desk front, nothing moves there. No text.
```
Negatif: 5. klibin negatifi aynen, sonuna `cropped wings, owl leaving frame, objects in the bottom third` eklenir.

Teslim: 7 ve 8 PNG, klip en yüksek çözünürlük. 2–3 klip varyasyonu üretip en canlısını seç. Filigran
sağ altta olacağı için kırpma alttan yapılır; alttaki boş masa önü bu yüzden de lazım. Lamba şeridinin
yeri dikey karede yeniden ölçülür (`chest-art.tsx`, yeni bir `STRIPS` girdisi).
### 10–12. Masaüstü için yatay set (16:9) ve geliştirilmiş klip (tur 3)

Yatay ekran 16:9 seti, dikey ekran 9:16 setini (7–9) kullanır; kare set (3–5) yedekte kalır. İlk
klipten öğrenilenler: Kling başlangıç ve bitiş karesini yeniden çiziyordu (Puhu büyüyor, poz kayıyor),
ışık patlaması düzdü, arka plan ölüydü. Aşağıdaki klip promptu bunları hedefliyor ve 9. klibin yerine de
geçer (yalnız oran satırı değişir).

**10. Masada kapalı sandık, yatay** (ChatGPT; `desk-chest-closed.webp` + `room-puhu.webp` + `rest.png` ekli)
```
Create a wide cinematic 16:9 image (1920x1080 or larger) of the attached scene, as if the camera pulled back to show the whole cozy study at night. Keep the owl, its round blue glasses, blue ear tufts and blue heart, the wooden chest with its glasses-shaped lock plate and blank brass strip, and the brass desk lamp exactly as in the first image: same soft 3D clay-and-plush style, same materials, same warm amber lamp light. Do not redraw or restyle them.
Composition:
- Center: the owl leaning eagerly over the closed chest, exactly the pose of the reference. The chest is centered horizontally, about 22% of the frame width, its bottom edge at about 70% of the height. Leave clear space above the owl's ear tufts (at least 12% of the height) so it can jump without leaving the frame.
- Left third: the brass desk lamp reaching in from the left, its warm cone of light falling on the chest lid; behind it a round night window with stars and distant city lights.
- Right third: tall bookshelves with books, a small glowing lantern and hanging plants, softly out of focus.
- Bottom 30%: the front edge of the wooden desk, plain warm wood that fades smoothly into deep warm shadow at the bottom edge, so white text and buttons can sit on it. No objects there.
- Gentle depth: the room behind the owl is slightly softer than the owl and the chest, which are crisp.
The chest's blank brass strip is fully visible and unobstructed. No text, no extra characters.
If you can only make a 3:2 image, keep everything important inside the central 16:9 band and let only room and desk fill the extra top and bottom.
```

**11. Masada açık sandık, yatay** (ChatGPT; 10. görsel + `desk-chest-open.webp` ekli)
```
Using the first attached image as the exact reference, keep the same 16:9 frame, camera, composition, room, lamp, and the same position and size of the owl and the chest. Changes only, with the pose taken from the second attached image:
The chest lid is swung fully open. Warm golden light pours up out of the chest in soft volumetric rays with a few floating dust motes, lighting the owl's face and the underside of its wings from below and glinting on its round glasses. The owl is in a big triumphant celebration pose: body stretched tall, both wings thrown high above its head, beak wide open in a huge joyful smile, eyes squeezed into happy crescents, ear tufts flung up. A folded cream paper note and one gold coin peek out of the chest and catch the light. A few gold sparkles and tiny star bursts hang in the air above the chest.
The raised wings and ear tufts stay fully inside the frame. The bottom 30% stays plain desk front fading into shadow, exactly as in the first image. No text.
```

**12. Açılış klibi, yatay** (Kling; başlangıç 10, bitiş 11; 5 sn, 16:9, 1920x1080, Professional, yüksek prompt bağlılığı; 9 için aynı metin, `16:9` yerine `9:16`)
```
Premium cartoony 3D mascot animation, 16:9, with snappy cartoon timing: fast moves, big exaggerated poses, strong squash and stretch, clear anticipation before every big move, springy overshoot and a short hold on each key pose. Joyful and full of personality. Punchy and lively, never slow or floaty.
0.0-0.3s: hold the start frame exactly, perfectly still.
0.3-1.0s: the owl bounces on its toes twice, drumming both wings on the desk beside the chest; its fluffy feathers ripple and its ear tufts spring up and down a beat after the body.
1.0-1.7s: it squashes down low and wiggles in anticipation, then springs up and flings the lid open with both wings in one fast snap; the lid swings back on its hinge and wobbles with a springy overshoot.
1.7-2.5s: a burst of warm golden light pops out of the chest in soft volumetric rays with a puff of gold sparkles and tiny star bursts; the light sweeps up over the owl's face, the underside of its wings and the shelves, and glints across its glasses; the owl's eyes go huge and its whole body stretches tall in surprise.
2.5-4.0s: the owl does one big happy jump straight up, wings thrown high, stretching in the air and squashing on landing, ear tufts flopping and feathers settling a beat late. The light from the chest keeps glowing and the sparkles drift and fade.
4.0-4.5s: it snaps into the final pose, wings high in triumph, beaming, with a quick happy wiggle.
4.5-5.0s: hold the end frame exactly, perfectly still.
Background life, small and gentle: the window stars twinkle, the lantern flickers softly, a few dust motes float in the lamp light. The camera is completely static. The chest body stays fixed on the desk and keeps its shape; only the lid moves. The owl stays inside the frame and behind the chest; its wings and ear tufts never leave the frame, even at the top of the jump. The lamp, window and shelves keep their shape and place. The bottom 30% stays plain dark desk front. No text.
```
Negatif:
```
slow motion, slow, sluggish, calm, gentle body movement, low energy, hesitant, floaty, stiff, realistic motion, camera movement, zoom, pan, dolly, shake, chest moving, chest deforming, lid detaching, extra chests, coins flying everywhere, background change, room changing, lamp moving, owl changing size, owl changing design, text, watermark, logo, extra characters, extra limbs, extra wings, morphing, melting, deformed wings, deformed face, deformed glasses, glasses falling off, green owl, flicker, cropped wings, owl leaving frame, objects in the bottom third
```
Teslim: 10 ve 11 PNG (en büyük boy), klipten 2–3 varyasyon, en canlısı. Başlangıç ve bitiş karesine
oturmayan varyasyon elenir: sahnenin "Hazır" ve "Açıldı" kareleri yine klibin ilk ve son karesinden
çıkar. Filigran kırpması alttan; lamba şeridi her sette ayrı ölçülür (`chest-art.tsx` `STRIPS`).
## Kod etkisi (uygulayıcıya yol haritası)

**API (economy sahibi; coaching yalnız sinyal verir):**
- Migration (o anki sıradaki numara): `user_quest_progress.revealed_at timestamptz null`. Yazma SERVICE
  bağlamında, kendi satırı için; okuma mevcut self-read RLS ile.
- `DailyQuestSignals`'a `weeklyActiveDates: string[]` ve `weeklyFocusMinutes` (aralık toplamı;
  `sumCompletedFocusSecondsOnDate`'in aralık hâli). Mevcut alanlar değişmez.
- `GET /v1/economy/weekly-chest` → `{ state, periodKey, carriedOver, current, target, days[7]: {date, active},
  today, reward: {unit:"COIN", amount} | null, rewardPendingMessage?, summary? }`. `summary`
  (`activeDays, focusSessions, planTasks, focusMinutes`) yalnız `READY`/`OPENED`'da. Önce geçen haftanın
  tamamlanmış ve açılmamış satırına bakar (devreden), yoksa bu hafta. Quest uç noktası gibi ekonomi
  kapalıyken de açık; o zaman `reward: null`.
- `POST /v1/economy/weekly-chest/open { periodKey }` → idempotent: `revealed_at` yoksa yazar, aynı
  `summary` + ledger'daki gerçek Coin tutarını döner, eşleşen ödül makbuzunu (receipt) "görüldü" yapar.
  Yalnız tamamlanmış ve sahibine ait satır; başka hafta veya kullanıcı 404.
- Coin verme yolu değişmez (otomatik, cap'li, idempotent). `revealed_at` ödeme kararını etkilemez.
- Shared tipler `@mentor/types`, doğrulama `@mentor/validation`, OpenAPI + client yeniden üretilir.

**Web:**
- `today-path-model.ts`: sandık artık `weekly-chest` durumundan gelir (quest listesinden değil);
  ekonomi kapalıyken de çizilir. `ChestNode` → `button` (durumlara göre pencere / sahne / not).
- `daily-quests-card.tsx`: satır yeni durumlara göre; "Aç" ve "Özeti gör".
- Yeni `apps/web/src/components/weekly-chest/`: `chest-art.tsx` (görsel + lamba katmanı),
  `chest-sheet.tsx`, `chest-scene.tsx` (portal, video, azaltılmış hareket), `chest-note.tsx`,
  `use-weekly-chest.ts`, saf yardımcılar (`weekly-chest-model.ts`: pip'ler, kalan gün, odak süresi biçimi).
- `EconomySync`: `reason === "quest.weekly.effort-allowance"` makbuzunu kutlamaz ve "görüldü" yapmaz
  (sahne yapar); panelde değilse "Haftalık sandığın hazır" bildirimi tetikler. Ekonomi kapalıyken
  bildirim, eylem sonrası yenilemede `PROGRESS → READY` geçişinden doğar.
- Video, panel `READY` durumunu görünce önden yüklenir. Ses: yalnız mevcut `playCoinChime`.
- Dosyalar 250–300 satır sınırının altında kalır; kabuk yönetir, alt bileşenler çizer.

**Doküman:** DESIGN.md §6.1 (sandık düğümü), §9 (sahne istisnası), §13 backlog maddesi kapanır;
`docs/features/economy.md` ve `web-shell.md` zaman çizelgesi.

## Testler
- API birim: durum makinesi (sürüyor / hazır / açıldı / devreden / ekonomi kapalı / cap bekleyen),
  `open` idempotent, makbuz onayı, `revealed_at` ödemeyi değiştirmez, iki hafta geriye devretmez.
- API e2e (geçici `_test` veritabanı): başka kullanıcının sandığı açılamaz, migration, gerçek seans ve
  görevlerle `summary` sayıları.
- Web birim: model yardımcıları (pip'ler, kalan gün, `3 sa 20 dk`, devreden başlıklar).
- E2E (gerçek API, 375 ve 1280): hazır → dokun → sahne → not; azaltılmış hareket; ekonomi kapalı;
  bilgi penceresi; başka sayfada bildirim; genel coin penceresinin bu ödülde çıkmadığı.

## Kendi kararlarım (kullanıcı itiraz etmezse geçerli)
- Açılmış sandığa dokununca not animasyonsuz açılır (klip tekrar oynamaz).
- Klip dokununca atlanır; "İçinde" ekranı yine gelir.
- Lamba sayısı config hedefini izler (3–7); görselde lambalar yok, kod çizer.
- Yeni ses yok; Coin göründüğünde mevcut zil.
- Bekleme döngüsü (#6) isteğe bağlı; gelmezse "Hazır" ekranı #3 görseliyle durur.
