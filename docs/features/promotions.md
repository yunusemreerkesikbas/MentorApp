# Promotions — kupon, kampanya ve otomatik indirim

> Ticari fiyat kaldıracı. Tek motor; hoş geldin kuponu, dönemsel kampanya, aktivite ödülü ve
> geri kazanım aynı kural motorunun birer kural tipi.

## Ürün sınırı

- **Tek promosyon uygulanır.** Stacking yok — en yüksek indirim kazanır. Birleştirme bir öncelik
  modeli ister ve "ilk ay X, sonra Y" yasal açıklamasını belirsizleştirir.
- **Yalnız web checkout.** App Store / Play fiyatı store'da tanımlıdır; sunucu müdahale edemez.
  IAP Faz 2'de gelirse kupon o yolda **uygulanmaz** (roadmap:742 hibrit kararı hâlâ açık).
- **Uydurma indirim hâlâ yok.** Değişen kural: *gerçek* bir promosyon indirimi üstü çizili
  gösterilebilir. Hiç var olmamış bir "eski fiyat" uydurmak hâlâ yasak.
- **İndirim e-postası yok** ve yakın planda da yok. TR'de ticari elektronik ileti sayılır: İYS
  kaydı + açık onay + ret hakkı gerekir, kodda hiçbiri yok (pazarlama/işlem ayrımı yok, onay
  kolonu yok, unsubscribe yok, Postmark `MessageStream` sabit). Ayrı bir altyapı işi.
- **Toplu "indirim kazandın" fan-out'u yok.** Uygunluk canlı hesaplanıyor (grant tablosu yok), yani
  "kimler uygun?" her kural tipi için ayrı ters sorgu ister. Keşif sorununu TopBanner çözüyor:
  kullanıcının kendi oturumundaki hesaplamaya biniyor.
  **Tek istisna geri kazanım**, ve tarama olmadığı için istisna: `SUBSCRIPTION_EXPIRED` olayı tek
  kullanıcı getiriyor, onun için tek `resolveOffers` çağrılıyor. Uygulamayı artık açmayana ulaşan
  tek yüzey (bkz. [notifications.md](./notifications.md)).
- **"Kampanya bitiyor" hatırlatması yok** — ticari olarak en güçlü bildirim, ama
  [`docs/copy/voice.md`](../copy/voice.md) kayıp-kaçınma/FOMO'yu yasaklıyor.
- Bu sürümde yok: sepet-terk e-postası (iyzico'ya bağımlı — `fake` sağlayıcı `INCOMPLETE` satır
  üretmiyor), kullanıcı bazlı hatalı-kod kilidi.

## Mimari

Bağımlılık **tek yönlü**: `PaymentsModule → PromotionsModule` ve `PaymentsModule → CoachingModule`.
Promotions, payments'ın (`plans`, `subscriptions`) ya da coaching'in (`daily_activity`) tablolarını
**hiç okumaz** — kural için gereken her sinyali çağıran taraf verir. Döngü yok: `CoachingModule`
yalnız `[ContentModule, IdentityModule]` import ediyor, payments'a bağımlı değil.

Çalışılmış günler **tembel** gelir: `resolveOffers`'a `activeDates(windowDays)` thunk'ı geçilir ve
yalnız canlı bir `ACTIVE_DAYS` kuralı varsa, çağrı başına **en fazla bir kez** çalışır. Checkout para
yoludur; `ACTIVE_DAYS` promosyonu olmayan bir katalog bu sorgunun bedelini ödemez. Sinyalin kaynağı
`StreakService.listActiveDatesSince()` — içi mevcut `DailyActivityRepository` çağrısı, sıfır yeni
sorgu. "Çalışılmış gün" = seri mantığıyla aynı: ≥1 tamamlanmış seans **veya** ≥1 biten görev;
salt ziyaret değil (roadmap §3, farmlanabilirlik).

```
promotions/
  domain/       promotion-price.ts   computeDiscount()  [SAF]
                promotion-rule.ts    evaluateRule() · countDatesWithin()  [SAF]
  application/  promotions.service.ts   resolveOffers · reserve · markApplied
                                        consumePeriod · voidForSubscription · admin CRUD
  infrastructure/ promotion.repository.ts · promotion-redemption.repository.ts
```

### Tablolar

| Tablo | Rol |
|---|---|
| `promotions` | Tanım. `code` **nullable**: dolu = kullanıcı yazar, boş = otomatik uygulanır. |
| `promotion_redemptions` | Kullanım defteri. Üç fiyat kolonu **kopyalanır, referans verilmez**. |

`plans.price_minor` admin'den `PATCH /v1/admin/plans/:id` ile değişebiliyor. Kullanıcının ön
bilgilendirme formunda onayladığı toplam bedel sonradan değişemez (TKHK) — bu yüzden redemption
satırı `list_price_minor` / `discount_minor` / `charged_price_minor` üçlüsünü donduruyor.

Durum akışı: `RESERVED` (checkout) → `APPLIED` (`checkout_completed` webhook'u) → gerekirse
`VOIDED` (terk edilmiş INCOMPLETE checkout, kotayı serbest bırakır). `periods_remaining` her
başarılı tahsilatta azalır; 0'a inince sonraki yenileme liste fiyatından.

### Fiyatın tek noktası

`computeDiscount()` bir kez yuvarlar (`Math.round`) ve iki kez kırpar:
1. `promotions.max_percent` tavanı — **FIXED indirimi de** kırpar, yoksa admin türü değiştirerek
   tavanı atlatabilirdi.
2. `MIN_CHARGE_MINOR` (1,00 ₺) tabanı — tahsil edilen tutar asla 0 olamaz. Bu, `issueInvoiceSafely`
   içindeki `if (!amountMinor) return;` dalını indirimli abonelikler için **erişilemez** kılar;
   0 ₺'lik bir tahsilat e-Arşiv faturasını sessizce atlardı.

Değişmez: `charged + discount === list`, hem TS'te hem DB CHECK'inde.

### Kotalar iki kez değerlendirilir

`resolveOffers` **tavsiye** verir (UI'ı besler), `reserve` **karar** verir — checkout
transaction'ı içinde, kilitler altında. Ads modülünün `getRewardOffer` / `createRewardSession`
ayrımının aynısı.

Kilit sırası her yerde **promosyon → kullanıcı**, bu yüzden eşzamanlı rezervasyonlar deadlock
olamaz. Promosyon kilidi global kotayı güvenli kılan şeydir: iki *farklı* kullanıcı son kontenjanı
yarışsaydı ikisi de `used = max - 1` okuyup commit ederdi.

## API

| Yöntem | Yol | Not |
|---|---|---|
| `POST` | `/v1/subscription/offers` | Plan başına indirimli fiyat. `{ code? }` — kodsuz çağrı otomatik teklifi verir. `@Throttle` 20/dk. |
| `POST` | `/v1/subscription/checkout` | `{ planId, code? }`. Kod tutmazsa **hata verir**, sessizce liste fiyatına düşmez. |
| `GET` | `/v1/admin/promotions` | `@Roles(FINANCE)` + audit. |
| `GET` | `/v1/admin/promotions/:id` | |
| `POST` | `/v1/admin/promotions` | `promotion.create` audit. |
| `PATCH` | `/v1/admin/promotions/:id` | `promotion.update` audit. Silme yok — `isActive: false`. |

Kod yalnız **aktif** satırlar arasında tekil (`lower(code)` üzerinde kısmi unique index), yani
durdurulmuş bir kampanyanın kodu sonradan yeniden kullanılabilir.

## Konfigürasyon ve açılış

| Anahtar | Varsayılan | Not |
|---|---|---|
| `promotions.enabled` | `false` | Global kill switch. Kapalıyken her checkout liste fiyatını öder. |
| `promotions.max_percent` | `50` | Admin ne girerse girsin tavan. Her iki indirim türünü de kırpar. |
| `promotions.max_discount_periods` | `1` | **Kaç tahsilata indirim uygulanabileceğinin tavanı.** |

`promotions.max_discount_periods` neden 1: `applies_to_periods` kolonu ve admin formu N dönemi
baştan destekliyor, ama bugün hiçbir sağlayıcı onurlandıramıyor — iyzico adaptörü stub
(`PAYMENTS_PROVIDER=disabled` prod'da). Adaptör çok dönemli intro fiyatı destekleyince **tek config
değişikliğiyle** açılır; şema, admin UI, defter ve fatura metni değişmez.

Açılış sırası: migration → `promotions.enabled = true` → admin `/promotions`'tan kampanya.
**Gotcha:** katalog varsayılanını değiştirmek mevcut DB override'ını ezmez — var olan ortamlarda
anahtarı yeniden kaydetmek gerekir (ads modülüyle aynı tuzak).

## Kampanya duyurusu iş akışı

Promosyon modülünün kendi fan-out'u **yok** (yukarıdaki gerekçeler). Bir kampanyayı duyurmak
gerektiğinde mevcut duyuru sistemi kullanılır:

1. FINANCE admin `/promotions`'tan promosyonu oluşturur ve yayına alır.
2. SUPER_ADMIN `/announcements`'tan duyuruyu yazar — hedef kitle (`ALL` / `EXAM_TYPE`),
   zamanlama ve alıcı sayısı hepsi hazır. `linkUrl: "/abonelik"` verilir.
3. Duyuru `SYSTEM` kategorisinde uygulama içi bildirime düşer: zil rozeti, SSE ile canlı,
   çekmecede satır, tıklayınca abonelik ekranı. **Sıfır ek kod.**

Rollerin ayrı olması bilinçli: promosyon fiyat işidir (FINANCE), toplu duyuru iletişim işidir
(SUPER_ADMIN). Promosyon formuna "duyur" kutusu koymak bu sınırı delerdi.

## Geliştirmeler (timeline)

- **Kampanya modalı başka bir modalın üstüne binmiyor (2026-09-02)** — Panel açılışta birden fazla
  tek-seferlik yüzey tetikliyor: mood check-in (`dialog-panel`), seviye kutlaması
  (`journey-spotlight-scene`) ve kampanya modalı. Hiçbiri diğerini bilmiyordu, üçü üst üste
  biniyordu. Çözüm tek yönlü: **ticari olan geri çekiliyor** — `PromotionDialog` göstermeden hemen
  önce ekranda `[role="dialog"][aria-modal="true"]` var mı diye bakıyor, varsa hiç açılmıyor.
  Geri çekilmek kampanyayı **görülmüş saymıyor**, yani tek gösterimi harcanmıyor, bir sonraki
  ziyarete kalıyor. DOM'a bakıyor, modal kaydına değil: her modal zaten bu iki niteliği taşıyor,
  senkronda tutulacak ayrı bir liste yok (`ponytail:` notu dosyada).
  Geçerlilik damgası tek cümleye indi ve soluklaştı: "30 Eylül tarihine kadar geçerli",
  `--color-secondary`. Ayrı `GEÇERLİLİK` etiketi ve `validity_label` anahtarı kaldırıldı.
  İlgili: `promotion-dialog.tsx`, `promotion-card.tsx`, `messages/{tr,en}.json`.

- **Şerit kampanyayı devralıyor, küp dönüşü (2026-09-02)** — `pickBannerPromotion` artık kodlu
  kampanyaları da (`offers.available`) dikkate alıyor ve önceliği `pickPromotionForDialog` ile
  aynı: kupon önce, otomatik indirim sonra. Önceden kodlu kampanya bilerek dışarıda bırakılmıştı,
  sonuç olarak **modal kapatılınca kampanya tamamen kayboluyordu**; artık şeritte duruyor. Şerit
  CTA'sı da kodu `openPaywall({ code })` ile devrediyor, modaldaki davranışın aynısı.
  TopBanner geçişi küp yüzü gibi dönüyor: sabit yükseklikli, `perspective` verilmiş bir sahne
  içinde iki yüz aynı anda mutlak konumlu duruyor (`AnimatePresence` "sync"), çıkan yüz üst
  kenardan devriliyor, giren yüz alttan geliyor. `useReducedMotion` açıkken sadece opaklık.
  Gotcha: migration `0092_promotion_copy` geliştirme veritabanına uygulanmadan
  `POST /v1/subscription/offers` **500** dönüyor — repository satırın tüm kolonlarını seçtiği için
  `eyebrow_tr` yoksa sorgu patlıyor. `apps/api` içinden `npx drizzle-kit migrate`.
  İlgili: `lib/promotions.ts`, `top-banner.tsx`, `panel-shell.tsx`, `e2e/promotion-banner.spec.ts`.

- **Kampanya modalı: adminden yönetilen metin, bilet, hareket, süre (2026-09-02)** —
  Migration `0092_promotion_copy` dört nullable kolon ekliyor: `eyebrow_tr/en`, `description_tr/en`.
  `PromotionSummary` bunları lokalize edilmiş `eyebrow` / `description` olarak taşıyor; boşsa `null`
  dönüyor ve istemci kendi varsayılan metnine düşüyor. Yani yeni bir kampanya kendi sesiyle
  konuşmak için deploy istemiyor.
  **Kapsam satırı ve CTA bilinçli olarak adminden yönetilmiyor**: kapsam `planNames`'ten türetiliyor
  (tek plana özel bir indirim elle "tüm planlarda geçerli" yazılabilirdi) ve CTA kodun varlığına
  bağlı davranışsal bir metin. İkisi de yanlış vaat üretebilecek alanlar.
  Bilet kenarı artık tırtıklı: iki dikey kenarda 22 px'te bir yarım daire ısıran, **iç içe iki
  maskeli katman** (dış katman çerçeve rengi, iç katman zemin, aynı maske `1.5px` kaydırılmış).
  Eski `outline` + tek çift çentik çözümü maskenin çerçeveyi de kesmesi yüzünden çentik ağzında
  çerçeveyi kaybediyordu.
  Animasyonda asıl eksik olan **çıkış** kapandı: kart `open` state'i ile `AnimatePresence` içinde
  duruyor, gerçek `onClose`/`onContinue` `onExitComplete`'te çalışıyor — önceden parent anında
  unmount ettiği için modal aniden yok oluyordu. Elle yazılan gecikmeler `variants` +
  `staggerChildren` ile değişti; kopyala butonunun ikon/etiket değişimi de artık geçişli.
  Mobilde içerik kolonundaki `flex-1` boşluk kaldırıldı ve kolon `justify-center` oldu — hediye
  ikonundan bilete kadar her şey tek blok okunuyor; rakam `clamp(84px,26vw,116px)` ile akışkan.
  **Süreli kampanya artık süresini söylüyor**: `endsAt` doluysa biletin altında eğik bir
  "geçerlilik damgası" çıkıyor (`data-testid="promotion-validity"`). Geri sayım ya da "son şans"
  yok — [voice.md](../copy/voice.md) kayıp-kaçınmayı yasaklıyor, damga düz bilgi veriyor.
  Kullanım: admin `/promotions` formunda "Modal üst etiketi" ve "Modal açıklaması" alanları; boş
  bırakılırsa uygulama kendi metnini kullanır.
  Gotcha: `NEXT_PUBLIC_SITE_URL` olmadan `pnpm --filter @mentor/web build` düşüyor ve **pnpm
  filtresi kabuktan gelen env değişkenini alt sürece geçirmiyor** — e2e için `apps/web` içinden
  `NEXT_PUBLIC_SITE_URL=https://... npx next build` çalıştırıp `next start`'ı da aynı değişkenle
  başlatmak gerekiyor, aksi halde `/panel` "This page couldn't load" veriyor ve testler yanıltıcı
  şekilde toplu düşüyor.
  İlgili: `promotion-card.tsx`, `promotions.service.ts` (`toSummary`, `toAdminDto`),
  `packages/{types,validation}/src/promotions.ts`, `PromotionForm.tsx`,
  `messages/{tr,en}.json`, `e2e/promotion-banner.spec.ts`.

- **Kampanya modalı: bir kez, kampanya başına (2026-09-01)** — `WelcomeGiftDialog` →
  `PromotionDialog`. Tek `seen` bayrağı yerine **görülmüş kampanya id kümesi**, yani ikinci bir
  kampanya birincinin bayrağı tarafından yutulmuyor. Bunun için `PromotionSummary`'ye `id` eklendi
  (wire'da atıl: hiçbir endpoint promosyon id'si kabul etmiyor — offers ve checkout `code` alıyor —
  yani sadece iki kampanyayı ayırt etmeye yarıyor).
  **Modalın başlığı artık promosyonun kendi `label`'ı**: admin kampanyayı adlandırıyor, istemcide
  hiçbir kampanya adı yok. `paywall.welcome_*` anahtarları emekli edildi.
  Kullanım: admin `/promotions`'tan yeni kampanya → uygun ücretsiz kullanıcı panelde bir kez modal
  görüyor, CTA paywall'ı açıyor.
  Gotcha: effect **ref ile bir-kez** korunuyor, `cancelled` bayrağıyla değil. StrictMode'da effect
  koş→temizle→koş yapıyor; per-run `cancelled` bayrağını İLK temizlik set ediyor ama o koşunun
  diyaloğu ekranda kalıyor, sonuçta kullanıcının tıklaması vazgeçmiş bir closure'a düşüyor ve
  **CTA sessizce hiçbir şey yapmıyordu**. Aynı desen eski `WelcomeGiftDialog`'da da vardı.
  Bir diğeri: `localStorage`, yani depolama temizlenirse tekrar çıkabilir — promosyonun kendi
  kullanıcı limiti sunucuda gerçek korumayı sağlıyor.
  İlgili: `promotion-dialog.tsx`, `lib/promotions.ts`, `lib/seen-ids.ts`,
  `e2e/promotion-banner.spec.ts`.

- **Geri kazanım kanalı açıldı, WIN_BACK gerçekten çalışıyor (2026-09-01)** — Faz 1'de yazılan
  `WIN_BACK` kuralı bugüne kadar **ölüydü**: `promotionContext` `lastSubscriptionStatus`'a ham DB
  durumunu veriyordu, ama süresi dolan abonelik tabloda `ACTIVE` kaldığı için kural hiç eşleşmiyordu.
  Alan `lostPremiumAccess: boolean` olarak değiştirildi ve `hasLostAccess` ile türetiliyor; adı
  artık ne sorduğunu söylüyor. Süre dolma süpürücüsü için bkz. [payments.md](./payments.md).
  Kullanım: admin `/promotions` → kural "Geri kazanım". Aboneliği biten kullanıcı hem indirimi
  paywall'da görüyor hem de bildirim alıyor.
  Gotcha: kural artık "iptal etti ama dönemi sürüyor" kullanıcısını doğru şekilde **dışarıda**
  bırakıyor — henüz bir şey kaybetmediler.
  İlgili: `promotion-rule.ts`, `subscriptions.service.ts`, [notifications.md](./notifications.md).

- **Ticari yüzeyler koordine edildi (2026-08-31)** — Promosyon şeridi yayındayken sağ raydaki
  `PremiumCampaignBanner` çekiliyor: şerit **gerçek ve belirli** bir indirim taşıyor, ray kartı ise
  genel deneme daveti — ikisi aynı anda tek bir ücretsiz kullanıcıya iki ayrı ticari ask demekti.
  `bannerPromotion` artık üç durumlu (`undefined` = teklifler henüz çözülmedi), böylece ray kartı
  önce görünüp sonra kaybolmuyor. TopBanner kapatması da item bazlı oldu, yani görev duyurusunu
  kapatmak promosyonu artık susturmuyor (bkz. [web-shell.md](./web-shell.md)).
  Kullanım: yüzey önceliği modal (bir kez) > şerit (belirli teklif) > ray kartı (genel).
  Gotcha: hoş geldin modalı ile şerit hâlâ aynı yüklemede birlikte çıkabilir — modal portal olarak
  şeridin üstünde durduğu ve cihaz başına bir kez göründüğü için bilinçli olarak bırakıldı.
  İlgili: `panel-shell.tsx`, `premium-campaign-banner.tsx`, `top-banner.tsx`,
  `e2e/promotion-banner.spec.ts`.

- **2026-08-31 — Panel promosyon şeridi (Faz 4)** — İndirim artık paywall'ı açmayan kullanıcıya da
  görünüyor: panelde `TopBanner`'a üçüncü item eklendi (`pickBannerPromotion`, saf + testli).
  Gate `!isPremium` ve gerçek indirim; etiket sunucudan (`labelTr`/`labelEn`), hiçbir kampanya adı
  istemcide sabit değil. Kopya `paywall.banner_*` altında — **`ads.*` değil**, çünkü TopBanner
  reklam bileşeni değil ([ads.md](./ads.md)). Sıra: **promosyon önce** (kampanyanın bitiş tarihi
  var, görevler her gün duruyor) — bu, çoklu-item rotasyonunu **ilk kez** canlıya çıkardı.
  `fetchAutoPromotionOffers()` eklendi: banner, hoş geldin modalı ve paywall aynı render'daki
  kodsuz çağrıyı paylaşıyor (`subscription-view.ts` deseni; yalnız eşzamanlı çağrılar birleşir).
  Ayrıca katalog aylık-tek plana indiği için paywall ve `/abonelik` ızgaraları tek planda tam
  genişliğe geçti (önceden yarım kolonda kalıyordu).
  Kullanım: admin `/promotions`'tan kodsuz promosyon → panelde şerit → CTA paywall'ı açar.
  Gotcha (**2026-08-31'de giderildi**, üstteki girdiye bakın): kapatma anahtarı
  (`mentor.dashboard-top-banner.dismissed.v1`) **tüm** item'ları birden gizliyordu — görev şeridini
  kapatan kullanıcı o sekmede promosyonu da göremiyordu.
  Bir diğeri (**kısmen giderildi**): aynı ücretsiz kullanıcıda hoş geldin modalı + sağ ray kampanya
  kartı + şerit üst üste gelebiliyordu; ray kartı artık şerit yayındayken çekiliyor, modal
  bilinçli olarak bırakıldı.
  İlgili: `lib/promotions.ts`, `panel-shell.tsx`, `premium-paywall-modal.tsx`,
  `subscription-shell.tsx`, `e2e/promotion-banner.spec.ts`.

- **2026-08-30 — `ACTIVE_DAYS` canlıya alındı + para yolu e2e (Faz 3)** — Kuralın sinyali bağlandı:
  `StreakService.listActiveDatesSince(userId, windowDays)` eklendi (yeni sorgu yok, mevcut
  `DailyActivityRepository` çağrısı), `PaymentsModule` `CoachingModule`'ü import ediyor.
  `PromotionUserContext.activeDates` alanı kalktı; yerine `resolveOffers`'a **tembel** bir
  `activeDates(windowDays)` thunk'ı geçiyor — canlı `ACTIVE_DAYS` kuralı yoksa coaching'e hiç
  gidilmiyor, varsa çağrı başına tek fetch (teklif ve bekleyen-kupon yolları paylaşıyor).
  Yeni `apps/api/test/promotions.e2e-spec.ts`: gerçek Postgres + `fake` sağlayıcı ile indirimin
  **deftere ve faturaya** indirimli tutarla düştüğü, terk edilmiş checkout'un kotayı geri açtığı ve
  **iki kullanıcı son kontenjanı yarıştığında birinin 409 aldığı** (advisory lock kanıtı) doğrulanıyor.
  Kullanım: admin `/promotions` → kural "Aktif gün", gün + pencere gir.
  Gotcha: signup 5/dk throttle'lı, o yüzden e2e üç kullanıcı açıp `resetUser()` ile geri dönüştürüyor —
  yeni test eklerken kullanıcı başına signup açma. Bir diğeri: pencere `windowDays` ile promosyon
  başına ama fetch her zaman 90 günlük (`MAX_ACTIVITY_WINDOW_DAYS`, zod sınırıyla aynı), sayım
  `countDatesWithin` içinde her kuralın kendi penceresine göre yapılıyor.
  İlgili: `streak.service.ts`, `promotions.service.ts`, `subscriptions.service.ts`,
  `payments.module.ts`, `test/promotions.e2e-spec.ts`.

- **2026-08-30 — Kullanıcı yüzü (Faz 2)** — Paywall artık indirimi gösteriyor: eski fiyat üstü
  çizili, yeni fiyat altında, promosyonun kendi rozeti (`labelTr`/`labelEn`, sunucudan lokalize).
  Katlanabilir kupon alanı `POST /v1/subscription/offers`'a gidiyor; **geçersiz kod artık 422
  dönüyor** (checkout ile birebir aynı hata), böylece kullanıcının kupon yazarken gördüğü mesaj
  satın almayı durduracak olanla aynı ve sessizce liste fiyatına düşülmüyor.
  Onay metni (ön bilgilendirme formu) indirimliyken **hem ilk ödemeyi hem yenileme fiyatını**
  yazıyor — `subscription.trial_consent_discounted*` / `consent_discounted*` anahtarları.
  `SubscriptionView.discount` eklendi: `/abonelik` ekranı checkout'ta donmuş fiyatı gösteriyor,
  yani admin `plans.priceMinor`'ı sonradan değiştirse bile kullanıcının anlaşması bozulmuyor.
  Offers yanıtına `available` eklendi — kullanıcının hak ettiği ama henüz yazmadığı **kodlu**
  promosyonlar; hoş geldin modalı kodu buradan okuyor, hiçbir kampanya adı istemciye gömülü değil.
  Kullanım: admin `/promotions`'tan kodsuz promosyon = otomatik üstü çizili, kodlu = kullanıcı yazar
  ya da hoş geldin modalında görür. Gotcha: hoş geldin modalı `localStorage` bayrağıyla bir kez
  gösteriliyor — depolama temizlenirse tekrar çıkabilir; promosyonun kendi kullanıcı limiti gerçek
  koruma. Bir diğeri: `trialDays > 0` kontrolü mevcut davranışı birebir izliyor, istemci hâlâ geri
  dönen abonenin deneme hakkı olup olmadığını bilmiyor (bu değişiklikten önce de böyleydi).
  İlgili: `premium-paywall-modal.tsx`, `welcome-gift-dialog.tsx`, `lib/promotions.ts`,
  `subscription-shell.tsx`, `subscription-facts.ts`, `messages/{tr,en}.json`,
  `e2e/promotions.spec.ts`, `src/lib/promotions.spec.ts`.

- **2026-08-30 — Promosyon motoru çekirdeği (Faz 1)** — Yeni bounded context: iki tablo
  (`promotions`, `promotion_redemptions`, migration `0090_promotions`), iki saf domain fonksiyonu,
  `PromotionsService`, FINANCE + audit'li admin CRUD ve admin paneli (`/promotions`). Checkout
  artık indirimli tutarı `PaymentsPort`'a `chargeAmountMinor` / `renewalAmountMinor` /
  `discountPeriods` olarak geçiriyor; abonelik ve redemption **tek transaction'da** commit oluyor.
  Webhook tarafında üç tuzak kapandı: defter satırı ve e-Arşiv faturası artık
  `plan.priceMinor` yerine redemption'daki **mutabık kalınan** tutarı yazıyor, ve `MIN_CHARGE_MINOR`
  tabanı 0 ₺'lik tahsilatta faturanın atlanmasını imkânsız kılıyor.
  Kullanım: admin `/promotions` → kod boş bırakılırsa otomatik, doldurulursa kullanıcı yazar.
  Gotcha: `ANYONE`/`NEW_USER`/`WIN_BACK` kuralları canlı; **`ACTIVE_DAYS` henüz inert** —
  `PromotionUserContext.activeDates` boş geliyor (Faz 3'te coaching'e `countActiveDaysSince`
  eklenince dolacak). Kullanıcı yüzü (paywall üstü çizili fiyat, kupon input'u, hoş geldin modalı,
  indirimli onay metni) **Faz 2**; bugün motor yalnız sunucu tarafında çalışıyor.
  İlgili: `apps/api/src/modules/promotions/**`, `payments/application/subscriptions.service.ts`,
  `shared/ports/payments.port.ts`, `common/config/config.catalog.ts`,
  `apps/admin/src/app/(general)/promotions/**`, [payments.md](./payments.md).
