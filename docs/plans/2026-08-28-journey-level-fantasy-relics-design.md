# Gece Yolculuğu Fantastik Relik Ailesi

> **İPTAL EDİLDİ (2026-08-29).** Bespoke relic ailesi üretilmedi; seviye rozetleri
> `public/img/levels/{levelKey}.webp` stok görsel setine geçti. Gerekçe ve yeni yaklaşım:
> [`docs/features/community.md`](../features/community.md) 2026-08-29 girdisi. Aşağısı tarihsel
> kayıttır, uygulanmaz.

**Tarih:** 2026-08-28  
**Durum:** İptal edildi (2026-08-29). Önceki durum: görsel yön onaylandı; üretim kalite kapısı Pusula V3 ile başlar.

## Amaç

Gece Yolculuğu'nun 12 seviyesini karakter veya puhu kullanmadan, aynı evrene ait
fantastik RPG relikleri olarak temsil etmek. Seri premium ve büyülü görünür; ancak
fantastik hissi yüzeyi mikro-rün, filigran ve rastgele parıltıyla doldurarak üretmez.
Her rozet 48 px'de tek bakışta okunur, 176 px kutlama kullanımında materyal kalitesini
korur.

## Kilitli sanat yönü

**Zengin ama sade fantastik relik:** Bir baskın silüet, bir ana mücevher, en fazla
2–4 destek taşı, geniş elle boyanmış materyal yüzeyleri ve tek bir ana büyü hareketi.
Fantastik kalite; oran, ışık, materyal kontrastı ve sembolik hikâyeden gelir.

- Ortak materyaller: koyu oyma ahşap, eskitilmiş bronz ve soğuk çelikten en az ikisi.
- Ortak renk omurgası: gece laciverti, ametist moru, camgöbeği ve odak için sıcak altın.
- **Gece Yolu:** Her relikte tek, kesintisiz mor hareket; şerit, enerji, sıvı, kök damarı
  veya yıldız bağlantısı olabilir.
- **Yolcu Mührü:** En fazla bir küçük hilal ve nokta gravürü; dekor dolgusu değildir.
- Transparan kare kompozisyon; dış hexagon, kalkan veya uygulama ikonu plakası yoktur.
- Nesne tuvalin yaklaşık %82–88'ini kaplar; büyü silüetin en fazla %10–12 dışına taşar.

## Anti–AI-slop detay bütçesi

- En fazla üç büyük materyal bölgesi ve üç anlamlı gravür.
- Tek ana mücevher; küçük taşlar simetrik dolgu olarak çoğaltılmaz.
- Tek ana büyü hareketi ve en fazla beş küçük ışık/parçacık vurgusu.
- Bilinçli boş yüzeyler korunur; her metal ve ahşap alan süslenmez.
- Büyük fasetler, geniş highlight alanları ve elle boyanmış kenar aşınması kullanılır.
- Yüzeyi dolduran mikro-rün, yıldız haritası gürültüsü, iç içe süs halkaları, rastgele
  filigran, dağınık mücevher ve sözde mekanik detay yasaktır.
- 48 px testinde ana sembol veya silüet kayboluyorsa görsel üretim kapısını geçmez.

## Seviye ailesi

| Seviye | Relik | Ana silüet |
| --- | --- | --- |
| Kıvılcım | Köz Çekirdeği | Çatlamış koyu taş içindeki amber kristal |
| İz | Yol Mührü | Mor yolun geçtiği bronz çerçeveli taş mühür |
| Pusula | Arcane Wayfinder | Ametistli pusula ve mor Gece Yolu |
| Döngü | Ay Çemberi | Birbirinin içinden geçen üç ay halkası |
| Ritim | Ahenk Sarkaçı | İki taş arasında salınan büyülü sarkaç |
| Akış | Gelgit Kumsaati | Kum yerine akan mor–camgöbeği enerji |
| Kök | Kadim Tohum | Kök ve metal tarafından sarılan ametist çekirdek |
| Kanat | Rüzgâr Tılsımı | İki metal kanat arasındaki safir |
| Ufuk | Kehanet Merceği | Uzak yıldız yolunu gösteren gözlem merceği |
| Fener | Yolcu Feneri | İçinde yıldız taşı bulunan işlenmiş fener |
| Yıldız | Yıldız Kalbi | Altın pençelerin tuttuğu göksel kristal |
| Takımyıldız | Göksel Küre | Işık çizgileriyle bağlanan yıldız taşları |

## Bölüm ilerlemesi

- **Uyanış:** Ham ahşap/taş, tek odak taşı, düşük büyü yoğunluğu.
- **Ahenk:** Dengeli bronz mekanizma, 2–3 taş, düzenli enerji hareketi.
- **Derinleşme:** Karartılmış metal, organik kök biçimleri ve daha derin iç ışık.
- **Birlikte Işık:** Altın ve göksel taşlar; bağlantılı fakat hâlâ kontrollü kozmik enerji.

İlerleyen bölümler daha çok mikro-detay eklemez; daha değerli materyal, daha cesur oran
ve daha güçlü ışık hiyerarşisi kullanır.

## Referans rolleri

- `Screenshot 2026-08-28 110058.png`: Birincil stil referansı; güçlü silüet, geniş
  materyal yüzeyleri ve RPG envanter ikonu sadeliği.
- `Pusula V2 — Arcane Wayfinder`: Renk ve büyü hikâyesi referansı; mikro-işçilik miktarı
  kopyalanmaz.
- `Screenshot 2026-08-28 105909.png`: Küçük boyut ve koleksiyon okunabilirliği; karakter
  veya çizgi stili alınmaz.

## Teslim kontratı

- `hero/{levelKey}.webp`: 1024×1024, transparan, en fazla 450 KiB.
- `compact/{levelKey}.webp`: 256×256, transparan, en fazla 80 KiB.
- Hero ve compact aynı silüeti paylaşır; compact sürüm mikro-detayın yaklaşık üçte birini
  kaldırır, konturları ve ana mücevheri güçlendirir.
- 24 dosyanın tamamı doğrulanmadan numaralı fallback kaldırılmaz ve kısmi aile yayınlanmaz.

## Kalite kapısı

Her aday beş ölçütte 5 üzerinden puanlanır: semantik uyum, 48 px silüet, materyal
inandırıcılığı, kontrollü mücevher/büyü hiyerarşisi ve seri tutarlılığı. Kabul için
toplam en az 22/25 ve her ölçütte en az 4/5 gerekir.

