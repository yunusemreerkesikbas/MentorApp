# Ads — Google Ad Manager + Coin (Web v1)

## Ürün sınırı

- Premium ve STAFF tamamen reklamsızdır; backend izin vermeden GPT scripti yüklenmez.
- Free kullanıcı dashboard'da gönüllü rewarded reklam tamamlayarak varsayılan 5 Coin kazanır.
  Varsayılan günlük limit 2, cooldown 15 dakika, oturum süresi 5 dakikadır.
- Anonim ve Free ziyaretçi bilgi makalesinin sonunda en fazla bir contextual banner görebilir.
- Interstitial, sticky/app-open reklam, doğrudan özellik hakkı ve mobil SDK bu sürümde yoktur.

## Mimari

`AdsModule` placement uygunluğunu ve `ad_reward_sessions` yaşam döngüsünü sahiplenir; Economy
ledger'ına erişmez. Başlangıçta Economy'nin `coin_grant_reservations` kontrol tablosunda kapasite
rezerve edilir. `rewardedSlotGranted` geldiğinde rezervasyon ve `ad.reward.completed` ledger satırı
aynı SERVICE transaction içinde tamamlanır. `(ref_type, ref_id)=(ad_reward, sessionId)` tekrarları
ikinci Coin üretmez. Web kanıtı açıkça `CLIENT_EVENT` olarak saklanır; SSV değildir.

Pasif impression/fill/gelir kullanıcı bazında Mentor DB'ye yazılmaz; Google Ad Manager raporlarında
kalır. Makale ailesi Content modülünün yayımlanmış içerik arayüzünden çözülür; istemcinin gönderdiği
eski `examType` değeri güven kararı değildir. Profil ile içerikten biri LGS ise `CHILD`, değilse biri
YKS ise `TEEN` treatment uygulanır. Yaş, kullanıcı kimliği, sınav sonucu, ruh hâli, performans veya
AI konuşması Google'a gönderilmez.

## API

- `GET /v1/ads/public/placements/:placementId?contentSlug=` (`examType` deprecated)
- `GET /v1/ads/placements/:placementId?contentSlug=`
- `GET /v1/ads/reward-offers/:placementId`
- `POST /v1/ads/reward-sessions` (`Idempotency-Key: <uuid>` opsiyonel)
- `POST /v1/ads/reward-sessions/:id/complete`
- `POST /v1/ads/reward-sessions/:id/close`
- `POST /v1/internal/cron/expire-ad-reward-sessions` (`CRON_SECRET`)

## Konfigürasyon ve açılış

Tüm `ads.*` registry değerleri varsayılan kapalıdır. Ad unit yolları yalnız env ile bağlanır:
`GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT`, `GAM_DASHBOARD_REWARDED_COIN_AD_UNIT`. Admin yeni placement
üretemez. EEA/UK/İsviçre, CMP gelene kadar backend tarafından kapatılır.

Production öncesi domain + `ads.txt`, test/prod ad unit ayrımı, uygun kategori blokları ve hukuk
metinleri tamamlanmalıdır. GPT yalnız limited-ads URL'sinden yüklenir ve `limitedAds: true` istekten
önce uygulanır. Google Ad Manager'da varsayılan açık gelen **Programmatic limited ads** ayrıca
kapatılmalıdır; doğrudan/reservation envanteri kullanılmalıdır.

## Geliştirmeler (timeline)

- **2026-08-30 — Premium görev bannerı reklamdan ayrıldı** — `TopBanner` reklam bileşeni değil,
  ortak dashboard duyuru/görev giriş noktasıdır. Premium kullanıcı `Bugünün görevleri seni
  bekliyor` item'ını görüp Görevler sheet'ini açar; rewarded satır, GPT scripti ve reklam isteği
  gösterilmez. Rewarded Coin item'ı yalnız uygun Free kullanıcıya özel kalır. İlgili:
  `top-banner.tsx`, `panel-shell.tsx`, `e2e/ads.spec.ts`.

- **2026-08-30 — Ardışık günlük reklam hakları ve görev odaklı duyuru** — Web rewarded
  cooldown varsayılanı `0` oldu; günlük iki hak ayrı kullanıcı tıklamaları ve ayrı idempotent
  session'larla arka arkaya kullanılabilir. İlk tamamlamada başarı toast'ı gösterilir, açık Görevler
  sheet'indeki reklam satırı backend teklifini yeniden alıp ikinci GPT slotunu hazırlar; günlük hak
  bitince tamamlanmış duruma geçer. Top banner artık kalan toplam Coin'i görev diliyle gösterir ve
  sakin token tabanlı gradient kullanır; modal reklamı açmadan önce `Kısa bir reklam izle` diyerek
  şeffaf kalır. Gotcha: katalog varsayılanı mevcut DB override'ını ezmez; aktif ortamda
  `ads.rewarded.web.cooldown_seconds` ayrıca `0` kaydedilmelidir. İlgili: `config.catalog.ts`,
  `rewarded-ad-offer.tsx`, `top-banner.tsx`, `panel-shell.tsx`, `e2e/ads.spec.ts`.

- **2026-08-30 — Dashboard top banner ve günlük Coin görevi** — Sağ raydaki bağımsız rewarded
  kart kaldırıldı. Backend teklifi uygun Free kullanıcı dashboard'un üstündeki tek satırlık
  `{count} Coin seni bekliyor` duyurusundan mevcut Görevler sheet'ini açar; GPT ancak sheet
  açıldıktan sonra hazırlanır. Rewarded aksiyon günlük listenin ilk sırasında ayrı Coin görevidir,
  Economy'nin ritüel sayısına/serisine katılmaz. Duyuru kapatma tercihi sekme oturumu boyunca
  `sessionStorage` içinde kalır; çoklu item sözleşmesi beş saniyelik, hover/focus'ta duran rotasyona
  hazırdır. Gotcha: no-fill mevcut dashboard ziyaretinde duyuruyu gizler; Premium/STAFF ve backend
  ineligible kararları hiçbir GPT isteği üretmez. İlgili: `top-banner.tsx`,
  `rewarded-ad-offer.tsx`, `economy-quests-card.tsx`, `panel-shell.tsx`, `e2e/ads.spec.ts`.

- **2026-08-30 — Top banner görsel sadeleştirme** — Banner item ikonları kaldırıldı; dikkat dağıtan
  gradient yerine tasarım sisteminin düz yüzey ve nötr border renkleri kullanıldı. İlgili:
  `top-banner.tsx`, `panel-shell.tsx`.

- **Yoldaşlık sesi Dalga 17 — form kontrol et (2026-08-29)** — `ads.rewarded` unavailable/session_active “kontrol et” kalktı. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: e2e unavailable metni. İlgili: `apps/web/messages/{tr,en}.json`, `e2e/ads.spec.ts`.

- **Yoldaşlık sesi Dalga 11 — rewarded reklam (2026-08-29)** — `ads.rewarded` companion hak: `kazan`/`ödül`/`Lütfen` kalktı; `{count}` Coin gerçeği durdu. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: CTA “Reklamı izle”; leaderboard durdu. İlgili: `apps/web/messages/{tr,en}.json`, `e2e/ads.spec.ts`.

- **2026-08-29 — Web v1 stabilizasyonu ve staging hazırlığı** — Contextual karar artık yayımlanmış
  makalenin `contentSlug` değerini Content public arayüzünden doğrular ve profil/içerik arasındaki en
  sıkı treatment'ı seçer. Reward limiti Europe/Istanbul takvim gününe taşındı; create çağrısı UUID
  idempotency anahtarı, tek aktif session partial unique indexi ve forward-only `0088` migration ile
  yarışlara dayanıklı hâle geldi. Render Cron tarafından beş dakikada bir çağrılan, 200 kayıtlık
  `SKIP LOCKED` expiry sweep'i Coin rezervasyonunu aynı transaction'da bırakır; AdsModule mevcut
  job/cron mimarisinin dışında ayrı timer çalıştırmaz. Web rewarded
  akışı null slot/no-fill/10 saniye timeout'ta CTA'yı kaldırır, belirsiz create/complete sonucunu aynı
  kimlikle yalnız bir kez tekrarlar ve focus'u sakin sonuç durumuna döndürür. Kullanım: staging test
  unit'lerini env'e girip tüm `ads.*` bayraklarını yalnız staging'de açın; production rollout `%0`
  kalmalıdır. Gotcha: web kanıtı hâlâ `CLIENT_EVENT`tir; gerçek GAM/CMP/hukuk onayı bu teslimatta
  yoktur. İlgili dosyalar: `modules/ads`, `economy.service.ts`, `drizzle/0088_*`, `components/ads`,
  `lib/ad-reward-retry.ts`, `test/ads.e2e-spec.ts`, `e2e/ads.spec.ts`.

- **2026-08-29 — Web v1 temel teslimatı** — Ads bounded context, merkezi kill-switch/placement
  kataloğu, Coin kapasite rezervasyonu, client-event reward session, idempotent completion, RLS ve
  migration eklendi. Bilgi makalesi contextual slotu ve dashboard gönüllü Coin kartı limited GPT
  singleton'ı üzerinden bağlandı; Premium/STAFF script yüklemez. Admin overview reward/coin
  metriklerini gösterir; hesap silme mutable reklam/rezervasyon verisini temizler. Gotcha: bayraklar
  ve env yolları bilerek kapalı/boş gelir; Google + hukuk checklist'i tamamlanmadan açılmamalıdır.
  İlgili dosyalar: `modules/ads`, `database/schema.ts`, `components/ads`, `lib/google-publisher-tag.ts`,
  `drizzle/0087_perpetual_taskmaster.sql`.
