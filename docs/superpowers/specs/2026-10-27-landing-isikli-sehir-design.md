# PuhuKoç landing · "Işıklı şehir" (sinematik kamera)

## Context
`/` bugün pazarlama sayfası değil. `apps/web/src/app/[locale]/page.tsx`, 4 slaytlık welcome slider'ı
(`_components/welcome/*`, `.onboarding-play-theme`) `noindex` olarak gösteriyor. Eski landing 0062'de silindi
(`docs/features/web-shell.md`: "future route TBD"). Kullanıcı Duolingo tadında, referanslara bağlı kalmayan,
yaratıcı bir landing istiyor. Görsel ve video promptlarını biz veriyoruz, sanatı kullanıcı üretiyor (ChatGPT
görsel, Kling video). Adımlar birlikte kararlaştırılıyor. Sonuç: indekslenen, hikaye anlatan ve kayda götüren
bir `/`.

## Güncellemeler (2026-10-28, tuval sürüm 19)
Bu bölüm aşağıdaki metnin önüne geçer.

- **Sanat:** Gerçek sanat yerleşti (L1–L4, I1–I6, 10 kariyer Puhu'su).
  - L3 cephesinde 8 pencere ve alt ortada kapı var.
  - Pencere eşlemesi:
    - üst sıra: Puhu · senin penceren · koç
    - orta sıra: plan · süs · masa
    - alt sıra: topluluk · kapı · analiz
- **Güven bandı kaldırıldı:** Şafaktan sonra sırasıyla koç bandı, SSS, kapanış ve footer gelir. `trust-band.tsx` yapılmaz. Blog'a nav ve footer'dan gidilir.
- **"Pencere" dili:** Yalnızca hikâyede kalır, bilgi ve butonlarda açık dil kullanılır.
  - **Hero:** "Bu gece ışığı yanan tek pencere seninki değil."
  - **Sayaç:** "Son 24 saatte {n} kişi burada çalıştı."
  - **Durak 7 butonu:** "Bu alanla başla"
- **Kartlar:** Pencereden düşmüş kâğıt notlar.
  - Çizgili, kareli ya da düz kâğıt, hafif eğim, renkli bant.
  - Mavi emaye kapı plakası, adı yalın (No 1 Puhu, No 2 Sen, No 3 Koç, No 4 Plan, No 6 Masa, No 7 Topluluk, No 8 Analiz).
  - Caveat el yazısıyla kenar notu.
  - Ürün arayüzü ataşla tutturulmuş küçük ekran olarak.
  - Alan seçici anahtar etiketi biçiminde.
- **Navigasyon:** Durak noktalarının yerine "PUHU APT." zil paneli gelir; bir zile basınca kamera o pencereye gider.
- **Ayrı koç sayfası** (`/koclar`, EN `/coaches`; tuvalde `Koclar` ve `KoclarPhone` panoları). Ana sayfadaki koç bandı kısa kalır. Nav'daki "Koçlar için", bandın "Koç sabahını gör" linki ve footer bu sayfaya gider.
  - **Ton:** "Sabah turu, aynı dünya." Aynı apartman sabah 07:00'de görünür. Kamera yok, katmanlar hafif paralaksla kayar.
  - **Pencereler:** Her pencerede öğrencinin dünkü durumunu gösteren kâğıt bir etiket asılı (✓ 2 seans, ! 3 gün sessiz, + boş koltuk). Sessiz öğrencinin penceresi karanlıktır. Telefonda etiketlerin yerini üç özet çipi alır.
  - **Hero:** "Dün gece kim çalıştı, bir bakışta gör." · "Koç olarak başla" (`/kayit?rol=koc`) · "Zaten hesabım var" · "İlk 3 öğrencin ücretsiz."
  - **Saatli duraklar** (her biri gerçek UI parçası taşıyan bir klipsli pano):
    - 07:30 "Bugün kime bakmalısın?": Koçun turu.
    - 07:45 "Bir haftayı tek bakışta oku.": 14 günlük şerit, seri, deneme, plan oranı, ruh hâli.
    - 08:00 "Haftayı birlikte kur.": Haftalık plan ve yapay zekâ taslağı.
    - 08:15 "Öğrencin içini rahatça döker.": Kilitli konuşma ve koçun gördüğü sinyaller (AI→koç güven çizgisi).
    - 08:30 "Davet koduyla bağlan.": Kod, 3 adım, koltuklar.
  - **Kapanış:** Koç SSS'si (onay, mevcut öğrenci, kaç öğrenci, gizlilik, AI'nın rolü), ardından "Sabah turun hazır." ve footer.
  - **Fiyat:** Yalnızca "İlk 3 öğrencin ücretsiz" geçer. Paket fiyatı ve ödeme kanalı yazılmaz.
  - **Kod turu notu:** Sayfa server render, indekslenir ve kendi FAQ JSON-LD'sini taşır. `fetchCoachSignupOpen` false ise CTA'lar gizlenir, bilgi kalır.

## Kararlar
**Kullanıcının kararları (2026-10-27):**
- Konsept **A · Işıklı şehir**: gece başlar, şafakla biter. Her pencere bir özellik, finalde ziyaretçinin penceresi yanar.
- `/` = landing ve indekslenir. "Ücretsiz başla" önce welcome slider'a (yeni adres `/hosgeldin`), sonra `/kayit`'a gider. Girişli kullanıcı panele.
- Sosyal kanıt: eşikli canlı sayaç, **"Son 24 saatte {n} pencere yandı."**
  - Sayılan: son 24 saatte tamamlanan ya da süren seansı olan tekil kişi. Terk edilen seanslar sayılmaz.
  - Eşik altında satır hiç görünmez.
- Çerez bannerı landing'de **kompakt** olarak çıkar: masaüstünde sol altta kart, telefonda alt panelin üstünde şerit.
- Blog bandı **başlıksız güven bandı** olur: "Resmi tarih ve süreçler doğrulanmış kaynaktan" ve tek bir "Blog'a göz at" linki. Yazı çekilmez.
- Ek parçalar: "Hangi pencere senin?" alan seçici · "Puhu'ya sor" mini demo (hazır cevap, canlı AI yok) · Koçlar için bant · SSS + güven bandı (blog linkiyle).
- Dil: **genel "sınav"**. KPSS adı hiçbir yerde geçmez.
- Hareket: **sinematik kamera**.
- Süreç: **önce tasarım tuvali**, sonra sanat, sonra kod.

**Benim kararlarım (itiraz edilebilir):**
- **Sabit sahne teması:** Landing'in kendi sahnesi var, işletim sisteminin koyu modunu izlemez.
- **Fiyat bölümü yok:** Fiyatlar placeholder. SSS ücretsiz ve Premium farkını sözle anlatır ve AI koçun Premium'da olduğunu açıkça söyler. Ücretsiz AI vaadi verilmez.
- **TR + EN** birlikte yazılır.
- **Ses tonu:** Gövde Puhu sesiyle konuşur. Demo cevabı, güven bandı ve ödeme/KVKK soruları yoldaş tonundadır (`docs/copy/voice.md`).
- **Fotoğraflı soru tanıtılmaz:** Web ekranı henüz yok.
- **Sinematik kamera = katmanlı 2.5D "multiplane"** (durağan katmanlar + CSS transform), Kling videosu değil. Gerekçe:
  - kaydırmaya birebir bağlanır,
  - hafiftir ve telefonda akıcı çalışır,
  - pencere içleri HTML olduğu için zoom'da keskin kalır.

  Kling yalnızca opsiyonel mikro döngüler için.

## Deneyim tasarımı
### Sahne katmanları (arkadan öne)
1. Gökyüzü: yalnız CSS, gece → alacakaranlık → şafak.
2. Yıldızlar ve ay: CSS/SVG. Ay gökyüzünde yay çizer ve ilerleme göstergesi olur.
3. L1 uzak silüet.
4. L2 orta şehir.
5. L3 Puhu apartmanı cephesi: üstünde DOM pencereleri, içlerinde I0–I6 görselleri.
6. L4 ön plan çerçevesi.

### Çekim listesi (kamera durakları)
| # | Kamera | Panel (taslak, Puhu sesi) | Etkileşim |
|---|---|---|---|
| 0 | Geniş açı: gece şehri, ay yüksekte, ışıklar hafifçe nefes alır | H1 + alt metin + "Ücretsiz başla" / "Zaten hesabım var" + "Son 24 saatte {n} pencere yandı." | CTA, "Hikayeyi atla" |
| 1 | Vinç inişi, Puhu'nun penceresine yaklaşma (I0) | "Aylarca tek başına çalışmak yorar. Burada her gece yanında biri var." | — |
| 2 | Pan, AI koç penceresi (I1), içeri giriş | "Zorlandığında koçun yanında." + 3 his çipi → hazır yoldaş cevabı + küçük adım kartı + Premium notu | Puhu'ya sor demo |
| 3 | Plan penceresi (I2) | "Bugün ne çalışacağın hazır." + mini "Bugünün yolu" | — |
| 4 | Masa penceresi (I3) | "Aynı masada, herkes kendi saatinde." + koltuk kartı (demo) | — |
| 5 | Topluluk penceresi (I4) | "Soru sor, el uzat, birlikte ilerle." + mini Haftalık lig (emek dili) | — |
| 6 | Analiz penceresi (I5) | "Denemelerin sana hikayesini anlatsın." + haftanın hikayesi kartı | — |
| 7 | Geri çekilme: cephe ve Puhu'nun yanındaki karanlık pencere (I6) | "Bu pencere boş. Senin olsun mu?" → seçimden sonra "{alan} Puhu'su hazır. Başlayalım mı?" | Alan seçici + CTA |
| 8 | Kamera göğe kalkar, ay batar, şafak söker | Kısa geçiş cümlesi (tuvalde) | — |

H1 taslakları (tuvalde seçilecek):
- "Bu gece çalışan tek pencere seninki değil."
- "Gece uzun, yol uzun. Yalnız değilsin."
- "Sınav yolunda ışığın yalnız yanmasın."

### Telefon
- Sahne 100svh yapışkan kalır, kamera keyframe'leri portre için ayrı tanımlanır.
- Pencere üst %60'ta durur, panel alt sheet olarak gelir (welcome sheet deseni, 28px köşe).

### Hareket azaltılmış
- Yapışkan sahne ve kamera yok. Her durak çerçeveli durağan bir pencere ve paneliyle alt alta dizilir.
- Gökyüzü düz renk bantlarıyla geceden şafağa geçer.
- DOM ve metin sırası aynı kalır, SEO etkilenmez.

### Sahne sonrası (normal akış, şafak paleti)
1. **Güven bandı** (yoldaş tonu):
   - "İçini döktüğün AI'da kalır. Koçun yalnızca neye ihtiyacın olduğunu görür."
   - "Resmi tarih ve süreçler doğrulanmış kaynaktan."
   - Tek bir "Blog'a göz at" linki. Yazı başlığı yok, veri çağrısı yok.
2. **Koçlar için:** Mürekkep mavisi bant (`--coach-accent`), `puhu-host.png` ve "Koç olarak başla".
3. **SSS** (yerel `<details>`, FAQ JSON-LD):
   - Ücretsiz mi?
   - AI koç ne yapar, ne yapmaz? (resmi bilgi uydurmaz, soru çözmez)
   - Hangi sınavlar?
   - Verilerim güvende mi?
   - Koçum varsa ne değişir?
   - Telefonda çalışır mı? (responsive web, uygulama vaadi yok)
4. **Final CTA + footer:** Şafak zemininde logo, Blog, Koç ol, yasal linkler ve dil seçimi.

### Navigasyon
- Yüzen menü: Logo · Nasıl çalışır (durak 1) · Koçlar için · Blog · SSS · Giriş yap · Ücretsiz başla.
- Telefonda menü: Logo + Giriş yap + CTA.
- "Hikayeyi atla" doğrudan durak 7'ye götürür.

## Teknik tasarım
### Rotalar
- **Landing:** `apps/web/src/app/[locale]/page.tsx` landing olur.
  - Server component, `robots index: true`, OG görseli şimdilik mevcut `img/brand/puhukoc-og-{tr,en}.png`.
  - Canonical, uygulamanın mevcut kuralını izler: Türkçe canonical, hreflang yok (`routing.ts:9` `alternateLinks: false`, `canonical-urls.spec.ts`). `/en` landing, `/en/blog` gibi ele alınır.
  - **Her istekte render (ISR yok).** Layout `revalidate = 0` (`[locale]/layout.tsx:33`), CSP nonce `headers()` ile okunuyor, proxy `no-store` gönderiyor (`proxy.ts:23-25`). Bu güvenlik kuralı korunur.
  - Bu yüzden hero hiçbir veriyi beklemez. Tek veri olan sayaç `<Suspense>` içinde akar ve yalnızca fetch düzeyinde `next: { revalidate: 300 }` önbelleği kullanır.
- **Çerez bannerı:** `web/lib/consent-banner-path.ts` ve spec'i (`:13`) `/`'i kapsayacak şekilde güncellenir.
  - Banner'ın landing'deki kompakt yerleşimi yalnızca o sayfaya özgü olur.
  - Telefonda banner açıkken alt panel yukarı kayar ve CTA'yı örtmez.
  - JSON-LD `<script>` nonce taşır (`knowledge/[slug]/page.tsx:145-153` deseni).
- **Kırılacak ve güncellenecek yerler:**
  - `apps/web/e2e/routing.spec.ts:33` (`/` sitemap'te değil) ve `:43-49` (`/` noindex).
  - `apps/web/scripts/qa-performance-baseline.mjs:14` (`/`'i "welcome" diye ölçüyor).
  - `docs/features/web-shell.md:43-44,62`.
  - `href="/"` ve `router.replace("/")` kullanan yerler (public-chrome, blog-shell, hesap silme sonrası) artık `/giris` yerine landing'e düşer. Bu kabul edilebilir.
- **Slider:**
  - Yeni sayfa `apps/web/src/app/[locale]/welcome/page.tsx`. `routing.ts`'e `"/welcome": { tr: "/hosgeldin", en: "/welcome" }` eklenir.
  - Bileşenler yerinde kalır (`_components/welcome/*`).
  - `welcome-guard.tsx`'te "görüldüyse → `/login`" kuralı "görüldüyse → `/signup`" olur.
- **Diğer:**
  - `sitemap.ts`'e `/` eklenir.
  - `route-message-scopes.json`'a `landing` kapsamı eklenir.
  - `e2e/onboarding-redesign.spec.ts` `/hosgeldin`'e taşınır.

### Yeni dosyalar: `apps/web/src/app/[locale]/_components/landing/`
Her dosya en fazla ~250 satır olur.
- `landing-page.tsx`: Server tarafında bölüm sırasını kurar.
- `landing-nav.tsx`, `landing-footer.tsx`.
- `city-stage.tsx`: Client. Yapışkan sahne, katmanlar, rAF yazıcısı.
- `city-camera.ts` + `city-camera.spec.ts`: Saf fonksiyonlar `cameraAt(progress, keyframes)`, `stopAt()`, easing. Manzara ve portre için ayrı keyframe tabloları.
- `city-windows.ts`: Pencere haritası (cephe görseli üzerinde % koordinat) ve durak → pencere eşlemesi.
- `stop-panel.tsx`, `window-demos.tsx`: Statik demo UI'lar (yol, koltuk, lig, hikaye). Yalnızca panel tokenları kullanılır, veri hook'u import edilmez.
- `ask-puhu-demo.tsx`, `career-window.tsx`: Client adaları.
- `landing-counter.tsx`: Sunucuda render edilir. `null` gelirse hiçbir şey çizmez.
- `trust-band.tsx` (blog linki dahil), `coach-band.tsx`, `landing-faq.tsx`.
- `landing-auth-redirect.tsx`: Client, görünmez. `useAuth()` authenticated dönerse `router.replace(postAuthDestination(user))` çağırır. Sayfa auth'u beklemez. Girişli kullanıcı kısa bir an landing'i görebilir, çünkü web alanında sunucu tarafında bir oturum sinyali yok (refresh cookie API'de ve httpOnly).
- `start-link.tsx`: Varsayılan href `/welcome`. Tıklanınca `isWelcomeSeen()` ise `/signup`'a gider.

### Kamera motoru
- Yükseklik yaklaşık durak sayısı × 120svh. İçinde 100svh yapışkan bir sahne var.
- Kaydırma yerli kalır, tekerlek ele geçirilmez. `scroll-snap-type: y proximity` tuvalde denenecek.
- Kaydırma başına tek rAF yazımı yapılır, `welcome-carousel.tsx`'teki `writeProgress` deseni kullanılır. Yazılan değişkenler `--cam-x`, `--cam-y`, `--cam-z` ve `--sky`.
- `data-stop` yalnızca durak sınırlarında değişir, her karede React render'ı olmaz.
- Katmanlar `translate3d(calc(var(--cam-x) * var(--depth)), …) scale(…)` ile hareket eder. `will-change` yalnızca 4–5 katmanda.
- Pencere çerçeveleri CSS olduğu için keskin kalır. İçler `next/image` ile gelir: geniş açıda küçük varyant, bir durak önceden büyük varyant.
- Maksimum zoom yaklaşık 2.5×. Kenarlardaki cephe yumuşaması alan derinliği gibi kabul edilir (tuvalde kontrol).
- Panel içinde `focusin` olursa sayfa o durağın bekleme noktasına kayar. Klavye kullanıcısı görünmeyen bir panelle etkileşmez.
- Hareket azaltma: `useReducedMotion` (framer-motion zaten var) + CSS media sorgusu.
- **Yeni bağımlılık yok.**

### Veri
- **Sayaç ucu:** `GET /v1/coaching/public/pulse` → `{ litWindows: number | null }`.
  - Public uçlar kendi modüllerinin altında duruyor, `/v1/public/*` diye bir yer yok. `docs/standards/api.md:145` güncellenir.
  - Modül: W2 coaching (`study_sessions`'ın sahibi).
  - Erişim: ayrı controller, sınıf düzeyinde `@Public()` + `@Throttle` (`economy/presentation/invite-preview.controller.ts:16-23` deseni).
  - **RLS:** `study_sessions` kullanıcı bazlı RLS'li. Sorgu `withServiceContext` içinde çalışmazsa sayı hep 0 döner. Kopyalanacak örnek `coaching/infrastructure/cohort-evidence.repository.ts:63-79` (İstanbul gün kesimi de orada).
  - Hesap: `count(distinct user_id)`, `started_at >= now() - interval '24 hours'` ve `status in ('COMPLETED','IN_PROGRESS')`.
  - `ponytail:` personel/QA hesapları ayıklanmaz. Eşik 30'un üstünde bunlar yuvarlama hatası kadar. Gerçek kullanıcı sayısı küçükken fark ederse rol filtresi eklenir.
  - Eşik: `config.catalog.ts:154-166` `coachingCount` ile bir `coaching.*` sayısal anahtarı (karar: 100). Altındaysa `null` döner.
  - Web ucu sunucuda fetch düzeyinde `revalidate: 300` ile çağırır. Hata olursa `null` gelir ve satır gizlenir.
  - `ponytail:` API'de önbellek yok, çünkü fetch önbelleği çağrıyı 5 dakikaya bir sınırlıyor. Tablo büyürse `started_at` indeksi eklenir.
  - Service spec iki şeyi test eder: eşik ve zaman penceresi.
- **Blog:** Veri yok. Güven bandı yalnızca `/blog`'a link verir.

### Alan seçimini onboarding'e taşıma
- Seçici, seçimi `localStorage` içinde `mentor_landing_career` anahtarına yazar. Yardımcı `src/lib/landing-career.ts` (try/catch + küçük spec).
- `field-step.tsx` değişmez, çünkü `initial` prop'unu zaten `useState`'e kopyalıyor (`:36,45`).
- Değer wizard'ın `summary.careerGroup` alanına tohumlanır (`onboarding-wizard.tsx:43`, `:136`'da aktarılıyor). Yalnızca `CAREER_GROUPS` içindeki değerler kabul edilir (`packages/types/src/coaching.ts:649-660`).
- Değer `onSaved`'de (`:139`) ve wizard bittiğinde temizlenir. Koç akışı alan adımını atladığı için (`onboarding-flow.ts:28`) wizard sonunda da temizlenmesi gerekiyor.

### Koç bandı
- `/koc-ol` `OnboardingGuard` arkasında (`(onboarding)/layout.tsx:25`), hesabı olmayan ziyaretçi açamaz.
- Bu yüzden CTA kayıt sayfasının mevcut koç girişine gider: `{ pathname: "/signup", query: { rol: "koc" } }`. Kayıt koç olarak açılır ve koç onboarding'i gelir (`(auth)/signup/page.tsx:28-46`).
- `fetchCoachSignupOpen` false dönerse bant gizlenir (`web/lib/coach-signup.ts:11-20`).

### Tema ve tokenlar
- `packages/ui/src/theme.css` içinde scoped `.landing-city-theme` tanımlanır: gök durakları (gece/alacakaranlık/şafak), pencere ışığı ve frost panel.
- Uygun olan yerde mevcut `--play-window-*` tokenları kullanılır. CTA mevcut `--play-cta*` ledge'i.
- DESIGN.md'ye yeni bölüm: §8.8 "Landing · Işıklı şehir".

### Metin ve i18n
- Metinler `apps/web/messages/{tr,en}.json` içinde `landing.*` altında.
- `docs/copy/voice.md`'ye "Landing" satırı eklenir: chrome Puhu sesinde. Demo cevapları, güven ve ödeme/KVKK yoldaş tonunda.
- Kurallar: sen dili, em dash yok, cümle başına en fazla bir "!", "lütfen" yok, "X değil Y" açılışı yok, arkasında veri olmayan sayı yok.

### SEO
- Başlık ve açıklama genel "sınav" diliyle.
- Tek h1.
- Hikaye metninin tamamı DOM'da ve sıralı.
- FAQ JSON-LD.

### Performans bütçesi
- **LCP:** Hero için önceden birleştirilmiş tek görsel, `priority` ile. AVIF/WebP, yaklaşık 150KB masaüstü, 90KB telefon.
- **Katmanlar:** İlk boyamadan sonra yüklenir. Kamera, katmanlar decode edilince devreye girer. Hero görseli ilk kare olduğu için sıçrama olmaz.
- **İç mekânlar:** Lazy yüklenir (±1 durak).
- **Bütçe kontrolü:** `apps/web/scripts/check-web-performance-budgets.mjs:13-40`'a `/` için JS girdileri eklenir (`server/app/[locale]/page_client-reference-manifest.js`, `page/build-manifest.json`) ve bir `landing` mesaj kapsamı limiti tanımlanır.
- Hikaye metni sunucuda render edilir. Böylece istemci mesajlarına yalnızca adaların metinleri girer.
- Script LCP'yi ve görsel ağırlığını ölçmez. Onlar `web-perf` ile ayrıca ölçülür.

### Erişilebilirlik
- Panellerde AA kontrast.
- Görünür odak halkası.
- Dekoratif katmanlarda `aria-hidden`.
- Atlama linki.
- Alan seçici radyo grubu.
- Demo cevabı `aria-live` ile duyurulur.

## Sanat listesi ve üretim hattı
**Üretim hattı:**
1. ChatGPT'den PNG alınır. Alfa gereken katmanlar `#FF00FF` zemin üzerinde üretilir.
2. `apps/web/scripts/key-alpha.mjs` ile zemin çıkarılır.
3. İki genişlikte WebP/AVIF'e çevrilir.
4. Dosyalar `apps/web/public/visuals/landing/` altına gider.
5. Pencere haritası son cephe görselinden ölçülür.

Gökyüzü, yıldızlar, ay, güneş ve şafak CSS/SVG ile yapılır, sanat gerekmez.

| ID | Ne | Boyut | Alfa | Durum |
|---|---|---|---|---|
| L1 | Uzak silüet | 1536×1024 → 2× | evet | yeni |
| L2 | Orta şehir | 1536×1024 → 2× | evet | yeni |
| L3 | Puhu apartmanı cephesi (3×3 pencere, üst orta karanlık) | 1024×1536 → 2× | evet | yeni |
| L4 | Ön plan çerçevesi | 1536×1024 → 2× | evet | yeni |
| I0 | Puhu masada | `visuals/onboarding/welcome-scene-4-start.webp` kare kırpım | — | var |
| I1–I5 | AI koç · Plan · Masa · Topluluk · Analiz iç mekânları | 1024×1024 | hayır | yeni |
| I6 | Boş oda ("senin penceren") | 1024×1024 | hayır | yeni |
| C1–C2 | Kariyer Puhu'ları, 2 sayfa × 5. Mevcut `career-3d` 320px ve beyaz zeminli, pencereye yetmiyor | 1536×1024 | evet | yeni |
| — | Koç bandı Puhu'su | `mascot/puhu/puhu-host.png` | — | var |
| K1 | (opsiyonel) Kling döngüsü: I0'da göz kırpma + sayfa çevirme, 5 sn | 720p | — | sonra |

Promptların taslağı Ek A'da. Son hali, kompozisyon tuvalde onaylandıktan sonra tuvaldeki prompt sayfasında olacak.

## Çalışma sırası
**Tur 1 · Tasarım tuvali** (onaydan sonra ilk iş, repoya kod yazılmaz):
1. Bu planın deneyim ve teknik kısımları `docs/superpowers/specs/2026-10-27-landing-isikli-sehir-design.md` olarak kaydedilir.
2. Artifact akışı: önce `quickstart` (intent "design"), sonra `artifact-design` skill'i. Tek HTML tuval scratchpad'de tutulur ve uzun yol (`C:\Users\emreerkesikbas\...`) ile yayınlanır, çünkü 8.3 yolu reddediliyor.
3. Tuval sayfaları:
   1. **Sinematik prototip:** Masaüstü/telefon ve hareket azaltma anahtarları, 9 durak, gerçek TR metin.
      - Yer tutucu katmanlar mevcut `welcome-scene-4-end.webp`'ten CSS ile kırpılır, ön plan basit SVG.
      - Pencere içleri mevcut Puhu pozlarıyla doldurulur.
   2. Hero başlığı için 3 varyant.
   3. Çalışan Puhu'ya sor demosu ve alan seçici.
   4. Sahne sonrası bölümler.
   5. Görsel promptları (kopyalanabilir) ve cephe kompozisyon kılavuzu.
4. Kullanıcı inceler. Kararlar `landing-redesign-direction` memory'sine yazılır.

**Tur 2 · Sanat:** Kullanıcı üretir. Ben alfayı çıkarır, dönüştürür ve pencere haritasını ölçerim. Tuval gerekirse gerçek sanatla güncellenir.

**Tur 3 · Kod durakları:**
- **A. Rota ve iskelet:**
  - landing iskeleti (SSR, metadata, sitemap),
  - auth yönlendirme,
  - nav/footer,
  - `landing.*` i18n,
  - slider `/hosgeldin`,
  - e2e güncellemesi.
- **B. Kamera sahnesi:**
  - katmanlar, keyframe motoru + spec, paneller, telefon, hareket azaltma,
  - önce yer tutucu sanatla, sonra gerçek sanatla.
- **C. Etkileşim adaları:** Puhu'ya sor demo, alan seçici ve onboarding'e taşıma.
- **D. Veri ve alt bölümler:**
  - sayaç ucu (W2) + sayaç satırı,
  - güven bandı, koç bandı,
  - SSS + JSON-LD,
  - landing'de kompakt çerez bannerı.
- **E. Cila:**
  - performans bütçesi, a11y, `e2e/landing.spec.ts`,
  - docs: `docs/features/web-shell.md` zaman çizelgesi, DESIGN.md §8.8, `voice.md`.

Geliştirme sırasında yalnızca ilgili spec'ler çalıştırılır (`pnpm --filter @mentor/web exec vitest run city-camera`, API için `pnpm --filter @mentor/api exec vitest run <spec>`). Tam suite + lint + typecheck PR'dan önce bir kez.

## Doğrulama
- **Tuval:** Kullanıcı onayı.
- **Birim testleri:**
  - `city-camera.spec.ts`: keyframe ara değerleri, durak sınırları.
  - `landing-career` spec'i.
  - API pulse service spec'i: eşik, 24 saat penceresi ve terk edilen seansların sayılmaması.
- **Playwright `landing.spec.ts`:**
  - hero metni görünür,
  - CTA `/hosgeldin`'e, slider görülmüşse `/kayit`'a gider,
  - girişli kullanıcı panele gider,
  - hareket azaltmada statik düzen gelir,
  - alan seçimi onboarding'de seçili gelir,
  - eşik altında sayaç görünmez. Fetch sunucu tarafında olduğu için `page.route` onu yakalayamaz. Sunucu fixture'ı kullanılır (`apps/web/playwright.question-ads.config.ts:13-18` deseni).
- **Mevcut testler:** `onboarding-redesign.spec.ts` yeni rotayla yeşil olmalı.
- **Tarayıcıda prod build ile** (dev server yanlış kırmızı veriyor):
  - 375/768/1024/1440 ekran görüntüleri,
  - kaydırma boyunca kare hızı (Performance paneli),
  - LCP (`web-perf` + `check-web-performance-budgets.mjs`),
  - OS koyu modunda sahnenin aynı kalması,
  - 375px'te çerez bannerı açıkken CTA'nın görünür kalması.

## Açık konular
Şunlar 2026-10-28'de kapandı (tuval sürüm 21):
- **Hero başlığı:** "Bu gece ışığı yanan tek pencere seninki değil." Diğer iki varyant kod turuna girmez.
- **Alt metin:** "Günlük bir plan, aynı saatlerde çalışan arkadaşlar ve Premium'da seni tanıyan bir yapay zekâ koç. Yolu birlikte yürüyelim." Ücretsiz parçalarla başlar, çünkü hemen altında "Ücretsiz başla" var.
- **Demo notu:** "Bu bir örnek cevap. Yapay zekâ koç Premium'da." Deneme süresi yazılmaz; web satın alma kanalı bayrakla kapalı.
- **Sayaç eşiği:** 100. Küçük sayılar zayıf okunur. Değer config'de, deploy etmeden değişir.
- **Şehir silüeti:** İstanbul görünümü kalır, metinde şehir adı geçmez.
- **Branch:** Kod turu mevcut branch'te (`master`) yapılır.
- **Sanat sırası:** Kod turu sanatı beklemez. L3'ün 2× büyütülmüş hâli ve "Henüz karar vermedim" için oturan Puhu geldiğinde yalnızca görsel dosyaları değişir.

Hâlâ açık:
- OG görselinin gece şehriyle yenilenmesi (sonra).

## Ek A · Görsel promptları (taslak)
**Her prompta eklenecekler:**
- Referanslar: `apps/web/public/visuals/onboarding/welcome-scene-4-end.webp` (şehir), `welcome-scene-4-start.webp` (pencerede Puhu), `apps/web/public/mascot/puhu/puhu-default.png`.
- Stil bloğu:
  > Soft 3D stylized render in the exact style of the attached references: cozy miniature-diorama look, matte clay and plush materials, warm amber window light against a deep navy night, soft bloom, gentle depth of field. Mascot Puhu exactly as in the reference: a round fluffy white cloud-like owl, big round navy-blue glasses, small light-blue ear tufts and wing tips, a tiny light-blue heart on the chest, pink blush, small yellow beak. No text, no letters, no numbers, no logos, no watermark.
- Alfa bloğu (L1–L4, C1–C2):
  > Put everything on a perfectly flat pure magenta background (#FF00FF). No shadow, glow or haze on the magenta. Crisp edges.

**Katmanlar:**
- **L1:** A wide, far-distance city skyline at night seen from a hilltop: low-detail navy silhouettes of apartment blocks, a few domes and a long bridge over a calm bay, hundreds of tiny warm lit windows, a few strings of distant lights on the water. Buildings occupy only the lower 40% of the frame; everything above the roofline is the magenta background (the sky is added separately). Landscape 1536×1024.
- **L2:** Mid-distance rows of cozy 3–5 storey apartment buildings with rounded rooftops, chimneys, rooftop plants and small balconies; navy and slate-blue walls; many warm lit windows, a few with tiny owl silhouettes reading at a desk. Buildings fill the lower 60%; above the roofline is the magenta background. Landscape 1536×1024.
- **L3:** Straight-on front view of one charming 3-storey apartment building, the hero of the scene: navy-blue walls with soft rounded edges, a small balcony with plants on the second floor, a chimney and a little TV antenna on the roof. Exactly 9 large windows in a clean 3×3 grid, evenly spaced, all the same size, rectangular with softly rounded corners. Eight windows glow with warm empty light, curtains tied at the sides, nothing inside (no characters, no furniture). The top-middle window is completely dark and unlit. Minimal perspective so every window stays a clean rectangle. Portrait 1024×1536.
- **L4:** Foreground framing for a night city scene, seen very close: bottom-left, the corner of a rooftop with a chimney, potted plants and a warm string of fairy lights; bottom-right, leafy tree branches in deep shadow with a few glowing fireflies. The centre and top of the frame are empty magenta background. Landscape 1536×1024.

**İç mekânlar.** Hepsi bu ortak ön ekle başlar:
> Square 1024×1024. The view into one cozy study room at night as if looking through a window, but do not draw the window frame. Warm desk-lamp light, bookshelves, a plant. Puhu is the main character, clearly readable even when the image is shown small.

- **I1 AI koç** (`mascot/puhu/coach-hero.png` de eklenir): Puhu wears the coach outfit from the reference (royal-blue cape with tiny gold stars and a gold star clasp). He sits at the desk and leans kindly toward a glowing laptop; three soft blank speech bubbles float above the screen. Calm, encouraging mood.
- **I2 Plan:** Puhu stands at a cork board and pins the last of four round, colourful sticker dots joined by a dotted path; beside it a paper calendar with a few green check marks; a cup of tea on a tidy desk. Focused and cheerful.
- **I3 Masa:** A round wooden study table shared by Puhu and three other owls of the same kind, each with one small accessory (a beanie, a scarf, a pencil behind the ear). Everyone studies quietly with their own small hourglass and books; one lamp in the middle of the table. Nobody talks; a calm library feeling.
- **I4 Topluluk:** A small group of owls like Puhu cheering kindly for one owl who holds up a little golden star badge; a paper pennant garland, a few pieces of confetti, a cork board full of sticky notes and hand-drawn hearts. Warm and celebratory, not competitive.
- **I5 Analiz:** Puhu at a small chalkboard with a simple hand-drawn bar chart and a gently rising line, holding a piece of chalk; a stack of practice-test papers with green check marks on the desk and a magnifying glass. Calm and curious.
- **I6 Boş oda:** The same kind of room but empty: a desk with a closed laptop, a lamp that has just been switched on, an empty chair waiting, a plant. Leave the centre of the image free for a character added later. No owl in this image.

**Kariyer sayfaları:**
- **C1–C2** (referans: `mascot/career-3d/*.webp` kolajı ya da orijinal kariyer referans sayfası): Character sheet: 5 versions of Puhu in one row, the same seated front-facing full-body pose, evenly spaced, no overlap, each dressed for one field exactly like the attached reference. Sheet 1: eğitim, fen, hukuk_kamu, işletme, mimarlık. Sheet 2: mühendislik, sağlık, sanat_tasarım, sosyal_iletişim, yazılım. Landscape 1536×1024.

**Kling (opsiyonel):**
- **K1:** Başlangıç ve bitiş karesi I0'ın kare kırpımı. Prompt:
  > Puhu blinks slowly and turns one page of the book; the lamp light flickers softly. Static camera, seamless loop, 5 s.
- Ücretsiz Kling çıktısındaki filigran kırpılır.
