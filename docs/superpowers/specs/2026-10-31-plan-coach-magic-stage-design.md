# Koçla planla · "Puhu'nun büyüsü" bekleme sahnesi (tur 2)

## Context
"Koçla planla" sihirbazının son adımı, model önizlemeyi hazırlarken tam ekran bir bekleme sahnesi
oynatır (tur 1, 2026-10-14, "Hafta kuruluyor": DESIGN.md §9.1 "the loop decision"). Tur 1'de
öğrencinin cevapları 7 gün sütununa renkli bloklar olarak dağılıyordu. Kullanıcı bunu net ve premium
bulmadı. Bu tur blokları tamamen kaldırır, yerine pelerinli premium Puhu'nun büyü yaptığı bir gece
sahnesi koyar. Sahne koçun gerçekten neye baktığını gösterir.

Ürün çizgisi değişmez: **koç neye baktığını söyler, bir şey uydurmaz.** Ekrandaki her cümle
backend'in doğrulanmış evidence özetidir. Bu turda sayı ya da ilerleme yüzdesi uydurulmaz.

Canvas: https://claude.ai/artifact/2fKGABNWysUMAxdvDTUoug (üst sıra "Tur 2 · Şehrin üstünde" onaylı).

## Güncelleme (2026-10-31, kullanıcı onayı: "harika!") — bu bölüm aşağıdaki metnin önüne geçer
Yörünge düzeni "AI slop" bulundu ve bırakıldı. Onaylanan düzen **Şehrin üstünde** (artboard'lar
`Sehir.dc.html`, `SehirMasaustu.dc.html`). Aşağıdaki metinde yörünge, rozet ikon, nokta göstergesi,
altın kenarlı kart, `.coach-magic-theme` paleti ve "veri yok" altın ışıkları geçersizdir.
- **Sahne:** gökyüzü `linear-gradient(#08113A 0%, #09133D 52%, #132552 74%, #1B3563 100%)`
  (videonun zemini `#08113A`–`#0C123E`). Altta landing'in şehir katmanları
  `public/visuals/landing/city-{far,mid,front}.webp` (+ `.avif`, `SceneImg` ile). Mobilde yükseklik
  400 px, yatay ortadan kırpılır. Altta koyu bir gölge şeridi alt notu okutur.
- **Puhu:** video gökyüzünde, şehir siluetinin tamamen üstünde (maskeli lacivert kare binaya
  binmemeli), yuvarlak `mask-image`.
- **Koçun okudukları:** her kaynak landing dilinde bir kâğıt not: krem `#FFFDF6`, mürekkep
  `#0F2233`, mavi `#1A5FA3`, washi bant `#FFE08A`. Başlık satırı lucide ikon + "Caveat Variable"
  (`@fontsource-variable/caveat/wght.css`) etiket, cümle Nunito 16/23 700. 3,6 sn'de bir yeni not
  gökten düşüp (hafif dönme ve sekme) çatıların üstündeki yığına konar. Altında en fazla 2 boş yaprak
  görünür. Kaynaklar bitince baştan başlar.
- **Uzun bekleme:** alt satır `coach_adaptation_stage_slow`, lamba sarısı `#FFD15C`.
- **Veri yok:** not yok. Puhu, şehir, başlık, alt satır ve alt not.
- **Varış (1200 ms):** başlık "Haftan hazır." / "Planın hazır.", yığın hafifçe zıplayıp aşağı,
  önizleme sheet'inin geldiği yöne kayar, çubuk dolar.
- **Azaltılmış hareket:** videonun ilk karesi poster (ben çıkarırım), notlar düşmeden yer değiştirir.
- **Video:** kullanıcı teslim etti (`Downloads/kling_20261031_VIDEO_Bouncy__sn_5354_0.mp4`, 940², 5 sn,
  24 fps). Sağ alttaki "KlingAI 4.0" yazısı kırpılır: üstten 880 satır, x=30'dan 880 genişlik, WinRT
  `MediaTranscoder` (PowerShell 5.1), bitrate ×1,15. Döngü dikişi normal bir kare farkının ~2 katı:
  ffmpeg olmadan çapraz geçiş yapılamıyor, kabul edilir ya da yeniden üretilir.

## Hedefler
- Bekleyiş premium ve canlı hissettirmeli: Duolingo tadında, zıplayan, rol yapan bir Puhu.
- Öğrenci koçun hangi kaynaklara baktığını ilk bakışta görür ve her birinin cümlesini okur.
- Sahne mobilde ve masaüstünde aynı kompozisyondadır.

## Hedef dışı
- Önizleme sheet'i (`plan-coach-adaptation-preview.tsx`) bu turun konusu değil.
- Diğer AI beklemeleri ve uygulama geneli bir loader bu turda yapılmaz.
- Gerçek istek iptali (abort) ve ses yok. Bunlar tur 1'deki gibi kalır.

## Anti-hedefler (çalışsa bile başarısızlık sayılır)
- Uydurma bir ilerleme, yüzde ya da koçun bakmadığı bir kaynak gösterilmesi.
- Ekranın "yükleniyor" iskeleti ya da spinner gibi okunması.
- Puhu'nun yörüngedeki ikonlara çarpması veya kartın her cümlede zıplatıp düzeni kaydırması.

## Kullanıcının verdiği kararlar (2026-10-31)
1. Renkli bloklar ve 7 gün panosu tamamen kalkar.
2. Sahne koçun baktığı kaynakları görselleştirir (yalnız atmosfer değil).
3. Pelerinli premium Puhu (`public/mascot/puhu/puhu-premium.png`) **elinde ucu yıldızlı bir asayla**
   büyü yapar.
4. Puhu'nun hareketi bir **Kling video döngüsüdür**. Sanatı kullanıcı üretir (promptlar bu
   dokümanın sonunda). **Ara bir kod sürümü yok:** kod, video gelince bir kerede yazılır.
5. Sahne **her zaman gecedir**: açık/koyu tema çerezinden bağımsız, başarı sahnesi gibi kapsamlı bir
   tema.
6. Düzen: **A · Yörünge.** Kaynak ikonları Puhu'nun etrafında bir halkada durur. Sırası gelen parlar,
   cümlesi Puhu'nun altındaki tek kartta yazar.
7. Hareket Duolingo gibi canlı: hazırlık hareketi, esneyip sıkışma, hedefi geçip geri oturma.
8. Cevap geldiğinde başlık bir anlığına "Haftan hazır." olur (kullanıcı "tamam" dedi; geri alınabilir).

## Sahne

### Katmanlar (yukarıdan aşağı, tek sütun, `max-w-xl`, sihirbazla aynı genişlik)
1. **Üst satır** (değişmez): sihirbazın ilerleme çubuğu (son segment cevap gelince dolar) ve
   "Vazgeç". Sihirbazsız girişte çubuk yoktur, "Vazgeç" vardır.
2. **Başlık:** `coach_adaptation_stage_title` ("Haftanı kuruyoruz.") veya hafifletme kaynağında
   `coach_adaptation_stage_title_lighten`. 28 px / masaüstü 32 px, 900, beyaz.
3. **Alt satır:** brief'in `groundingLine` cümlesi (örn. "5 denemene, 5 yanlış kartına ve son 28
   gündeki 6 seansına baktık."). Yoksa tur 1'deki gibi `coach_adaptation_stage_sub`, o da yoksa
   boş. 12 sn'den sonra yerini altın renkte `coach_adaptation_stage_slow` alır.
4. **Sahne kutusu** (mobil 340 px, masaüstü 420 px kare):
   - arkada mavi/altın radyal parıltı;
   - ortada Puhu videosu (yuvarlak `mask-image` ile kenarları zemine erir);
   - etrafında kesik çizgili, 60 sn'de bir tur dönen yörünge halkası;
   - halkanın üzerinde eşit aralıklı **kaynak ikonları**, ilki en üstte, saat yönünde. Mobilde 48 px,
     masaüstünde 56 px.
5. **Kart:** parlayan ikonun aynısı, üstte büyük harfli altın etiket (kaynak türü), altında
   `evidence[i].summary`. Yüksekliği en uzun cümleye göre sabittir, kart değişince düzen oynamaz.
6. **Nokta göstergesi:** kaynak sayısı kadar nokta, aktif olan altın ve uzun.
7. **Alt not:** öğrencinin cevapları, tur 1'deki `caption` mantığıyla ("2 gün · günde 120 dk · 3
   ders" / "bu hafta N bekleyen görev").

### Döngü
- Tek saat vardır: **3,6 sn'de bir** sıradaki kaynak aktif olur. İkon büyür ve altın parlar
  (450 ms ease-out), kart çapraz geçişle yenilenir.
- Son kaynaktan sonra baştan başlar (tur 1'in "her satır bir kez" kuralının yerine geçer: artık
  cümleler canlı bölgede okunmuyor, aşağıdaki erişilebilirlik bölümüne bak).
- Kaynak sayısı backend'de zaten en fazla 6 (`PLAN_EVIDENCE_MAX`). İstemci yine de ilk 6'yı alır.

### Haller
| Hal | Ne zaman | Ne görünür |
| --- | --- | --- |
| Normal | brief var, `evidence` ≥ 1 | Yörünge + kart + noktalar |
| Uzun bekleme | 12 sn'den sonra | Alt satır altın renkte `coach_adaptation_stage_slow` olur, döngü sürer |
| Veri yok | brief `null` (sihirbazsız giriş: ruh hali, seans, "Yeniden hazırla"; ya da brief okunamadı) veya `evidence` boş | İkon, kart ve nokta yok. Yörüngede `knownWeek.pendingCount` kadar (en fazla 12) küçük altın ışık döner. 0 ise yalnız halka kalır. Alt not aynı kurala uyar |
| Cevap geldi | `arrived` | İkonlar (ya da ışıklar) Puhu'ya toplanır, altın halka yayılır, çubuk dolar, başlık "Haftan hazır." / hafifletmede "Planın hazır." olur. Ta-da klibi varsa onun ilk ~1,2 sn'si oynar. Süre **1200 ms**, sonra `onDone` |
| Azaltılmış hareket | `prefers-reduced-motion` | Video yerine poster görseli, halka dönmez, ikon büyümez. Aktif ikon ve kart yine değişir ama anında. Varışta `onDone` hemen çağrılır (tur 1 ile aynı) |
| Video yüklenemedi | `<video onError>` | Poster görseli, sahnenin geri kalanı aynı |

### Kaynak türü → ikon + etiket
İkonlar `lucide-react` (repo'da 1.21.0 kurulu, tablodaki adların hepsi mevcut). Etiketler yeni i18n anahtarları:
`plan.coach_adaptation_evidence.<TYPE>`. Bütün `CoachEvidenceType` değerleri haritalanır, böylece
backend listesi değişince sahne kırılmaz. Bilinmeyen tür gelirse `Sparkles` ve genel etiket kullanılır.

| Tür | İkon | tr | en |
| --- | --- | --- | --- |
| MOCK_PERFORMANCE | `ClipboardList` | Denemelerin | Your mock exams |
| WEAK_SUBJECTS | `Target` | Zorlandığın dersler | Subjects to work on |
| NOTEBOOK_TOPICS | `BookOpen` | Yanlış defterin | Your mistake notebook |
| LONG_TERM_RHYTHM | `Activity` | Son 4 haftan | Your last 4 weeks |
| RECENT_RHYTHM | `Activity` | Son 7 günün | Your last 7 days |
| SUBJECT_BALANCE | `ChartColumn` | Ders dengen | Subject balance |
| PLAN_FOLLOW_THROUGH | `ListChecks` | Geçen haftan | Last week |
| STREAK | `Flame` | Serin | Your streak |
| MOOD | `BatteryMedium` | Enerjin | Your energy |
| GOAL | `Compass` | Hedefin | Your goal |
| EXAM_PHASE | `CalendarRange` | Sınav dönemin | Exam season |
| TODAY_PLAN | `CalendarCheck` | Bugünkü planın | Today's plan |
| TODAY_FOCUS | `Timer` | Bugünkü odağın | Today's focus |
| ACTION_OUTCOME | `Sparkles` | Koç önerilerin | Coach suggestions |
| (bilinmeyen) | `Sparkles` | Koçun notu | Coach note |

Not: EXAM_PHASE etiketi gün sayısı ima etmez (AGENTS.md §4 #1). Cümlenin kendisi de backend'den
kaba faz olarak gelir.

### Renkler (kapsamlı gece teması)
DESIGN.md'deki premium token'lardan türetilir. Yeni kapsam sınıfı, örn. `.coach-magic-theme`
(`theme.css`), çerezle çevrilmez:
- zemin `#0E1A3D`: **videonun ilk karesinden ölçülen renkle değiştirilir**, ikisi bire bir aynı olmalı;
- yüzey (ikon, kart) `#17224A`, aktif ikon `#2A3A7A`;
- altın `--premium-badge-ink` `#FFD76A` (etiket, aktif kenar, ışıklar);
- metin `#F3F5FF`, ikincil `#B9C3E6`, alt not `#9AA6CF` (hepsi zeminde ≥ 4,5:1);
- `--color-main`, `--color-secondary`, `--play-track`, `--play-line` gece değerlerine yeniden
  eşlenir, böylece `OnboardingStepLayout`'un çubuğu ve "Vazgeç"i ayrı varyant istemeden okunur
  (oda sahnesindeki remap deseni, DESIGN.md "Study scene").
- Tema sınıfı `<dialog>`'a konur. `.onboarding-play-theme` bu token'ları yeniden tanımlamıyor
  (`packages/ui/src/theme.css`), yani remap aşağıya iner. `OnboardingStepLayout` arka planını
  `--color-bg`, `--blob-pink` ve `--blob-blue` ile inline çiziyor: bu üçü de remap edilince layout'a
  dokunmadan gece zemini çıkar (`--blob-pink` saydama yakın, `--blob-blue` `#2F55D4`).

### Erişilebilirlik
- `<dialog aria-label={title} aria-busy={!arrived}>` aynı kalır (e2e bunu adıyla buluyor).
- Yörünge, kart ve noktalar `aria-hidden`. Dönen kart canlı bölge **değildir**. Döngü olduğu için
  sürekli konuşurdu.
- Bunun yerine görünmez (`sr-only`) bir liste kaynakları **bir kez** sıralar: etiket + cümle. Alt
  satır (`groundingLine` ya da yavaş cümlesi) `aria-live="polite"` olarak kalır.
- Video `aria-hidden`, `muted`, `playsInline`. Poster `alt=""` çünkü dekor.

## Varlıklar (kullanıcı üretir)
| Dosya | Ne | Not |
| --- | --- | --- |
| `public/mascot/puhu/motion/puhu-magic-loop.mp4` | Döngü videosu, 1:1, 5 sn | Kling filigranı kırpılır (landing videolarındaki WinRT MediaTranscoder kırpması), ~720 px'e sıkıştırılır |
| `public/mascot/puhu/motion/puhu-magic.webp` | 1. görselin kendisi | Poster + azaltılmış hareket + hata yedeği |
| `public/mascot/puhu/motion/puhu-magic-tada.mp4` | İsteğe bağlı ta-da klibi | İlk ~1,2 sn kullanılır; yoksa varış yalnız kodla oynar |

Kod, döngü videosu ve poster olmadan yazılmaz (karar 4). Ta-da klibi kodu bekletmez.

## Kod etkisi (uygulayıcıya yol haritası)
- **Kalkar:** `plan-coach-stage-board.tsx`; `plan-coach-stage-scene.ts` içindeki `buildStageScene`,
  `stageBeat`, `stageGaze`, `STAGE_MAX_ROWS` ve bunların spec'leri; sahnedeki `PuhuBubble` /
  `PUHU_MOTION_FRAMES` kullanımı. `PuhuBubble`'a tur 1'de eklenen `idleFrame` prop'u başka yerde
  kullanılmıyorsa o da kalkar.
- **Kalır:** sahnenin `plan-coach-adaptation-action.tsx` içindeki bağlantısı (`stage`, `arrived`,
  `finishStage`, `cancelStage`), `<dialog>` ve `showModal`, `OnboardingStepLayout` (`root="div"`,
  `center`), `caption` mantığı, `STAGE_TIMING.slowAfterMs`.
- **Değişir:** `STAGE_TIMING` → `{ lineMs: 3600, slowAfterMs: 12000, arrivalMs: 1200 }` (tek saat
  `lineMs` olur, `beatMs` kalkar).
- **Yeni saf yardımcı** (ör. `plan-coach-stage-orbit.ts` + spec): kaynak listesini (ilk 6) ve
  sayaçtan aktif indeksi, halka üzerindeki açıları, veri yok halindeki ışık sayısını üretir. Tür →
  ikon/etiket anahtarı haritası da burada.
- **Yeni bileşen** (ör. `plan-coach-stage-orbit.tsx`): video, halka, ikonlar, kart, noktalar. Sahne
  dosyası yalnız durumu yönetir. İkisi de ~250 satırın altında kalır.
- **i18n:** `plan.coach_adaptation_stage_ready` ("Haftan hazır."),
  `plan.coach_adaptation_stage_ready_lighten` ("Planın hazır."), `plan.coach_adaptation_evidence.*`
  (tablo). tr ve en.
- **Tema:** `.coach-magic-theme` (`theme.css`); DESIGN.md §2 "Does not follow theme" listesine bir satır.
- **DESIGN.md §9.1:** "the loop decision" tablosu yeni vuruşlarla güncellenir (döngü 3,6 sn, uzun
  bekleme 12 sn, varış 1200 ms) ve "Hafta kuruluyor" adı "Puhu'nun büyüsü" olur.
- **e2e (`apps/web/e2e/plan.spec.ts`):** blokları sayan testler (`[aria-hidden] span[style*='translate']`)
  yeniden yazılır:
  - sihirbazlı giriş: sahne `coverageLine`'ı içerir, ikon sayısı = brief'teki kaynak sayısı, kart
    metni zamanla değişir, alt not öğrencinin cevaplarını söyler;
  - azaltılmış hareket: video yok, poster var, kart yine değişir;
  - ruh hali girişi: çubuk yok, "bu hafta 1 bekleyen görev", 1 altın ışık.

  Diğer sahne testleri (Vazgeç, geç yanıt, Yeniden hazırla) yalnız seçici değişikliği ister.
- **docs/features/coaching.md:** zaman çizelgesi girdisi (zorunlu).

## Uygulayıcıya bırakılanlar
- Tam animasyon eğrileri ve parıltı sayısı (DESIGN.md §9 süre token'larıyla).
- Kartın sabit yüksekliğinin nasıl sağlanacağı (min-height ya da tüm cümleleri üst üste koyup
  yalnız aktifi göstermek).
- "Vazgeç"in 12 sn sonra vurgulanıp vurgulanmayacağı. Canvas'ta kenarlıklı çizildi, ama ortak
  layout'a yeni prop gerektirirse vurgu yapılmaz, yavaş cümlesi zaten yönlendiriyor.
- Videonun `preload` stratejisi (sahne sihirbazın son adımında açıldığı için sihirbaz açılınca
  önden yüklemek makul).

## Kendi kararlarım (kullanıcı itiraz etmezse geçerli)
- Döngü son kaynaktan sonra baştan başlar. 12 sn'den sonra alt satır yavaş cümlesine geçer.
- Kartta yıldız değil, aktif kaynağın ikonu durur.
- Veri yok halinde ışık sayısı = bekleyen görev sayısı (en fazla 12).
- Hafifletme kaynağında varış başlığı "Planın hazır.".
- Varış süresi 1200 ms (ta-da klibiyle uyumlu). Tur 1'de 450 ms'ydi, başlık değişimi okunabilsin
  diye uzatıldı.

## Promptlar (kullanıcı üretir)

### 1. Görsel (ChatGPT, `puhu-premium.png` ekli)
```
Using the attached character as the exact reference (same white fluffy owl, round blue glasses, blue ear tufts, starry navy cape with gold star clasp, blue heart on chest, orange feet), create one still frame in a lively cartoon pose:
The owl floats facing the viewer with a mischievous, excited grin, eyebrows (feather tufts) slightly raised. Its right wing holds a small magic wand: a short slim navy stick topped with a gold star that matches the cape clasp, raised at shoulder height. The left wing is open in a playful "ta-da" gesture. The cape flares out to one side as if it just moved. Three or four tiny gold sparkles near the wand tip.
Background: one flat, perfectly uniform deep night blue (#0E1A3D). No gradient, no vignette, no background stars, no floor, no shadow.
Character centered, about 50% of the frame height, the whole character (wand included) inside the central 60% of the frame, nothing near the edges or corners.
Square 1:1, 2048x2048. Soft 3D render matching the reference style exactly. No text, no other objects.
```

### 2. Döngü videosu (Kling, 1. görsel hem başlangıç hem bitiş karesi, 5 sn, 1:1, Professional, yüksek prompt bağlılığı)
```
Bouncy, snappy 3D cartoon animation in the style of a playful mobile-app mascot: strong squash and stretch, clear anticipation, overshoot and settle. The owl is excited and full of personality.
0-1s: the owl squashes down slightly, pulling the wand in, eyes narrowing with a mischievous grin.
1-2s: it springs up in a little hop (stretching tall), its ear tufts bounce, and it swings the wand in a big fast circle over its head, leaving a spiral trail of gold sparkles. The cape flares up.
2-3s: a quick double twirl of the wand; the sparkles pop into a small ring of tiny gold and light-blue stars that spin once around the owl and fade. The glasses glint.
3-4s: a happy side-to-side wiggle, the cape swishing left and right, a confident little nod with a wink toward the viewer.
4-5s: it settles back with a soft bounce exactly into the starting pose.
The camera is completely static. The owl stays centered and never leaves the central 60% of the frame. The background stays a flat, uniform deep night blue the whole time. Seamless loop: the last frame matches the first frame.
```
Negatif:
```
slow motion, floaty, stiff, sluggish, camera movement, zoom, pan, background change, gradient, vignette, background stars, text, watermark, extra characters, extra wands, extra limbs, morphing, melting, deformed wings, deformed face, flicker, character leaving frame
```

### 3. Ta-da klibi (isteğe bağlı; başlangıç 1. görsel, bitiş boş, 5 sn)
```
Same style: bouncy, snappy cartoon animation. The owl jumps up with joy, thrusts the wand forward toward the viewer, and a big burst of gold sparkles and tiny stars explodes from the star tip, filling the space around it. The owl lands with a proud, happy pose, wings open wide, beaming. Static camera, flat uniform deep night-blue background, character stays centered.
```
