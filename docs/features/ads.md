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
kalır. LGS bağlamı `CHILD`, YKS `TEEN` treatment alır. Yaş, kullanıcı kimliği, sınav sonucu, ruh
hâli, performans veya AI konuşması Google'a gönderilmez.

## API

- `GET /v1/ads/public/placements/:placementId?examType=`
- `GET /v1/ads/placements/:placementId`
- `GET /v1/ads/reward-offers/:placementId`
- `POST /v1/ads/reward-sessions`
- `POST /v1/ads/reward-sessions/:id/complete`
- `POST /v1/ads/reward-sessions/:id/close`

## Konfigürasyon ve açılış

Tüm `ads.*` registry değerleri varsayılan kapalıdır. Ad unit yolları yalnız env ile bağlanır:
`GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT`, `GAM_DASHBOARD_REWARDED_COIN_AD_UNIT`. Admin yeni placement
üretemez. EEA/UK/İsviçre, CMP gelene kadar backend tarafından kapatılır.

Production öncesi domain + `ads.txt`, test/prod ad unit ayrımı, uygun kategori blokları ve hukuk
metinleri tamamlanmalıdır. GPT yalnız limited-ads URL'sinden yüklenir ve `limitedAds: true` istekten
önce uygulanır. Google Ad Manager'da varsayılan açık gelen **Programmatic limited ads** ayrıca
kapatılmalıdır; doğrudan/reservation envanteri kullanılmalıdır.

## Geliştirmeler (timeline)

- **2026-08-29 — Web v1 temel teslimatı** — Ads bounded context, merkezi kill-switch/placement
  kataloğu, Coin kapasite rezervasyonu, client-event reward session, idempotent completion, RLS ve
  migration eklendi. Bilgi makalesi contextual slotu ve dashboard gönüllü Coin kartı limited GPT
  singleton'ı üzerinden bağlandı; Premium/STAFF script yüklemez. Admin overview reward/coin
  metriklerini gösterir; hesap silme mutable reklam/rezervasyon verisini temizler. Gotcha: bayraklar
  ve env yolları bilerek kapalı/boş gelir; Google + hukuk checklist'i tamamlanmadan açılmamalıdır.
  İlgili dosyalar: `modules/ads`, `database/schema.ts`, `components/ads`, `lib/google-publisher-tag.ts`,
  `drizzle/0087_perpetual_taskmaster.sql`.
