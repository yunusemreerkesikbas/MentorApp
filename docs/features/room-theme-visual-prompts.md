# Çalışma odası tema görselleri — üretim promptları

`LIBRARY` üretildi ve entegre edildi. `CAFE` ve `HOME` bekliyor. Bu dosya o iki temanın (ve
istenirse kütüphanenin geliştirilmiş v2'sinin) promptlarını taşır.

Her tema **üç dosya**: zemin, masa, sandalye.

---

## Pazarlıksız kurallar

Kod bu varsayımların üstüne kurulu; biri bozulursa kod bozulur.

1. **Tam tepeden (top-down, 90°), perspektifsiz.** Sandalye görseli masanın her yerinde
   *döndürülmeden* tekrar kullanılıyor; masa mobilde `rotate(90deg)` ile dikeliyor. Perspektifli
   bir çizimde ikisi de anlamsızlaşır.
2. **Sandalye radyal simetrik.** Kolçak yok, yönü belli sırtlık yok. 2–10 koltuğun hepsi aynı
   dosyayı kullanıyor.
3. **Masa ve sandalye kapasiteden bağımsız tek görsel.** Yerleşimi `seatPositions()` yapıyor;
   "6 kişilik masa" diye ayrı asset yok.
4. **Masa ve sandalye kare tuvalde, şeffaf zeminde, kenar boşluğu neredeyse sıfır.**
   Aşağıda ayrı başlık — en sık yapılan hata bu.
5. **Kendi temas gölgesi baked-in.** CSS'te ikinci gölge eklemiyoruz, üst üste binince
   çamurlaşıyor.

### Kenar boşluğu neden kritik (yaşanmış hata)

`room-library-table.webp` 1254×1254 kare ve kod onu **kare bir kutuya** `object-contain` ile
yerleştiriyor. Yani **görselin içindeki şeffaf boşluk, ekrandaki masa boyutuna birebir zarar
veriyor**: ovalin çevresinde %20 boşluk varsa masa da %20 küçük çıkıyor. Bu yüzden masa
haftalarca "oyuncak gibi" göründü ve yarıçapları büyütmek işe yaramadı.

> Prompta şunu ekleyin: **"the table fills the frame edge to edge with no empty margin — the
> oval's widest points touch the left and right edges of the canvas."**

Aynısı sandalye için de geçerli.

---

## Kütüphane referansı — neyi tekrarlıyoruz, neyi düzeltiyoruz

`room-library-bg.webp` doğru olanı yaptı: gerçek bir yerin sıcaklığı, kuvvetli tek yönlü ışık,
zengin doku, merkez üçte biri boş. **Ayrıca loş olması iyi oldu** — üstünde açık renk koltuk
etiketleri ve uygulama chrome'u duruyor, koyu zemin bunları taşıyor. Yeni temalar da bu yüzden
**koyu/orta koyu** olmalı; parlak beyaz bir oda üstündeki metni okunmaz yapar
(bkz. `coaching.md`, 2026-08-28: token'lar görsele uydurulmak zorunda kaldı).

**Düzeltilecek tek şey canlılık:** kütüphanenin zemini neredeyse nötr gri, sahnenin rengi
yalnızca kenardaki kitaplıklardan geliyor. Yeni temalarda zeminin **kendisi** renk taşımalı.

---

## CAFE

### `room-cafe-bg.webp` — 1920×1080

> Top-down (bird's eye, straight 90° overhead) illustration of an empty cozy coffee-house
> floor, warm and lively but DIM — a late-afternoon interior, not a bright one. Dark walnut
> herringbone parquet with visible grain and warm amber reflections; the floor itself carries
> colour, it is not neutral grey. Low sun rakes in from the upper-left through a tall window,
> casting long soft light shafts and the shadow of window mullions across the boards. Around
> the edges of the frame, seen from directly above: a marble counter with a brass espresso
> machine and a stack of ceramic cups top-right; a shelf of coffee bags and a grinder; scattered
> bentwood chairs and a small side table bottom-left; a trailing pothos and a chalkboard menu
> leaning against the wall bottom-right. Rich saturated palette — burnt amber, terracotta, deep
> espresso brown, brass, a few muted teal accents. **The centre third of the image must stay
> EMPTY floor** (a table is composited there in the app). Painterly semi-realistic render, soft
> volumetric light, gentle film grain. No text, no people, no watermark.

### `room-cafe-table.webp` — 1254×1254 kare, şeffaf zemin

> Top-down (straight 90° overhead) view of a single round café table, isolated on a fully
> transparent background. **The table fills the frame edge to edge with no empty margin — the
> widest points of the top touch the left and right edges of the canvas.** Dark walnut top with
> a thin brass edge band, warm and slightly glossy, visible grain. On the surface: one white
> ceramic cup on a saucer, a small folded napkin, a brass table-number stand. Warm light from
> the upper-left, with a soft realistic contact shadow baked underneath the table onto the
> transparent background. Nothing else in frame — no chairs, no floor, no people. Painterly
> semi-realistic render, no text, no watermark.

### `room-cafe-seat.webp` — 1254×1254 kare, şeffaf zemin

> Top-down (straight 90° overhead) view of a single round café stool, isolated on a fully
> transparent background, **filling the frame edge to edge with no empty margin**. RADIALLY
> SYMMETRIC — a plain circular seat with NO armrests and NO backrest, identical from every
> direction. Tufted cognac leather cushion with a dark brass rim. Warm light from the
> upper-left, soft realistic contact shadow baked underneath onto the transparent background.
> Nothing else in frame. Painterly semi-realistic render, no text, no watermark.

---

## HOME

### `room-home-bg.webp` — 1920×1080

> Top-down (bird's eye, straight 90° overhead) illustration of an empty cozy home study floor,
> calm and inviting, in **evening lamplight — dim and warm, not a bright daytime room**. Pale
> oak floorboards largely covered by a big soft rug with a muted lavender-and-cream geometric
> pattern; the rug carries real colour. A warm floor lamp glows from the upper-left, laying soft
> pools of light and long shadows across the rug. Around the edges of the frame, seen from
> directly above: an unmade daybed with linen cushions top-left; a low shelf with stacked books,
> a small speaker and a lit candle top-right; a laundry basket and a pair of slippers
> bottom-left; a large monstera in a woven basket bottom-right. Palette — dusty lavender, warm
> cream, deep plum shadow, sage green, a muted rose accent. **The centre third of the image must
> stay EMPTY rug** (a table is composited there in the app). Painterly semi-realistic render,
> soft diffuse light, gentle film grain. No text, no people, no watermark.

### `room-home-table.webp` — 1254×1254 kare, şeffaf zemin

> Top-down (straight 90° overhead) view of a single round light-oak coffee table, isolated on a
> fully transparent background. **The table fills the frame edge to edge with no empty margin —
> the widest points of the top touch the left and right edges of the canvas.** Pale warm wood
> with visible grain and a softly rounded edge. On the surface: an open notebook with a pencil,
> a stoneware mug, a small potted succulent. Warm lamplight from the upper-left, with a gentle
> realistic contact shadow baked underneath onto the transparent background. Nothing else in
> frame — no chairs, no floor, no people. Painterly semi-realistic render, no text, no
> watermark.

### `room-home-seat.webp` — 1254×1254 kare, şeffaf zemin

> Top-down (straight 90° overhead) view of a single round floor cushion / pouf, isolated on a
> fully transparent background, **filling the frame edge to edge with no empty margin**.
> RADIALLY SYMMETRIC — a plain circular cushion with NO armrests and NO backrest, identical from
> every direction. Soft dusty-lavender woven fabric with a subtle centre button tuft. Warm
> lamplight from the upper-left, gentle realistic contact shadow baked underneath onto the
> transparent background. Nothing else in frame. Painterly semi-realistic render, no text, no
> watermark.

---

## LIBRARY v2 — yeniden üretim

Mevcut kütüphane çalışıyor ama üç somut sorunu var. İkisi kod tarafında zaten vakit kaybettirdi.

**1. Masa görselinde şeffaf kenar boşluğu var.** `room-library-table.webp` 1254×1254 kare ve
oval o karenin içinde boşlukla duruyor. Kod kare kutuya `object-contain` uyguladığı için o boşluk
**birebir küçük masa** demek. "Masa küçük duruyor" şikayeti üç tur sürdü, yarıçapları büyütmek
işe yaramadı, çünkü sorun hiç yarıçaplarda değildi.

**2. Zemin nötr koyu gri.** Sahnenin bütün rengi kenardaki kitaplıklardan geliyor; ortası —
yani masanın oturduğu, ekranın en çok bakılan yeri — renksiz. Loş olması iyi (üstünde açık renk
etiketler duruyor), renksiz olması iyi değil.

**3. Yer karolarının çizgileri fazla düzenli.** Ekranda ince, düz, eşit aralıklı bir ızgara
olarak okunuyor; oda zemininden çok bir wireframe/debug ızgarası hissi veriyor.

### `room-library-bg.webp` — 1920×1080

> Top-down (bird's eye, straight 90° overhead) illustration of an empty, warm, lamp-lit library
> reading room — dim but NOT colourless. The floor is honey-toned oak parquet with visible
> grain and warm amber bounce from the lamps; the centre of the room carries colour of its own
> rather than reading as flat charcoal. **Avoid a regular hard-edged tile grid** — plank joins
> should be irregular, soft and low-contrast, never a repeating even lattice. Low warm light
> rakes in from the upper-left through a tall window, laying long soft light shafts and the
> shadow of window mullions across the boards. Around the edges of the frame, seen from
> directly above: tall dark-walnut bookshelves packed with worn cloth-bound books in deep
> greens, oxblood and faded gold; brass desk lamps with green glass shades; a trailing plant in
> a brass pot top-left; a wooden book trolley bottom-left; stacked books and a small stepladder
> bottom-right. Palette — warm honey oak, deep walnut, brass, oxblood, forest green, aged
> paper cream. **The centre third of the image must stay EMPTY floor** (a table is composited
> there in the app). Painterly semi-realistic render, soft volumetric light, gentle film grain.
> No text, no people, no watermark.

### `room-library-table.webp` — 1254×1254 kare, şeffaf zemin

> Top-down (straight 90° overhead) view of a single oval dark-walnut library reading table,
> isolated on a fully transparent background. **The table fills the frame edge to edge with no
> empty margin — the widest points of the top touch the left and right edges of the canvas.**
> Rich walnut with visible grain, a warm satin sheen and a subtly moulded edge. On the surface:
> a brass banker's lamp with a green glass shade, an open book, a folded pair of reading
> glasses, a small stack of index cards. Warm light from the upper-left, with a soft realistic
> contact shadow baked underneath the table onto the transparent background. Nothing else in
> frame — no chairs, no floor, no people. Painterly semi-realistic render, no text, no
> watermark.

### `room-library-seat.webp` — 1254×1254 kare, şeffaf zemin

> Top-down (straight 90° overhead) view of a single round library stool, isolated on a fully
> transparent background, **filling the frame edge to edge with no empty margin**. RADIALLY
> SYMMETRIC — a plain circular seat with NO armrests and NO backrest, identical from every
> direction. Deep oxblood velvet cushion with a soft centre tuft and a dark walnut rim. Warm
> light from the upper-left, soft realistic contact shadow baked underneath onto the
> transparent background. Nothing else in frame. Painterly semi-realistic render, no text, no
> watermark.

### Değiştirmeyin

Kompozisyonun **boş merkez üçte biri** ve **ışığın üst-soldan gelmesi** aynı kalmalı: masa
oradaya oturuyor ve masa/sandalye görsellerinin baked-in gölgeleri aynı ışık yönüne göre
çizildi. Işık yönü değişirse üç dosyayı birden yenilemek gerekir.

Ayrıca **loş kalsın.** Üstünde açık renk koltuk etiketleri ve uygulama chrome'u duruyor; parlak
bir oda onları okunmaz yapar — `--room-ink` bu yüzden açık renge çevrilmişti.

## Entegrasyon

Dosyaları `apps/web/public/visuals/` altına yukarıdaki adlarla bırakmak yeterli. Bileşenler
yolları `study-room-theme.ts`'ten okuyor, dosya yoksa CSS çizimine düşüyor — **kod değişikliği
gerekmiyor.**

Görsel geldikten sonra yapılacak tek iş: `packages/ui/src/theme.css` içindeki ilgili
`.room-stage[data-room-theme="…"]` bloğunu görselin gerçek parlaklığına göre doğrulamak.
`--room-ink` açık zemine koyu / koyu zemine açık olmalı. Bu eşleşme bir kez kaçtığında koltuk
etiketleri okunmaz oluyor — kütüphanede tam olarak bu yaşandı.
