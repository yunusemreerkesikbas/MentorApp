# SEO sayfaları · "Landing'in odası" redesign

- **Tarih:** 2026-11-21
- **Durum:** Tasarım onaylandı (canvas). Spec builder check'ten geçiyor.
- **Canvas:** https://claude.ai/artifact/AynK6ZbCAVVQWzRCdGQnYy. Panolar: Ortak kâğıt kiti (Main), Pomodoro, Program, Defter, Uygulama ve dört telefon panosu.
- **Kapsam:** altı public SEO sayfası.

| TR yol | Route (`[locale]/…`) | Kaynak |
|---|---|---|
| `/pomodoro-sayac` | `pomodoro-timer/page.tsx` | kendi sayfası + `_components/public-pomodoro-widget.tsx` |
| `/yks-calisma-programi` | `yks-study-program/page.tsx` | `components/seo-lp/study-program-lp-template.tsx` (variant `yks`) |
| `/tyt-calisma-programi` | `tyt-study-program/page.tsx` | aynı şablon (variant `tyt`) |
| `/lgs-calisma-programi` | `lgs-study-program/page.tsx` | aynı şablon (variant `lgs`, `#veli` bölümü ile) |
| `/yanlis-defteri-uygulamasi` | `mistake-notebook/page.tsx` | kendi sayfası + `_components/notebook-demo-widget.tsx` |
| `/ders-calisma-uygulamasi` | `study-app/page.tsx` | kendi sayfası, demo yok |

Kod `master`'da (45418bb8). En güncel hâli `feat/sprint-7-pilot-waitlist-qa`'da (48067f85, master'ın bir commit önünde). Dal seçimi aşağıda "Açık" bölümünde.

## Neden

Sahibin sözü: sayfalar "sade ve kimliksiz", "landing'deki gibi canlı olsun". Google'dan gelen ziyaretçinin ilk gördüğü şey bu sayfalar. Bugün hepsi aynı jenerik iskelette: pill, başlık, beyaz kart ızgarası, tablo, SSS. Renkler landing'in gündüz paletinden geliyor ama landing'i landing yapan imza parçaların hiçbiri yok: bantlı Caveat kâğıt notlar, dalgalanma, Puhu, sahneler.

## Hedefler

- Her sayfa landing'deki karşılığının sahnesiyle açılır ve landing'le aynı dünyada durur.
- Altı sayfa tek bir ortak kâğıt kitini paylaşır. Her sayfa yalnız kendi sahnesini, demosunu ve metnini verir.
- Vitrin metni enerjik Puhu sesine geçer (voice.md "Landing: enerjik Puhu").
- Canlı demolar sahnenin içinde ya da sahneye tutturulmuş bir notta durur.

## Hedef olmayanlar

- H1, cevap paragrafı (answer-first / definition / what_body), SSS soru ve cevapları, karşılaştırma tablosu içerikleri, iç link metinleri ve meta/OG/JSON-LD değişmez.
- Yeni görsel üretilmez. Yeni AI art, Kling videosu ya da OG görseli yok.
- Landing'in gece kamerası, scroll hikâyesi ve "Puhu'yla planla" videosu bu sayfalara taşınmaz.
- EN sayfalar (noindex) için ayrı tasarım yok. Aynı bileşenler EN mesajlarıyla çalışır.
- CTA'nın hedefi ve metni değişmez ("Bekleme listesine katıl" / waitlist akışı, `SeoSignupCta` + analytics `source`/`location`).

## Başarısızlık sayılacak durumlar (sayfa çalışsa bile)

- H1 ya da cevap paragrafı görselin arkasında veya sonrasında yükleniyor, LCP metin olmaktan çıkıyor.
- Sayfa landing'in kopyası gibi uzun bir scroll hikâyesine dönüyor; hızlı cevap arayan ziyaretçi cevabı bulamıyor.
- Anahtar kelime taşıyan metin (H1, cevap, SSS) değişiyor.
- Azaltılmış hareket ayarında bir şey hâlâ dönüyor ya da sallanıyor.

## Kısıtlar

- **SEO:** H1 sunucuda render edilen düz metin olarak kalır. FAQPage (`PaperFaq`) ve WebApplication JSON-LD aynen kalır. Canonical, robots (EN noindex), `llms.txt` ve sitemap değişmez. Bölüm `id`'leri korunur: `#nasil`, `#ornek` / `#ornek-tyt`, `#veli`, `#nasil-calisir`, `#ozellikler`, `#sss`, `#timer`.
- **Performans (benim kararım, builder check sonrası):** "LCP mutlaka metin olsun" kuralı uygulanmıyor. Masaüstünde ~600 px'lik sahne büyük olasılıkla H1'den büyük olacak ve LCP'yi o alacak.
  - Kural şu: H1 ve vitrin cümlesi görselden bağımsız, ilk boyamada görünür.
  - Sahne görseli `next/image` ile `priority` yüklenir; doğru `sizes`, AVIF/WebP.
  - Ölçüt: mobil emülasyonda LCP ≤ 2,5 s.
  - Route JS'i landing'in 400 KiB bütçesini geçmez.
- **CSP nonce:** inline script yok, JSON-LD bugünkü gibi nonce'lu.
- **Hareket:** CSS ve mevcut `paper-flutter.ts`. framer-motion yok (landing kuralı). İlk render `useReducedMotion()`'a göre dallanmaz (hydration hatası, landing'de yaşandı).
- **Erişilebilirlik:** dokunma hedefleri ≥44 px. Seçili durumlar `aria-pressed` ile belirtilir. Dekor görselleri `alt=""`. Kontrast 4.5:1, Caveat karalamalar dahil (`#1A5FA3`, kâğıt üstünde).
- **Tema:** sayfalar `landing-city-theme landing-day` + `.landing-paper` altında kalır. Gece paleti kullanılmaz.

## Yaklaşımlar

- **A · Gündüz kâğıdı:** bugünkü düzen kalır, kartlar bantlı notlara döner. Hızlı ve hafif, ama canlılık yüzeyde kalır ve sayfalar birbirine benzer.
- **B · Landing'in odası:** her sayfa kendi landing sahnesiyle açılır, altta ortak kâğıt kiti kullanılır. **Sahip bunu seçti.** Sayfalara kimlik verir, mevcut görsel ve bileşenleri kullanır, SEO'yu riske atmaz.
- **C · Gece şehri:** her sayfada gece şehri ve kamera dalışı. Bu sayfaların işine göre fazla ağır; landing'in kopyası gibi durur.

Metin kapsamı için üç seçenek vardı: sadece görsel, vitrin enerjik + gövde sade, tamamen yeniden yazım. **Sahip "vitrin enerjik, gövde sade"yi seçti.**

## Tasarım (sahibin kararları)

### Sayfa deseni (dört sayfada aynı)

- **Masaüstü hero:** iki kolon. Solda pill, H1, vitrin cümlesi, kanıt satırı, CTA'lar ve okla Caveat karalama. Sağda yuvarlak çerçeveli sahne; sahnenin alt köşesine bantlı ya da raptiyeli canlı not tutturulur.
- **Telefon:** sahne metnin altına iner, not sahnenin altına biraz bindirerek akar.
- **Sahnenin altındaki bölümler:**
  - Cevap paragrafı çizgili bir nota yazılır.
  - Adımlar post-it olur (Caveat numara, hafif eğim, renkli).
  - Karşılaştırma ve örnek hafta tabloları defter sayfasına yazılır: kırmızı kenar çizgisi, delikler, el çizimi tik.
  - Yan içerikler (oda sesleri, sınav yoldaşı, köprü, ekosistem, sınavlar) bantlı notlara dönüşür.
  - İç linkler bavul etiketi biçiminde.
  - Sonra SSS (bugünkü `<details>`), kapanışta zıplayan Puhu çıkartması, footer.
- Görünüm ve ölçüler canvas'taki "Ortak kâğıt kiti" panosunda; değerler `project/kit.css`'te.

### Sahneler

| Sayfa | Sahne | Canlı not / demo |
|---|---|---|
| Pomodoro | Odak odası: `STUDY_ROOM_BACKDROP_SRC` arka planları. Ev / Kütüphane / Kafe sekmeleri sahnenin içinde, buzlu cam. | `PublicPomodoroWidget` sahnenin içinde: halka kadran, 25/5 · 50/10 · Özel · Süresiz, Başlat/Sıfırla, ortam sesi. Köşede "ortam sesi" notu. |
| YKS / TYT / LGS | Plan odası görseli (`public/visuals/landing/room-plan.webp`: Puhu panoya plan iğneliyor). | `PlanDemoWidget` raptiyeli kareli notta. Başlık "abrakadabra, örnek bloklar hazır!" (mevcut `demo_scribble`), alan/dönem ve günlük süre çipleri, iki örnek blok. LGS'nin `#veli` notu kalır. |
| Yanlış defteri | Sabah masası: duvar, ahşap masa, "Yanlış Defterim" kapağı, "Bugün 2 tekrar" post-it'i, kitap yığınında okuyan Puhu (`desk-puhu-left/blink`, göz kırpar). | `NotebookDemoWidget` bantlı notta: rozet, ders, "1 / 3", soru, şıklar, Takıldım/Çözdüm, geri bildirim, "Kartı yeniden aç". |
| Ders çalışma uygulaması | Şafakta apartman: gökyüzü CSS ile, `city-mid` arkada, `city-facade` önde. Pencerelerde kâğıt etiketler: Puhu · Defter · Plan · Odak · Masa. | Etikete dokununca bantlı not o özelliği gösterir (başlık, gövde, varsa ilgili sayfaya etiket link). Varsayılan seçim: Plan. |

**Demolar yalnız yeni kıyafet giyer, davranışları değişmez (benim kararım, builder check sonrası).** Canvas'taki demolar kısaltılmış çizimdir. Kodda bugünkü davranış aynen kalır:
- `PlanDemoWidget`: üç grup (Alan/Dönem, Günlük süre, Vurgu), `buildDemoWeekPreview` yedi gün ızgarası, `demo_note` ve "Planımı kaydet" CTA'sı (`location="demo"`).
- `NotebookDemoWidget`: tek kart ve kendi CTA'sı.

Değişen yalnız görünüm:
- Not kâğıdı, raptiye ya da bant.
- Çipler ve bloklar kâğıt stilinde.
- Sahnenin içine ya da yanına yerleşim.

Ek kararlar:
- Canvas'taki "1 / 3" süs olarak bile kullanılmaz; sayfalama yokmuş gibi görünmesin diye kaldırılır.
- Telefonda yedi gün ızgarası notun içinde dikey akar.
- `study-program-lp-presets.spec.ts` değişmez.

Odak ve Defter etiketleri landing'in pencere haritasında yok. Burada yeni yerleşim olarak duruyorlar. Numaralar sadece bu sayfanın plakalarında kullanılıyor (NO 1, 3, 4, 5, 6).

### Metin

- **Değişen vitrin metinleri.** Canvas'taki önerilerin tamamı aşağıda; son hâli TR/EN JSON'a girer.
  - **Pomodoro:**
    - Vitrin: "Odanı seç, süreni kur, başla! **Kayıt yok, bekleme yok:** 25 dakika odak, 5 dakika mola, hepsi bu sayfada."
    - Karalama: "oda senin, süre senin!"
  - **YKS programı:**
    - Vitrin: "Günde kaç saatin var, hedefin ne? **Söyle, görevler günlere yerleşsin.** Örnek bloklar hemen yanında, bir dokun!"
    - Karalama: "alanını seç, bloklar gelsin!"
    - Örnek haftanın altında: "Eşit ağırlık veya sözel mi çalışıyorsun? Yukarıdan alanını seç!"
    - TYT ve LGS aynı tonda kendi vitrin cümlesini alır; bunu builder yazar, sahip onaylar.
  - **Yanlış defteri:**
    - Vitrin: "Takıldığın soru kaybolmasın! **Fotoğrafını çek ya da yaz, defterine koy.** Tekrar günü gelince soru yeniden önünde."
    - Karalama: "bu sefer çözersin!"
  - **Ders çalışma uygulaması:**
    - Vitrin: "Planın, odak seansın, yanlış defterin ve çalışma masan tek yerde. **Arkadaşların da hemen yanında!**"
    - Karalama: "bir odaya dokun!"
  - **Not adları (Caveat):** "cevap notu" türü küçük etiketler (canvas'taki "ortam sesi", "sınav yoldaşı", "TYT ve AYT dengesi", "kimler için?" …).
- **Canvas'ta çizilip yukarıda listelenmeyen metinler (benim kararım):** bölüm pill'leri ("Kısaca PuhuKoç"…), not adları, plakalar ve pencere notu link etiketleri. Hepsi canvas'taki hâliyle öneridir; son sözü builder söyler. Hepsi TR/EN JSON'a girer, yeni anahtarlar sayfanın kendi namespace'ine eklenir.
  - Link etiketleri bugünkü iç link metinlerini yeniden kullanır.
  - TYT/LGS vitrin cümleleri taslak olarak aynı PR'a girer. Sahip metin onayını PR incelemesinde verir; ayrı bir bekleme adımı yok.
- **Bugünkü subhead'lerin akıbeti:** bilgi taşıyan kısmı ("davetli pilot, bekleme listesi") kanıt satırında zaten var. Subhead'in yerini vitrin cümlesi alır.
- **Değişmeyenler:** H1, kanıt satırı (proof), cevap paragrafı, adım metinleri, tablo hücreleri, SSS, kapanış başlıkları ve gövdeleri, CTA metinleri, iç link metinleri.
- **Ton:** voice.md "Landing: enerjik Puhu". Sınav adları bir kez geçer. Pencere/ışık metaforu metinde yok; kapanıştaki mevcut "Işığın yanıyorsa…" kalır. Erişim kapısı ve KVKK ayrıntısı vitrine girmez.

## Benim kararlarım (sahip itiraz etmedi)

- Sabah/gündüz ışığı. Gece sadece landing'in girişinde kalır.
- Yeni görsel yok, landing'in hazır görselleri kullanılır. Yanlış defteri masası CSS/SVG ile çizilir; landing'deki `DeskBackdrop` (`WOOD_FINE`/`WOOD_BROAD`) ve defter kapağı yeniden kullanılabiliyorsa onlar tercih edilir.
- Dalgalanma için gerçek `usePaperFlutter` kullanılır (canvas'taki CSS taklit değil). Sadece fareyle hover'da ve dokunmatikte varışta bir kez çalışır, landing'deki gibi. Puhu'nun göz kırpması ve kapanıştaki zıplama CSS ile yapılır. Azaltılmış harekette hepsi durur.
- Kamera hareketi ve parallax yok.
- **Kod yapısı:** paylaşılan bir sayfa kabuğu + kâğıt parçaları.
  - Kabuk (`SeoLpShell` benzeri): nav, tema sarmalı, JSON-LD, footer, `NextIntlClientProvider`.
  - Kâğıt parçaları: `PaperNote`, `PostitSteps`, `NotebookTable`, `TagLinks`, `SceneFrame`. `landing-paper.tsx`'in yanında ya da `components/seo-lp/` altında dururlar.
  - Bugün dört dosyada tekrar eden JSX ve metadata kodu böylece tek yerde toplanır.
  - Program şablonu tek kalır.

## Builder'a bırakılanlar

- Dosya ve bileşen adları, CSS'in Tailwind sınıfı mı ayrı `.css` mi olacağı (landing bölümleri ayrı `.css` kullanıyor).
- Sahne görsellerinin AVIF/WebP boyutları ve `sizes`, telefon kırpımları.
- Etiket ve plaka ayrıntıları, eğim ve bant renk dağılımı (canvas referans).
- EN metinleri (TR'nin karşılığı, aynı ton).
- **Test:** her sayfa için en az bir e2e:
  - H1 görünür, sahne ve demo çalışır;
  - SSS JSON-LD sayfada;
  - azaltılmış harekette dalgalanma yok;
  - telefon genişliğinde yatay kaydırma yok.

  Bugün bu sayfaların e2e'si yok (`landing-performance.spec` sadece `/`'u ölçüyor).

## Açık (sahibe sorulacak)

- Kod turu hangi dalda yapılacak? Sayfalar şu anki `feature/APP-142-mobile-core-qa` dalında yok.
