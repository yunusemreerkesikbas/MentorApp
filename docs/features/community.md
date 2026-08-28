# Community (Emek Panosu)

> The `/topluluk` right-column effort board: streak + XP + weekly effort leaderboard + positive
> identity badges. Module: `modules/community`. Surfaces data that already exists (economy ledger,
> streak, forum activity) — the roadmap §3 social layer's lean, Redis-free first slice.
> Roadmap: MVP UI slice; Phase 2 adds Redis sorted-set leaderboard, presence, mahalle, delta arrows.

## Overview

The community right column used to be a static profile card, which made `/topluluk` feel empty and
gave no reason to return. The **Emek Panosu** turns it into a live surface: how long your streak is,
how much XP you've earned, your level, your badges, and how you rank against your exam-type cohort
this week. **Effort only** — XP / streak / consistency are ranked; net and exam results are NEVER
ranked or shown (§3, anti-demoralization).

## Architecture (key decisions)

- **New `community` module, one endpoint** — `GET /v1/community/summary` returns the whole board in
  one call. Self-scoped read; no feature-flag 404.
- **Pure aggregation module — owns no tables.** Every read comes from the owning module's public
  service (no cross-module table access): profile ← identity `UsersService`, streak ← coaching
  `StreakService`, post signals ← forum `ForumService`, XP/leaderboard ← economy `EconomyService`.
- **Leaderboard = SQL aggregate in economy (owns the ledger), no Redis.** `SUM(amount) WHERE unit='XP'`,
  grouped by user, scoped to the viewer's `examType` cohort, weekly window (Monday 00:00 UTC), top-10
  - the viewer's own rank. `unit` is hard-filtered to XP so coin/net can never leak into the ranking.
    _(Redis sorted-set is the Phase-2 real-time upgrade.)_
- **Badges = derived read-time, no `Badge` table.** `domain/badges.ts` is a pure function over
  existing signals (streak, forum-post hours, reactions received, join date); the signals are fetched
  through each owner service. Positive framing only.
- **Level = derived** from XP tiers (`domain/level.ts`, pure). Tier names live in web i18n.
- **Graceful degradation** — streak + badges are economy-independent and always returned; `xp`,
  `level`, `leaderboard` come back `null` when `economy.enabled` is off, and the UI hides them.
- **XP liveliness** — the leaderboard needs XP to earn. Beyond accepted-answer XP (forum), posting a
  thread/message now grants a little XP (`ThreadPostedListener` in economy, `forum.xp.thread_posted`,
  capped per day). XP is generous by design; only the daily post-count is capped (anti-farm).

## Tutorials / Guides

```bash
# Enable the economy so XP/level/leaderboard light up (admin, per-environment):
PATCH /v1/admin/config/economy.enabled { "value": true }

# Read the board:
GET /v1/community/summary

# Tune XP earning (config):
#   forum.xp.thread_posted            (XP per post, default 2)
#   forum.xp.thread_posted_daily_cap  (posts/day that earn XP, default 10)
#   forum.xp.accepted_answer          (existing)

# Run tests:
pnpm --filter @mentor/api exec vitest run src/modules/community src/modules/economy/application/thread-posted.listener.spec.ts
pnpm db:up && pnpm --filter @mentor/api exec vitest run test/community.e2e-spec.ts
```

Web UI: `/topluluk` right column — `EmekPanosu` composes `ProfileCard` + `StatSnapshot` +
`BadgeStrip` + `LeaderboardCard` (`apps/web/src/app/[locale]/(app)/topluluk/_components/`).
Data wrapper: `apps/web/src/lib/community.ts`.

## API

| Endpoint                                | Purpose                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `GET /v1/community/summary`             | Effort board: streak, badges, and (economy-gated) xp/level/weekly leaderboard |
| `GET /v1/community/leaderboard?window=` | Effort ranking (today / weekly / all_time)                                    |
| `GET /v1/community/profile/:username`   | Public profile header — identity + gamification, no PII (APP-018)             |

## Geliştirmeler (timeline)

- **X-benzeri Topluluk light palette (2026-08-28)** — Light temadaki sıcak gri sidebar ve görünmez
  beyaz ayırıcılar, yalnız `.community-workspace` kapsamında soğuk beyaz yüzeyler, mavi-gri ince
  sınırlar ve daha net sosyal mavi vurgu ile değiştirildi. Kartlar light temada gölge yerine flat
  separator kullanır; dark tema kendi tokenlarını korur. İlgili: `community-parity.css`.

- **Profil achievement vitrini ölçeği (2026-08-28)** — Üye profilindeki “Yolculuktan İzler”
  rozetleri, dekoratif ikon gibi kalmaması için 80 px etkileşim alanına büyütüldü; görünür sanat
  alanı genişletilip üçlü mobil dizilimin rahat aralığı korundu. İlgili: `achievement-showcase.tsx`.

- **Global composer açılış geçişi (2026-08-28)** — Akıştaki hızlı paylaşım alanı odaklandığında
  dış kartı ölçeklemek yerine, Twitter benzeri lokal bir geçişle hedef-kitle seçenekleri ve yazı
  alanı kısa bir ease-out hareketiyle açılıp kapanır. Hareket azaltma tercihi etkinse geçiş devre
  dışı kalır. Metin alanının odak yüzeyi tasarım sistemi radius tokenını kullanır ve odak halkası
  artık köşeleri takip eder. İlgili: `global-composer.tsx`, `composer-body-field.tsx`.

- **Yolculuktan İzler vitrini (2026-08-25)** — Achievement rollout'u açıkken
  `GET /v1/community/profile/:username`, herkese açık profil yanıtında toplam kazanım sayısını ve
  backend'in otomatik seçtiği en yeni en fazla üç kanonik kazanımı lokalize `achievementShowcase`
  içinde taşır. Sıralama özgün `earnedAt` tarihine göredir; geçmişten backfill edilenlerde ilk
  kazanım tarihi, eşitlikte sabit katalog sırası kullanılır; bilinmeyen/eskimiş kimlikler dışarıda
  bırakılır. Biyografi/website altında görsel rozetler gösterilir; rozet bilgi kartı adı, kazanım
  bilgisi ve tarihi açar, `earnedCount > 3` ise “Tümünü gör” aynı üyenin
  `/community/member/[username]?tab=achievements` rotasına gider. Gotcha: sıralama ve içerik
  istemcide hesaplanmaz; flag kapalıyken alan `null`, açık ama kazanım yokken
  `{ earnedCount: 0, items: [] }` olur ve vitrin render edilmez. İlgili: API
  `achievement-collection.ts`, `achievement.service.ts`, `community.service.ts`,
  `community-profile.service.spec.ts`, `packages/types/src/community.ts`; web
  `achievement-showcase.tsx`, `achievement-detail.tsx`, `achievement-collection.tsx`,
  `profile-header.tsx`, `community-member-profile.spec.ts`, `messages/{tr,en}.json`.

- **Premium kimlik işareti (2026-08-22)** — Üyelik, avatar köşesine rozet basmak yerine ismin
  yanındaki amber taç ile gösterilir. “Premium” yazısı chrome’da yok (yalnız `aria-label`).
  Mavi doğrulama tiki e-postaya aittir; ödül kurdelesi / doygun gradyan yok. Yüzeyler: sidebar /
  mobil kimlik, ayarlar profili, topluluk üye profili. Feed ve yorum avatarları işaretlenmez.
  Kullanım: `entitlement.isPremium` veya public `isPremium`. Gotcha: e-posta doğrulandı işareti
  ayarlar avatarında kalır; premium ile karışmaz. İlgili: `premium-identity-mark.tsx`,
  `app-nav.tsx`, `profile-header.tsx`.

- **Sakin seviye atlama kutlaması (2026-08-22)** — Gece Yolculuğu tanışması ve gerçek seviye
  geçişleri `user_journey_level_celebrations` tablosunda kalıcı, cihazlar arası tekilleştirilmiş
  kayıtlar olarak tutulur. İlk senkron mevcut seviyeyi bir kez tanıtır; daha yüksek bir seviyeye
  geçiş yalnız ulaşılan en yüksek seviye için kutlama üretir ve bekleyen eski kayıtları geçersiz
  kılar. Web, achievement ve seviye kutlamalarını tek kronolojik kuyrukta sıraya alır; seviye kartı
  sessiz, confettisiz, odak/scroll korumalı ve reduced-motion uyumludur. Kullanım: ekonomi açıkken
  uygulamaya gir; görülmemiş kutlama otomatik açılır ve “Yolculuğa devam et” onayıyla tüm cihazlarda
  kapanır. Gotcha: SSE yalnız hızlandırma sinyalidir; güvenilir kaynak unseen endpoint'idir. Onay
  başarısızsa kart açık kalır. İlgili: `journey-level-celebration.*`, migration `0083`,
  `celebration-queue.ts`, `notification-drawer-shell.tsx`, `journey-level-celebration.tsx`.

- **Gece Yolculuğu seviye deneyimi (2026-08-22)** — Profildeki 12 XP seviyesi, dört bölümlü
  şiirsel kimliğe geçirildi: Uyanış, Ahenk, Derinleşme ve Birlikte Işık. Profil kartı mevcut
  madalyonu, seviye/bölüm adını ve kısa anlatıyı gösterir; profil sahibi ayrıca backend'in
  hesapladığı seviye içi progress'i ve sonraki seviyeye kalan XP'yi görür. Ziyaretçide sayısal XP
  gizlenir. Bilgi düğmesi mobil alt kart/masaüstü dialog olarak 12 seviyelik Gece Yolculuğu
  rehberini açar; focus trap, Escape/backdrop/kapama, scroll lock, focus restoration ve
  reduced-motion davranışları desteklenir. Seri ve topluluk rozetleri aynı panelin altında korunur.
  Kullanım: üye profilindeki “Yolculuk seviyesi” kartından bilgi düğmesini aç. Gotcha: nihai 12 SVG
  ailesi hazır olana kadar tüm seviyeler numaralı fallback madalyonla gösterilir; kısmi görsel aile
  yayınlanmaz. İlgili: `journey-levels/*`, `profile-header.tsx`, `profile-shell.tsx`,
  `community-member-profile.spec.ts`, web `messages/{tr,en}.json`.

- **Achievement bilgi kartı hareket düzenlemesi (2026-08-22)** — Bilgi kartına Framer Motion ile
  sakin bir arka plan kararması ve hafif yükselme/ölçeklenme giriş-çıkış efekti eklendi. Kullanım
  değişmedi: achievement kartı veya “Sıradaki keşif” satırı aynı detayı açar. Çıkış tamamlanana kadar
  focus trap ve scroll kilidi korunur; ardından odak tetikleyiciye döner. Sistem hareketi azaltma
  tercihini bildirirse konum ve ölçek hareketleri uygulanmaz, yalnız kısa opacity geçişi kalır.
  Gotcha: efekt bilgi verme tonunda ve 200 ms motion bütçesi içindedir; kutlama animasyonu değildir.
  İlgili: `achievement-collection.tsx`, `community-member-profile.spec.ts`.

- **Achievement koleksiyon rehberi (2026-08-22)** — Profil sahibinin Başarılar sekmesine
  kazanılan/toplam sayısını ve erişilebilir tek koleksiyon progress'ini gösteren sakin bir özet eklendi.
  Community backend'i önerilecek kilitli achievement'ı belirler: sayısal ilerlemesi olanlarda en yüksek
  tamamlanma oranı, eşitlikte katalog sırası; ölçülebilir ilerleme yoksa ilk kilitli kart kullanılır.
  Öneri mevcut bilgi kartını açar ve kapanınca odağı rehbere geri verir; 12/12 durumunda yönlendirme
  yerine tamamlanma mesajı gösterilir. Ziyaretçiye `summary: null` döndüğü için kilitli hedef veya
  koleksiyon rehberi açılmaz. Kullanım: kendi profilinde Başarılar sekmesini aç ve “Sıradaki keşif”
  satırına dokun. Gotcha: kart gridinin sırası ve kart altı progress davranışı değişmedi; yeni özet
  yalnız koleksiyon bütününü ölçer. İlgili: `community.ts`, `achievement-collection.ts`,
  `achievement-collection.tsx`, `community-member-profile.spec.ts`, web `messages/{tr,en}.json`.

- **Kilitli achievement bilgi kartı (2026-08-21)** — Profil koleksiyonundaki sabit katalog sırası
  korundu; kilitli kartların altındaki inline progress kaldırılarak grid sadeleştirildi. Tüm kilitli
  kartlar artık info göstergesi taşır ve mevcut detay yüzeyi backend-lokalize `unlockHint` üzerinden
  “Nasıl kazanılır?” açıklamasını açar; sayısal ilerlemesi olan ritim başarılarında sayaç ve progress
  yalnız bu detayda gösterilir. Detay yüzeyi odağı içeride tutar, arka sayfa scroll'unu kilitler;
  `Escape`, dış alan ve kapatma düğmesiyle kapanınca odağı tetikleyici karta geri verir. Asset release
  gate'i `sharp` ile gerçek piksel alpha'sını, 1024×1024 ölçüyü, 600 KiB bütçeyi ve tam 12 kanonik
  dosyayı doğrular; alpha bayrağı taşısa bile opak dış zemini reddeder. `first_step` referansı
  korunarak diğer 11 kanonik asset 1024×1024 şeffaf WebP'e normalize edildi; açık/koyu zeminde
  incelendi ve kullanılmayan tireli iki eski kopya kaldırıldı.
  Kullanım: kilitli bir achievement kartına dokun/tıkla. Gotcha: info işareti ayrı bir iç içe buton
  değildir; kartın tamamı klavye ve dokunma hedefi olarak kalır. İlgili:
  `achievement-{definitions,collection}.ts`, API `achievements.json`, `packages/types/community.ts`,
  `achievement-collection.tsx`, `achievement-asset-validator.mjs`, web `messages/{tr,en}.json`,
  `community-member-profile.spec.ts`.

- **Achievement Sistemi V1 (2026-08-18)** — Kod sahipliğindeki 12 kalıcı başarı, versiyonlu katalog,
  immutable/RLS korumalı `user_achievements`, owner/public görünürlük API'leri, idempotent kutlama
  onayı ve cursor-paged backfill eklendi. Community yalnız kendi tablosunu yazar; coaching/forum
  event ve toplu kanıt servisleri sunar. Profilde flag açıkken Başarılar sekmesi görünür; owner 12
  kartı ve anlamlı ilerlemeyi, ziyaretçi yalnız kazanılanları görür. Kullanım: migration sonrası
  `pnpm --filter @mentor/api achievements:backfill`, final asset kontrolü, ardından
  `community.achievements.enabled=true`. Gotcha: `route_renewed` ve `week_reflected` güvenilir eski
  event olmadığı için backfill edilmez. İlgili: `modules/community/**`, `community/member/**`,
  `components/achievements/**`, `docs/plans/2026-08-18-achievement-system-design.md`.

- **Community leftover chrome tokens (2026-08-18)** — Inner community chrome that still
  mixed against `white` / `#f5f5f5` / `hover:bg-black` now uses `--color-surface`,
  `--color-soft`, `--color-border`, and `color-mix` with `--color-main`. Leaderboard
  chips/podium fade, mini-leaderboard, thread/composer/comment rows, coach bridge,
  zone drawer canvas, and profile/saved dividers follow the theme. Photo lightbox,
  composer overlay, and attachment remove-on-image stay white-on-dark. Usage: flip
  the AppNav theme lamp; leftover chips and hover wells should invert
  with `html.dark`. Gotcha: `--community-blue` CTAs keep `text-white` (progress
  exception). Related: `leaderboard-screen.tsx`, `mini-leaderboard.tsx`,
  `community-coach-bridge.tsx`, `docs/features/web-shell.md`.

- **Theme token pass (2026-08-15)** — Community workspace no longer locks light hex on
  `--color-*`. Surfaces inherit `html` / `html.dark` (`--color-surface`, `--color-border`,
  `--color-btn-label`). Soft community wells (blue/coral/green) mix against surface.
  Header search/sidebar/profile chrome follow the same tokens. Theme and
  notifications live on AppNav (collapsed rail lamp + expanded bell). Lightbox/photo overlays stay white-on-dark.
  Usage: flip the AppNav lamp; cookie `mentor-theme` persists. Gotcha:
  `--community-canvas` is `--color-bg`, not a separate light gray. Related:
  `community-parity.css`, `community-header.tsx`, feed/zone/profile shells,
  `docs/features/web-shell.md`.

- **Akış mobil sekme sadeleştirmesi (2026-08-09)** — Mobil görünür navigasyon “Öne Çıkan” ve
  “Takip Ettiklerim” olmak üzere iki eşit genişlikli ana sekmeye indirildi. “En Yeni / En İyi”
  seçenekleri filtre bottom sheet'indeki sıralama alanına taşındı; etiket ve oda türüyle birlikte tek
  “Uygula” aksiyonunda devreye girer. Aktif sıralama/filtre varsa filtre ikonundaki durum noktası
  görünür. Desktop dört sekmeli hızlı erişimini korur. İlgili: `feed/_components/feed-shell.tsx`.

- **Akış mobil üst alan hizalaması (2026-08-09)** — Mobil “Kanallar” barı ile Akış gövdesi aynı
  `community-canvas` yüzey tokenını kullanır. Filtre ikonu sekmelerin altına düşmez; tek satırda sabit
  kalırken sekmeler dar ekranlarda yatay kayabilir. Global search, topluluk genelinde kişi/etiket/
  tartışma aradığı için üst header'daki mevcut konumunu korur; sayfa filtresiyle karıştırılmaz.
  İlgili: `community-parity.css`, `_components/zone-drawer.tsx`,
  `feed/_components/feed-shell.tsx`.

- **Akış keşif odağı (2026-08-09)** — Global Akış yalnız keşif/filtreleme yüzeyi olarak
  sadeleştirildi. Sayfa içindeki tekrar eden “Akış” başlığı/ikonu ve bağlamsız “Yeni gönderi” aksiyonu
  kaldırıldı; içerik üretimi ilgili sohbet, Q/A veya duyuru odasındaki bağlamsal composer üzerinden
  yapılır. Mobil filtre ikonu tek sekme toolbar'ının sağına taşındı. İlgili:
  `feed/_components/feed-shell.tsx`.

- **Topluluk bildirim paneli yönü (2026-08-09)** — Global bildirim drawer'ına tetikleyici bazlı
  masaüstü `left/right` yerleşim desteği eklendi. Varsayılan uygulama zili soldaki mevcut davranışı
  korurken, sağ üstte konumlanan Topluluk zili paneli sağ kenarda açar. Mobil drawer her zaman sağdan
  açılmaya devam eder. Sağ panel Topluluk header'ının altında 8 px boşlukla konumlanır ve zil
  tetikleyicisini örtmez. İlgili: `community/_components/community-header.tsx`,
  `@mentor/ui/notification-drawer/{types,notification-bell,notification-drawer-context,notification-drawer-panel}.tsx`.

- **Akış mobil skeleton hizalaması (2026-08-09)** — Akış grid'inin loading durumunda içeriğin
  implicit `max-content` kolon üretmesi engellendi; mobil/tablet kolonu açıkça `minmax(0, 1fr)`
  olarak tanımlandı. Ana bölüm ve skeleton grubu artık kullanılabilir mobil
  genişliği doldurur. Feed skeleton'ı ayrı yuvarlak kartlar yerine gerçek akışla aynı tek border'lı,
  bölücülü post yüzeyini kullanır. İlgili: `_components/post-skeleton.tsx`,
  `feed/_components/feed-shell.tsx`.

- **Akış mobil filtre bottom sheet'i (2026-08-09)** — Mobilde ayrı satırda duran metinli “Filtreler”
  butonu kaldırıldı. Filtre aksiyonu başlık satırında “Yeni gönderi” yanında ikon-only 44 px hedefe
  taşındı; aktif filtre varsa mavi durum noktası gösterir. Eski native dialog yerine shared
  `BottomSheetProvider` filter layout'u kullanılır; seçimler “Uygula” ile atomik biçimde akışa
  yansır ve temizleme sheet içinde yapılır. İlgili: `feed/_components/feed-shell.tsx`,
  `lib/mentor-bottom-sheet.ts`, `@mentor/ui/bottom-sheet`.
  Sheet footerına yakın oda türü dropdown'u aşağıda kırpılmaması için yukarı açılır; shared
  `PopoverMenu` ve `MenuSelect` artık ihtiyaca göre `top/bottom` panel yerleşimini destekler.

- **Akış gönderi aksiyon menüsü (2026-08-09)** — Gönderinin üç nokta menüsü native `details`
  dropdown'undan shared `PopoverMenu` yapısına geçirildi. Düzenle, sabitle, sil ve bildir aksiyonları
  artık ortak radius/gölge, click-away kapanma, klavye semantiği ve reduced-motion geçişlerini
  kullanır; silme aksiyonu danger rengiyle ayrışır. İlgili:
  `feed/_components/discovery-feed-card.tsx`, `components/popover-menu.tsx`.

- **Post aksiyon hover standardı (2026-08-09)** — Reaction, yorum, paylaşım ve kaydetme ikonlarında
  hover/focus sırasında stroke kalınlığını değiştiren ve görsel sıçrama yaratan davranış kaldırıldı.
  Yerine ölçüyü değiştirmeyen, yuvarlak ve düşük yoğunluklu nötr hover yüzeyi eklendi. İlgili:
  `community/community-parity.css`, `_components/reaction-bar.tsx`.

- **Akış yeni gönderi aksiyonu (2026-08-09)** — Akış başlığındaki yeni gönderi tetikleyicisi,
  dolgulu görünümden beyaz yüzey, ince gri border, siyah metin ve mavi `+` vurgusuna geçirildi.
  Hover yalnız border'ı belirginleştirir; press geri bildirimi ve reduced-motion desteği korunur. Composer
  modalinin yayınlama aksiyonu mevcut primary standardını korur. İlgili:
  `feed/_components/global-composer.tsx`.

- **Shared sekme görsel standardı (2026-08-09)** — `SegmentPillControl` referanstaki sade segmented
  control diline geçirildi: ince açık gri track, beyaz aktif yüzey, siyah aktif metin ve düşük
  yoğunluklu gölge. Framer Motion kayan gösterge ile klavye/reduced-motion davranışları korunur;
  değişiklik Akış ve Plan dahil shared bileşenin tüm tüketicilerine uygulanır. İlgili:
  `apps/web/src/components/segment-pill-control.tsx`.

- **Akış kontrol çubuğu sadeleştirmesi (2026-08-09)** — Akış içindeki ikinci arama alanı
  kaldırıldı; arama yalnız global community header üzerinden yapılır. Sıralama ve kapsamın iki ayrı
  satırda tekrar ettiği yapı, “Öne Çıkan / Yeni / En İyi / Takip Ettiklerim” seçeneklerinden oluşan
  tek shared sekme çubuğuna indirildi. Etiket ve oda türü filtreleri aynı toolbar'ın sağında kalır;
  “Yeni gönderi” aksiyonu başlık satırına taşındı. İlgili: `feed/_components/feed-shell.tsx`.

- **Topluluk Akış standardizasyonu (2026-08-09)** — `/community/feed` başlığı ürün dilinde “Akış”
  olarak sadeleştirildi ve başlık ikonunun dekoratif zemini kaldırıldı. Sıralama/kapsam sekmeleri
  Plan ile aynı shared `SegmentPillControl`, etiket/oda türü filtreleri Hedef ekranlarıyla aynı
  `MenuSelect` bileşenini kullanır. Etiket dropdown'u filtreleme için korunurken keşif trendleri sağ
  rail'deki shared `CommunityTrendRail` içinde gösterilir. Ana kolon 600 px düz post akışına geçti;
  gönderiler avatar–kimlik üst satırı ve arka plansız, eşit dağıtılmış reaction/yorum/paylaş/kaydet
  aksiyonlarını kullanır. İlgili: `feed/_components/{feed-shell,discovery-feed-card}.tsx`.

- **Kompakt post zamanı ve yayınlama ilerlemesi (2026-08-09)** — Topluluk post ve yorum zamanları
  uzun göreli metinler yerine `şimdi`, `4dk`, `3s`, `2g`, `1hf` biçiminde gösterilir; EN karşılıkları
  da aynı yardımcı üzerinden üretilir. Oda composer'ında yayınlama sırasında buton etiketi artık
  değişmez. Bunun yerine alt kenardaki ince progress çizgisi işlem sürerken ilerler, ağ ve sunucu
  kaydı tamamlandığında yüzde 100'e ulaşır; hata halinde sıfırlanır ve reduced-motion tercihine
  uyar. İlgili: `lib/relative-time.ts`, `feed/_components/discovery-feed-card.tsx`,
  `[slug]/_components/thread-composer.tsx`.

- **Oda post composer medya deneyimi (2026-08-09)** — Oda içindeki post oluşturma alanı artık
  oturumdaki kullanıcının gerçek avatarını gösterir. Metin alanı odakta erişilebilir bir sınır alır,
  içerikle birlikte kontrollü biçimde 192 px yüksekliğe kadar büyür ve sonrasında kendi içinde
  kayar. Görsel ekleri küçük chip yerine geniş, kırpılmış medya önizlemesiyle; kaldırma aksiyonunu
  görselin sağ üstünde gösterir. Ortak soru/cevap composer'larının kompakt ek görünümü korunmuştur.
  İlgili: `[slug]/_components/thread-composer.tsx`, `_components/attachment-preview-strip.tsx`.

- **Canlı topluluk motion geçişleri (2026-08-09)** — Framer Motion ile oda ve Gündem tablarında
  spring tab göstergesi + yönlü içerik geçişi, reaction ikonlarında hover/tap/pop geri bildirimi ve
  sidebar linkleri arasında kayan tek active yüzey eklendi. Hareketler yalnız transform/opacity
  kullanır; `prefers-reduced-motion` etkinse süreler kapatılır. Veri yenileyen oda/Gündem tabları
  geçiş sırasında ortak satır skeleton'ını gösterir; yerel Medya/Hakkında geçişlerine yapay bekleme
  eklenmez. Aynı ortak post skeleton'ı Akış'ın ilk/pagination yüklemesinde, oda pagination'ında ve
  mesaj–yorum–soru detaylarının route/client loading durumlarında kullanılır. İlgili:
  `_components/{reaction-bar,zone-sidebar,tab-content-skeleton,post-skeleton}.tsx`,
  `[slug]/_components/zone-shell.tsx`, `trends/_components/trends-shell.tsx`.

- **Topluluk Gündemi sağ rail ve reaction sadeleştirmesi (2026-08-09)** — Oda ekranı masaüstünde
  600 px akış + 24 px boşluk + 300 px sticky Gündem paneline geçti; ilk beş etiketli trend doğrudan
  filtreli Akış'a, “Daha fazlasını göster” ise `/topluluk/gundem` sayfasındaki Keşfet/Sınavım/Genel
  sekmelerine gider. Sınavı olmayan kullanıcıda Sınavım gizlidir; mobilde rail yerine sidebar/drawer
  Gündem bağlantısı kullanılır. Rail hatası gönderi akışını bloklamaz ve sahte fallback üretmez.
  Normal oda ve mesaj detayı breadcrumb'ları kaldırıldı, Q/A soru detayı korundu; Katıl/Ayrıl metinli
  ama 44 px dokunma alanlı kompakt kaldı. Reaction UI tek seçimi boş/dolu kalp ve kutusuz sayaçlarla
  gösterir; seçim değişimi optimistic olarak eski sayıyı azaltıp yenisini artırır. İlgili:
  `community/{[slug],trends}/`, `_components/{community-trend-rail,trend-topic-list,reaction-bar,
zone-sidebar}.tsx`, `lib/{forum,forum-reactions}.ts`, `messages/{tr,en}.json`.

- **Enerjik kampüs görsel katmanı (2026-07-31)** — İlk parity turundaki sakin/editoryal görünüm,
  öğrenci topluluğunun sosyal enerjisini daha iyi taşıyan içerik-temelli bir dile geliştirildi. Mentor
  mavisi (`--color-progress`) seçili navigasyon ve birincil aksiyonları; mercan soru/yanıt çağrılarını;
  yeşil destek, helpful ve
  accepted durumlarını temsil eder. Hub’daki jenerik pastel ikon dekoru kaldırıldı: featured yüzeyi
  artık gerçek oda, başlık, gövde özeti, yazar ve topluluk avatarlarından oluşur. Recent ve alt keşif
  alanlarında tekrarlı floating-card deseni yerine tek yüzey + divider ritmi kullanılır; Emek Panosu
  küçük metric kartları yerine tek ilerleme cümlesidir. Sidebar oda türü sinyalleri ve aktif durumları,
  feed/composer/detail helpful durumları aynı sözlüğe bağlandı. AI-slop guardrail: gradient, glass,
  fake badge, rainbow kart, ornamental blob ve dekoratif page-load motion yok. İkinci damıtma turunda
  başlığı tekrar eden yardımcı metinler kaldırılıp bölüm başlıkları semantik ikonlarla güçlendirildi;
  hover büyütmeleri kaldırılarak yalnız renk/yüzey geri bildirimi bırakıldı. Boş, hata, izin ve
  doğrulama durumlarının yönlendirici metinleri korundu. İlgili tasarım kaydı:
  [`plans/2026-07-31-community-energetic-campus-design.md`](../plans/2026-07-31-community-energetic-campus-design.md).
- **Referans-parity Topluluk çalışma alanı (2026-07-31)** — Topluluk rotaları, Mentor’ın global
  sidebar ve mobil tab bar’ından ayrılan tam ekran bir çalışma alanına taşındı. Hub; editoryal
  featured panel, yatay “Devam ettiklerin” satırları, Emek Panosu özeti ve üç kolonlu etiket/
  destekçi/oda bandıyla referans 4’e; global akış sabit 248px oda navigasyonu, 304px bağlamsal rail,
  sekmeli toolbar ve zengin kartlarla referans 1’e yaklaştırıldı. Oda görünümü breadcrumb + düz kanal
  timeline + katkı verenler rail’iyle referans 5’i; thread/QA detayları içerik → composer → cevaplar
  sırasıyla referans 3’ü izler. Composer referans 2 geometrisinde native `dialog` kullanır; yalnız
  mevcut `Paylaşım/Soru` yetenekleri gösterilir. Görsel sistem route-scope CSS’tir; forum izinleri,
  i18n, API ve 44px/focus davranışı değişmez. Upcoming Event ve gerçek zamanlı kanal davranışı
  eklenmedi. Görsel kabul kullanıcı tarafından manuel yapılır; Playwright eklenmedi. İlgili:
  `community/layout.tsx`, `community-parity.css`, `community-header.tsx`, `hub-shell.tsx`,
  `feed/_components/*`, `zone-shell.tsx`, `message-shell.tsx`, `question-shell.tsx`.
- **Discovery V2 hub ve tek Topluluk ürünü (2026-07-31)** — `/topluluk` artık ilk CHAT odasına
  yönlenmez; featured tartışma, son 30 günlük etkileşimlerden “Devam ettiklerin” + ilgili yeni
  tamamlama, kişisel Emek Panosu özeti, trend etiketler, sırasız “Bu hafta destek olanlar” ve
  katılınmamış oda önerileri sunar. Sol menü `Ana sayfa / Akış / Kaydedilenler / Sıralama` ardından
  CHAT/ANNOUNCEMENT/QA odalarını taşır. `/topluluk/akis` relevant/following kapsamı, üç server-side
  sıralama, etiket/oda filtresi, PII-safe arama, zengin kartlar, global `Paylaşım/Soru` composer ve
  bağlamsal rail kullanır. Oda ilk yükü tek `/zones/:slug/feed` çağrısıdır; detaylar
  `Topluluk > Oda > Başlık` breadcrumb, katılımcı rail ve QA helpful oylarını gösterir.
  Mobil overlay native `dialog` focus trap ve 44px hedefler kullanır; copy TR/EN mirrored.
  Upcoming Event, presence/typing/websocket ve forum metnini LLM'e gönderme özellikle eklenmedi.
  Analitik yalnız onay sonrası kimliksiz yapısal enum/count alanları gönderir. İlgili:
  `community/_components/hub-shell.tsx`, `feed/_components/{feed-shell,discovery-feed-card,
global-composer}.tsx`, `lib/{forum,analytics}.ts`, `messages/{tr,en}.json`.
- **KVKK silme: sosyal graf (WP-K, 2026-07-22)** — Hesap silmede `user_follows` (iki yön) ve
  `buddy_pairs` (her status, iki taraf) hard delete edilir — kimin kiminle çalıştığı ilişkisel PII.
  `SocialErasureService` identity modülünde yaşar (tabloların sahibi orası); `FollowRepository` /
  `BuddyRepository`'ye `deleteAllForUser` eklendi. Related: `social-erasure.service.ts`,
  `test/account-erasure.e2e-spec.ts`.
- **Community namespace and source routes in English (2026-07-19)** — App Router folders and dynamic
  hrefs now use `community`, `feed`, `saved`, `leaderboard`, `member`, `message`,
  `question`, `comment`, and `management`; localized Turkish paths remain under `/topluluk`.
  The i18n namespace moved from `topluluk` to `community`. Related: `routing.ts`,
  `messages/{tr,en}.json`, community route components.
- **Level eğrisi 12 seviyeye uzadı (2026-07-18)** — `TIER_THRESHOLDS` 8→12 seviye, tavan
  3000→10000 XP (`4200, 5600, 7500, 10000` eklendi); Efsane artık tier 12. i18n `level_1..12`
  tr/en güncellendi (yeni isimler: Disiplinli/Öncü/Şampiyon/Zirve; mevcut isimler kaydı —
  economy.enabled default kapalı olduğundan kullanıcı etkisi yok). Web bileşenleri
  `t(level_{tier})` ile dinamik okuduğundan kod değişikliği gerekmedi.
- **Profil bio + web sitesi — `getPublicProfile` enrich (APP-024)** — `PublicProfile` + `getPublicProfile`
  artık `bio`/`website` taşıyor (public-safe kimlik; email yok). Şema/`updateMe`/`AuthUser`/düzenleme formu
  - community profil header/`ProfileCard` gösterimi identity tarafında: [`identity.md`](./identity.md) _(APP-024)_. _(APP-024)_
- **Profil header takip alanları — `getPublicProfile` enrich (APP-022)** — Public profil başlığı artık
  `followerCount`/`followingCount`/`isFollowing` taşıyor. `getPublicProfile` `viewerId` alıp identity
  `FollowService`'ten okur (`isSelf` → `isFollowing:false`); sayaçlar okuma-anında COUNT. Takip **grafı
  identity'de** yaşar (community→forum importu var → grafı community'ye koymak Akış feed'i için forum→community
  döngüsü yaratırdı); community yalnız tüketici, saf orkestrasyon korunur. Takip sistemi + Akış feed'i +
  bildirim forum tarafında: [`forum.md`](./forum.md) _(APP-022)_. _(APP-022)_
- **Public profil başlığı — `getPublicProfile` (APP-018)** — Forum kullanıcı profil sayfası
  (`/topluluk/uye/[username]`) için `CommunityService.getPublicProfile(username)` +
  `GET /v1/community/profile/:username`. `getSummary`'nin özünü (streak/badges/level/xp) **hedef
  kullanıcı** için, **leaderboard hariç**, + public kimlik (displayName/username/avatar/examType/
  memberSince — **email/PII YOK**) döndürür; banlı/askıya-alınmış/olmayan → 404. Yeni tip `PublicProfile`.
  Kimlik+gamification zaten leaderboard'da public olduğundan tutarlı; §3 effort-only korunur.
  Aktivite feed'i forum tarafında (bkz. [`forum.md`](./forum.md)). _(APP-018)_
- **Leaderboard UX rötuş — "yeni" gürültüsü + boş durum + streak/xp kaldırma (APP-018)** — (1) İlk
  hafta önceki dönem verisi olmadığında her satırda "YENİ" gösterilmesi gürültüydü; yeni domain helper
  `resolveMovement` (null/boş baseline → `movement` null, "new" değil) bunu bastırır — gerçek geçmiş
  oluşunca ▲▼/"yeni" anlamlı döner. (2) Sıralama sayfasının altındaki Seri/XP/seviye bloğu (`StatSnapshot`)
  kaldırıldı (Profil/Panel'de zaten var; sayfada tekrar etmiyor) — rozetler yalnız varsa render olur.
  (3) Boş leaderboard (örn. "Bugün" sekmesi) düz metin yerine sıcak ikonlu boş durum (Trophy + mesaj).
  Test: `resolveMovement` unit (null/boş/gerçek baseline) + e2e movement yapısal kontrole çevrildi
  (paylaşılan test DB'sinde komşu-pencere verisi deterministik değil). _(APP-018)_
- **Leaderboard Faz 3 tamamlandı — ▲▼ hareket okları (APP-018)** — Fast-follow kapatıldı. **Snapshot
  tablosu/cron GEREKMEDİ (ponytail):** kapanmış bir dönem sabittir, o yüzden önceki dönemin sıralaması
  **okuma anında** ledger'dan hesaplanır. Yeni `LedgerRepository.xpRanksBetween(examType, since, until)`
  (kapalı pencere `[prevStart, curStart)` → userId→rank map) → `EconomyService.getPreviousRanks`. Domain:
  `previousWindowStart` (curStart − 1 dönem; Istanbul sabit +3, DST yok) + `computeMovement` (düşük rank =
  ▲). `CommunityService.buildLeaderboard` her satıra + `me`'ye `movement` ekler; `all_time` → `null`
  (anlamsız). Tip: `RankMovement` + `LeaderboardEntry.movement`. Frontend `MovementIndicator`: ▲ sakin
  yeşil (yeni `--color-success` token), ▼ **mat gri (kırmızı DEĞİL — §4 anti-shaming)**, "yeni" chip,
  "aynı" tire; podyum/senin-durumun/liste. İlk hafta veri yokken herkes "yeni". Test: unit 7/7
  (`computeMovement`/`previousWindowStart` dahil) + e2e 3/3 (all*time→null, weekly→"new"). *(APP-018)\_
- **UI/UX polish — badge'ler + creative podyum + token bug fix (APP-018)** — Referans leaderboard'lardan
  ilham. (1) **Seri/XP badge'leri** (`StatSnapshot`, hem sayfa hem drawer): renkli dolu ikon-çipi
  (Seri → altın `--color-star`, XP → mavi `--color-progress`), her ikisinde de koyu ikon (kontrast ≈7:1,
  beyaz-mavi 2.4:1'i reddettik), ince kenarlık + `tabular-nums`. (2) **Creative top-3 podyum** — küçük
  rank rozeti kaldırıldı; yerine **kaideli basamak** (2/1/3 büyük League Spartan rakamı, kazanan en yüksek;
  altın/gümüş/bronz gradient). Full sayfada kaide `scaleY` (origin bottom) ile yükselir (reduced-motion
  saygılı); mini podyumda statik kompakt kaide. (3) **Bug:** `--color-cta` token'ı hiç tanımlı değildi →
  `color-mix(... var(--color-cta) ...)` geçersiz → senin-durumun/isMe highlight'ları render OLMUYORDU;
  tanımlı `--color-accent` (mavi) ile değiştirildi. Not: `zone-sidebar.tsx` de aynı tanımsız token'ı
  kullanıyor (pre-existing, ayrı follow-up). Dokunulan dosyalar lint-temiz. _(APP-018)_
- **UI/UX polish — duplikasyon kaldırma + animasyon (APP-018)** — impeccable + ui-ux-pro-max +
  web-design-guidelines geçişi. (1) **Duplikasyon:** `/topluluk/siralama` sayfası zaten tam leaderboard
  olduğu için sağ companion (EffortBoard aside + `EffortBoardDrawer` trigger) o rotada gizlendi — yeni
  `HideOnRanking` client wrapper (`usePathname === "/topluluk/siralama"` → null); feed/thread sayfaları
  companion'ı korur. Merkez `max-w-md mx-auto` olduğu için boşluk oluşmaz. (2) **Animasyon** (hepsi
  `prefers-reduced-motion` saygılı, transform/opacity + ease-out): XP sayıları `useCountUp` ile 0→değer
  (ease-out-quart, `tabular-nums` ile jitter'sız); sekme göstergesi framer-motion `layoutId` ile kayar
  (reduced-motion'da crossfade); sekme değişiminde board `key={activeWindow}` ile fade+stagger replay.
  Lint: dokunulan dosyalar temiz (`useCountUp` setState'i yalnız rAF içinde — `set-state-in-effect`
  kuralına uygun). _(APP-018)_
- **Code-review fix'leri — leaderboard error state'leri (APP-018)** — `/code-review` (code-reviewer +
  senior-architect + ponytail) bulguları kapatıldı: (1) `LeaderboardScreen` summary fetch fail olunca
  "Yükleniyor…" yerine artık `t("error")` gösterir; (2) sekme (Bugün/Tüm zamanlar) fetch'i fail olursa
  kalıcı iskelet yerine **hata + "Yenile"** butonu (`failedWindows` seti; retry pencereyi setten çıkarıp
  refetch tetikler) — sessiz yutma yok. (3) Servis kataloğu (`api.md §6`) yeni `/v1/community/leaderboard`
  endpoint'iyle güncellendi. Devnote: repo `docs/devnotes/` kullanmıyor → feature-timeline konvansiyonu
  (bu dosya) geçerli. Açık kalan düşük-öncelik follow-up'lar:
  `WindowTabs` klavye ok-navigasyonu (roving tabindex), `MEDAL` sabiti dup'ı, FE yüzdelik hesabının
  backend'e taşınması. _(APP-018)_
- **Leaderboard Faz 3 — zaman sekmeleri + Europe/Istanbul (APP-018)** — Tam sayfaya Bugün/Hafta/Tüm zamanlar
  sekmeleri. `LeaderboardView.window` tipi `today|weekly|all_time` olarak genişledi. Yeni
  `GET /v1/community/leaderboard?window=` endpoint'i (`CommunityService.getLeaderboard` + paylaşılan
  `buildLeaderboard`); `getSummary` haftalık board'u aynı builder'dan üretir. Pencere sınırları
  `domain/leaderboard-window.ts` → **Europe/Istanbul** (sabit +03:00, DST yok): `windowStart`
  (today=Istanbul gün başı, weekly=Istanbul Pazartesi, all*time=epoch) + `toWindow` (bilinmeyen→weekly).
  Frontend: segmented `WindowTabs`, pencere-başına lazy fetch + cache (weekly summary'den seed), Istanbul
  reset geri sayımı (all_time'da gizli). Çekmece haftalık kalır (sekme yok). ▲▼ okları hâlâ ertelendi
  (mat gri ▼ tonuyla, fast-follow). Testler: `leaderboard-window.spec` 5/5 (Istanbul gece-yarısı kenar
  durumu dahil) + community e2e 3/3 (windowed endpoint + garbage→weekly). Orval regen gerekmez. *(APP-018)\_
- **Çekmece mini-podyum + podium arka planı (APP-018)** — Sağ panel/çekmece artık düz liste (`LeaderboardCard`,
  silindi) yerine kompakt `MiniLeaderboard`: top-3 mini podyum + senin-sıran kartı + "Tümünü gör →". Yeni
  tasarım artık tıklamadan panelde görünür. Tam sayfada podyum arkasına AI görseli bağlandı
  (`public/leaderboard/podium-bg.png`, beyaza feather'lı, sakin ton korunur); çekmece hafif kalsın diye
  sadece CSS gradient kullanır (1.3MB görsel yüklenmez). Follow-up: görseli webp'e çevir. _(APP-018)_
- **Leaderboard redesign Faz 2 — avatarlar + yüzdelik (APP-018)** — `LeaderboardEntry.avatarUrl` ve
  `LeaderboardView.totalParticipants` eklendi (`packages/types/src/community.ts`). Ledger
  `xpLeaderboardSince` artık `users.avatar_storage_key`'i de join eder (`XpLeaderRow.avatarStorageKey`);
  yeni `xpParticipantCountSince` (cohort'ta XP>0 distinct kullanıcı) → `EconomyService.getXpParticipantCount`.
  `CommunityService` StoragePort inject eder (`@Global`), her satır için `getPublicUrl(key)` ile avatarUrl'i
  çözer (economy saf kalır; community yalnızca orkestrasyon — tablo dokunmaz). Frontend: podyum/senin-durumun/
  liste gerçek avatar; cesaret bandı "Katılımcıların %X'inden öndesin" (yalnızca ≥%1 → asla "%0"; top-1/3
  kutlama mesajları öncelikli). Orval regen gerekmez (community raw `http<CommunitySummary>` kullanır).
  Test: community e2e'ye `totalParticipants` + `avatarUrl` assertion'ları (2/2 geçti). _(APP-018)_
- **Leaderboard redesign — tam sayfa `/topluluk/siralama` (Faz 1, APP-018)** — Referans-tabanlı redesign;
  guardrail: efor/XP only, sakin, anti-shaming (koyu gaming DEĞİL, açık marka). Yeni route
  `topluluk/siralama` → `LeaderboardScreen`: haftalık reset geri sayımı (client'ta Pazartesi 00:00 UTC'den
  türetilir), pozitif cesaret bandı (`me.rank`'e göre; asla düşük sıra utandırmaz), top-3 **podyum**
  (#1 ortada + taç + mat altın/gümüş/bronz halka), vurgulu "Senin durumun" kartı, tam liste, seviye+rozet
  (StatSnapshot/BadgeStrip reuse). Hareket: framer-motion kademeli giriş, `prefers-reduced-motion` saygılı.
  Kompakt panoya (`EffortBoard`) "Tümünü gör →" linki. i18n: `topluluk.rank_*`. Backend YOK (mevcut
  `/community/summary`). Plan: `docs/plans/2026-07-04-leaderboard-redesign-design.md`. Faz 2 (avatar +
  yüzdelik) ve Faz 3 (sekmeler + ▲▼) ertelendi. _(APP-018)_
- **Emek Panosu mobil erişimi — sağ çekmece (APP-018)** — Sağ kolon (`EffortBoard`) yalnızca `xl+`'de
  görünüyordu; mobil/tablette hiç erişilemiyordu. Yeni `EffortBoardDrawer` (`xl:hidden`) sol `ZoneDrawer`
  desenini yansıtır: sağ üstte "Sıralama" (Trophy) pill'i, dokununca sağdan kayan panelde profil + XP +
  leaderboard. `EffortBoard` yalnızca ilk açılışta mount edilir (drawer kapalıyken `/community/summary`
  fetch'i yok). `xl+`'de eskisi gibi sabit sağ sütun. i18n: `topluluk.board_open`/`board_close`.
  Not: `EmekPanosu`/`EmekDrawer` bileşenleri `EffortBoard`/`EffortBoardDrawer` olarak İngilizceye
  çevrildi (route slug'ları — `topluluk` vb. — Türkçe kalır, onlar URL).
  Gotcha: trigger `fixed top-[3.75rem]` global header altına hizalı, `z-20` (backdrop z-[29], panel
  z-30). _(APP-018)_
- **Emek Panosu — sağ kolon efor panosu (APP-017)** — `/topluluk` sağ kolonu statik profil kartından
  canlı bir "emek panosu"na çevrildi. Yeni `community` modülü (`GET /v1/community/summary`): haftalık,
  sınav-tipi bazlı XP leaderboard (SQL toplama, Redis yok — `ledger_entries` üzerinde `unit='XP'`
  sabit filtreli; top-10 + "senin sıran"), türetilmiş kimlik rozetleri (`domain/badges.ts`, tablo yok
  — Maraton/Gece Kuşu/Motivatör/Yeni Yoldaş, hep pozitif), XP kademesinden türetilen seviye
  (`domain/level.ts`). `economy.enabled` kapalıyken streak + rozetler görünür, xp/level/leaderboard
  `null` → UI zarifçe küçülür. **Efor sıralanır, net/sonuç ASLA.** XP'yi canlandırmak için gönderi
  yazımına XP eklendi (`ThreadPostedListener`, `forum.xp.thread_posted` + günlük cap; idempotent,
  best-effort). Web: `EmekPanosu`/`StatSnapshot`/`BadgeStrip`/`LeaderboardCard` + `lib/community.ts` +
  tr/en i18n. DB migration yok. Testler: badges/level saf fonksiyon specleri, listener spec (cap +
  idempotent + economy-off), community e2e (zarif küçülme + haftalık sıralama). _(APP-017)_
- **Code-review fix — cross-module table access kaldırıldı (APP-017)** — İlk sürümde `community` repo'su
  başka modüllerin tablolarını (`ledger_entries`, `streak_state`, `forum_posts`) doğrudan okuyordu
  (blocking, senior-backend §Modules). Düzeltildi: leaderboard aggregate'i **economy**'ye taşındı
  (`EconomyService.getXpLeaderboard/getXpStanding` — ledger'ın sahibi), streak **coaching**'e
  (`StreakService.getCurrentStreak`, yan-etkisiz snapshot), rozet sinyalleri **forum**'a
  (`ForumService.getAuthorActivity`), profil **identity** `UsersService.getMe`. `community.repository.ts`
  silindi; modül artık tablo sahibi değil, sadece public servisleri orkestre ediyor. Service catalog
  (`api.md §6`) güncellendi. _(APP-017)_

- **Yol arkadaşı v1 (2026-07-17)** — Karşılıklı onaylı 1-1 accountability partner: profil sayfasından
  kullanıcı adına istek → karşı taraf /seans'taki buddy kartından kabul eder; tek aktif buddy/kullanıcı.
  İlişki `identity`'de (`buddy_pairs`, migration `0053`; RLS'siz SERVICE-context repo — `user_follows`
  emsali; decline/cancel/ayrıl = satır silinir). Partner kartı kompozisyonu community'de
  (`BuddyViewService` + `BuddyController`, `/v1/buddy*`): partnerin bugünkü odak dakikası + streak —
  **yalnız çaba, asla sonuç/net (§4)**. Dürtme: yön başına 4 saat cooldown (pair satırında timestamp),
  cooldown'da 429. Bildirimler mevcut FORUM kategorisi + `identity-events.listener` kalıbıyla
  (istek/kabul/dürtme → `linkUrl: /seans`). Profil butonu `PublicProfile.buddyStatus` ile sürülür
  ("unavailable" = başkasıyla aktif → buton yok). Gotcha: accept tx'i her iki tarafın diğer PENDING
  satırlarını temizler (UPDATE `returning` ile doğrulanır — kabul anında iptal edilen istek 409 döner);
  partial unique indeksler DB kemeri, asıl güvence tx içi re-check.
  **Bilinçli v1 kararları (kapsam dışı):** aktif buddy'si olana gönderilen istek beklemede tutulur (iptal
  edilmez); bir taraf BAN/SUSPEND olsa bile ACTIVE çift kartta görünür kalır (kullanıcı "ayrıl"la
  çıkabilsin diye — gizlenmiş görünmez eşleşme yok). İlgili:
  `identity/{buddy.repository,buddy.service}`, `community/{buddy-view.service,buddy.controller}`,
  `session-buddy-card.tsx`, `profile-header.tsx`, `lib/buddy.ts`, hata kodları `SOCIAL_BUDDY_*`.

- **Yol arkadaşı keşfi (2026-07-17)** — Buddy'nin cold-start boşluğu kapatıldı: artık istek göndermek
  için kullanıcı adı bilmeye gerek yok. `/seans` buddy kartının boş durumu, aynı sınav türü kohortundan
  (`suggestCohortPeers`, newest-first) henüz eşleşmemiş kullanıcıları satır-içi listeler; tek tıkla istek
  gönder → kart pending'e döner. Yeni: `GET /v1/buddy/suggestions` (sabit limit 5) →
  `BuddyViewService.getSuggestions` → `BuddyService.getSuggestionCandidates` (kohort havuzunu `limit*4`
  tamponuyla çekip `BuddyRepository.listRelatedOrActivelyPairedIds` ile eler). **Elenenler:** kendisi,
  viewer ile herhangi bir ilişkisi olan, zaten ACTIVE buddy'si olan aday (eşleşemez); viewer zaten aktifse
  öneri boş. Guardrail: kohort sınav türüne göre (çaba/sosyal — sonuç yok), ref'ler public-safe (PII yok).
  Öneri yoksa mevcut sessiz `/topluluk` link fallback'i kalır. Aktivite-duyarlı sıralama v2'ye ertelendi.
  İlgili: `buddy.repository.ts` (`listRelatedOrActivelyPairedIds`), `buddy.service.ts`
  (`getSuggestionCandidates`), `buddy-view.service.ts`, `buddy.controller.ts`, `session-buddy-card.tsx`
  (`BuddyEmptyState`), `lib/buddy.ts` (`getBuddySuggestions`).
  **Ek (2026-07-18):** Öneriler rastgele kohorttu; belirli bir arkadaşı davet etmenin kart üstünde yolu
  yoktu (yalnız profil sayfasındaki buton). `BuddyEmptyState`'e her zaman görünen **kullanıcı adıyla davet
  kutusu** eklendi (@handle → mevcut `sendBuddyRequest`; kullanıcı yoksa "bulunamadı" toast'ı, varsa kart
  pending'e döner). Yeni endpoint yok — mevcut `POST /v1/buddy/requests/:username` yeniden kullanıldı.

- **Yol arkadaşı aktivite sinyali (2026-07-18)** — Buddy accountability döngüsüne pasif sinyal
  eklendi: bir kullanıcı günün ilk qualifying seansını tamamladığında (mevcut `FIRST_SESSION` event'i)
  aktif yol arkadaşına "Yol arkadaşından haber — {ad} bugün ilk seansını tamamladı 👏" in-app bildirimi
  düşer (`linkUrl: /seans`). Yeni `BuddyActivityListener` (notifications) `getActivePair` ile partneri
  çözer, `NotificationDeliveryRepository.tryRecord` ile günlük dedupe eder, aktör adını
  `UsersRepository.findByIdService` ile alır. Buddy'siz kullanıcı tek sorguda döner (hot-path büyümez).
  **Çaba-odaklı** (seans tamamlandı — sonuç/net yok; partner bu bilgiyi zaten buddy kartında görüyor,
  yeni ifşa yok), kategori FORUM. Best-effort — event emit'ini kırmaz. Yeni endpoint/migration yok.
  Kapsam dışı (bilinçli): "hedefe ulaştı" varyantı — öyle bir event yok (quest-only), yeni emit ister.
  İlgili: `notifications/application/listeners/buddy-activity.listener.ts`, `notifications.module.ts`,
  `coaching/application/session.service.ts` (FIRST_SESSION emit — değişmedi).

- **Yol arkadaşı canlı presence + birlikte-çalış daveti (2026-07-18)** — Buddy döngüsü "asenkron
  snapshot"tan "birlikte çalışma" hissine taşındı (senkron oda değil — o Faz 2/Redis). (1) **Canlı
  presence:** `GET /v1/buddy` active view'ına `partnerStudyingNow` eklendi — partnerin şu an
  IN_PROGRESS bir seansı var mı (`SessionService.isStudyingNow` → `hasActiveSession`, 120 dk pencere,
  partnerin kendi RLS bağlamında okunur; stale IN_PROGRESS satırları pencere sınırlar). Kart aktifken
  ~60 sn'de bir sessizce yenilenir (poll); "şu an odakta" yeşil nabız göstergesi (`--color-success`).
  (2) **Birlikte çalış daveti:** `POST /v1/buddy/study-invite` → partnere "…seninle çalışmak istiyor —
  sen de bir seansa başla 🔥" bildirimi (`BUDDY_STUDY_INVITE` event). Nudge ile **paylaşımlı cooldown**
  (`pokeBuddy` helper — yön başına 4h; migration yok, anti-spam). Partner zaten çalışıyorsa davet butonu
  gizlenir (presence noktası zaten "katıl" ipucu). Guardrail: çaba-odaklı, iki taraf da rızalı, partner
  bu bilgiyi zaten kartta görüyor. İlgili: `study-session.repository.ts` (`hasActiveSession`),
  `session.service.ts` (`isStudyingNow`), `buddy.service.ts` (`pokeBuddy`/`sendStudyInvite`),
  `buddy-view.service.ts`, `buddy.controller.ts`, `identity-events.listener.ts`, `session-buddy-card.tsx`.

- **Davet modalı + iki bug fix (2026-07-18)** — (1) **Davet modalı:** davet artık bildirim
  çekmecesine gömülmüyor; alıcıya tipli `study_invite` SSE olayı gidiyor ve app-shell'de
  `useDialog().promo` modalı açılıyor ("… seninle çalışmak istiyor 🔥 · Başla → `/seans`").
  Bildirim kalıcı/asenkron kayıt olarak korunuyor. (2) **Bug: modal hiç gelmiyordu** — tipli olay
  fire-and-forget'ti, alıcının SSE akışı o an bağlı değilse (iki pencere arası geçişte tipik
  durum) kayboluyordu. Artık bağlı akış yoksa olay **TTL'li kuyruğa** alınıyor
  (`REALTIME_QUEUE_TTL_MS`, 5 dk) ve alıcının bir sonraki stream bağlantısında flush ediliyor;
  tek sefer teslim edilir. (3) **Bug: "şu an odakta" yanlış görünüyordu** — presence 120 dk'lık
  düz pencere kullanıyordu, bu yüzden yarım kalmış (sekme kapanmış) IN_PROGRESS satırları saatlerce
  "çalışıyor" gösteriyordu. Artık ortak `runningNow` yüklemi seansın **kendi planlanan süresi +
  `ACTIVE_SESSION_GRACE_MINUTES`** ile sınırlıyor (stale-cleanup'ın bound'uyla aynı); aynı düzeltme
  toplu "N kişi odaklanıyor" sayacına da uygulandı. Ceiling: client heartbeat'i yok — yetim bir satır
  kendi planlanan sonuna kadar aktif okunabilir. İlgili: `notifications.service.ts`
  (`pushRealtimeEvent` kuyruk + `createStream` flush), `study-session.repository.ts` (`runningNow`),
  `notification-drawer-shell.tsx`, testler: `realtime-queue.spec.ts`, `session.service.spec.ts`.

- **Topluluk hub editoryal redesign (2026-08-08)** — Topluluk çalışma alanının markası **Mentor**
  olarak sadeleştirildi; header ve oda ikonlarındaki renkli kutular ile oda satırlarındaki mesaj
  sayaçları kaldırıldı, sidebar yoğunluğu azaltıldı. Hub'daki öne çıkan tartışma üçüncü görseldeki
  editoryal hiyerarşiyle mevcut Mentor dilini birleştirecek biçimde `public/img/feed.png`, güçlü başlık,
  kompakt meta ve siyah birincil/çerçeveli ikincil eylemlerle yeniden kuruldu. “Devam ettiklerin”
  satırları sıkılaştırıldı; hover animasyonu ve ok arka planları kaldırıldı. **Emek Panon** kişisel
  streak/XP özetinden arındırılıp trend, destek verenler ve oda keşfine odaklandı; boş durumlar akışa
  yönlendiren öğretici panellere dönüştürüldü. Takip revizyonunda gri boş durum yüzeyi yumuşak mavi
  vurguya taşındı ve oda “Katıl” eylemleri erişilebilir adı koruyan kompakt `+` kontrollere çevrildi.
  Kullanım: `/topluluk`; masaüstünde iki kolon, mobilde
  sıralı tek kolon. Gotcha: coin/XP topluluk keşif yüzeyine geri eklenmemeli; kişisel ekonomi kendi
  yüzeyinde kalır. İlgili: `community/{community-parity.css,_components/{hub-shell,zone-sidebar,
community-header}.tsx}`, `feed/_components/global-composer.tsx`, `messages/{tr,en}.json`,
  `e2e/community-hub.spec.ts`.
  **Ek (2026-08-09):** Hub keşif yüzeyi olarak sadeleştirildi; üstteki yinelenen “Topluluk” başlığı
  ve bağlamsız global “Yeni gönderi” aksiyonu kaldırıldı. Gönderi oluşturma oda/Q&A bağlamında kalır;
  loading skeleton da kaldırılan header boşluğunu üretmez. Header çıkışı dairesel, ince çerçeveli
  sol-chevron kontrolüne dönüştürüldü; locale-aware `CircularBackLink` shared bileşeni giriş ekranında
  da kullanılarak ölçü, focus ve reduced-motion davranışı ortaklaştırıldı.

- **Topluluk oda sayfası redesign (2026-08-08)** — `/topluluk/[slug]` oda ekranı X topluluklarının
  okunabilir bilgi mimarisinden yararlanılarak Mentor dilinde yeniden kuruldu: `feed.png` kapak,
  başlık/tür/üye özeti, gerçek paylaşım ve katılma aksiyonları, Popüler–En Son–Medya–Hakkında
  sekmeleri ve 600 px odaklı gönderi akışı eklendi. Katkı verenler ile sabit gönderiler kalıcı sağ
  rail yerine Hakkında sekmesine taşındı. Gönderi aksiyonları eşit dağıtıldı; hover yüzeyi kaldırılıp
  ikon kalınlığı geri bildirim olarak kullanıldı. Bildirim aboneliği kalıcı API desteği olmadığı için
  sahte bir toggle olarak eklenmedi. Medya sekmesi mevcut/yüklenmiş sayfadaki ekli gönderileri süzer.
  İlgili: `[slug]/_components/{zone-shell,zone-shell-skeleton,thread-item}.tsx`,
  `_components/{reaction-bar,send-button,bookmark-button}.tsx`, `community-parity.css`,
  `messages/{tr,en}.json`.

- **Topluluk global arama paneli (2026-08-09)** — Header araması tek sayfalık yönlendirme yerine
  desktopta merkez dialog, mobilde safe-area uyumlu tam ekran keşif yüzeyi olarak yenilendi. En az iki
  karakterde 250 ms gecikmeyle topluluk/oda, gönderi, Q/A sorusu, etiket ve public-safe kişi sonuçları
  ayrı gruplarda gelir; ok tuşları + Enter, Escape ve `Ctrl/⌘ + K` desteklenir. Boş sorguda son beş
  cihaz araması ile mevcut `/v1/forum/trends` gündemi gösterilir; geçmiş yalnız localStorage'dadır ve
  temizlenebilir. Panel ve arka perde Framer Motion ile kısa fade/yükselme animasyonu kullanır;
  kapanış native dialog kapanmadan tamamlanır ve reduced-motion tercihi korunur. Son arama/gündem
  satırları kompaktlaştırıldı; klavye aktifliği ve hover aynı yumuşak yüzey geri bildirimini kullanır.
  `/v1/forum/search`
  geriye uyumlu `threads/tags/people` alanlarını koruyup `questions`
  ve `zones` alanlarıyla genişletildi; yalnız public, arşivlenmemiş odalar ve silinmemiş içerikler
  aranır. Gotcha: quick actions ve sunucuda arama geçmişi bilinçli olarak yoktur; resmi sınav bilgisi
  bu aramanın kaynağı değildir. İlgili: `forum-discovery.{service,repository}.ts`, `@mentor/types/forum`,
  `community-search.tsx`, `community-search-history.ts`, `community-parity.css`, `messages/{tr,en}.json`.

- **Gönderi medya oranı (2026-08-10)** — Akış, oda ve detay yüzeylerinin ortak
  `AttachmentGallery` bileşeni tüm gönderilerde sabit 16:9 medya çerçevesine geçirildi. Tek ve çoklu
  görseller kartta `object-fit: cover` ile eşit boyutta gösterilir; tıklanınca mevcut lightbox içinde
  kırpılmamış `object-contain` hali açılır. Üçlü galeri aynı çerçevede bir büyük + iki küçük karo kullanır.

- **Post detayı ve hızlı yanıt deneyimi (2026-08-10)** — CHAT/ANNOUNCEMENT gönderi ve yorumlarının
  reply aksiyonu community layout seviyesindeki tek `CommunityQuickReplyProvider` üzerinden açılan
  ortak composer dialoguna bağlandı. Dialog desktopta merkez, mobilde safe-area uyumlu tam ekran
  çalışır; kaynak yazar/tarih/metin özeti ile ilk görselin tıklanabilir URL’sini gösterir ve mevcut
  `postComment`/`postReply` çağrılarını kullanır. Başarılı yanıtta çağıran akışın comment/reply sayacı
  güncellenir; hata halinde taslak ve dialog korunur. Normal post ve yorum detayları 600 px thread +
  300 px sticky Gündemde rail düzenine geçti; Katılımcılar rail'i kaldırıldı, inline composer ve
  `CommunityCoachBridge` korundu. Kullanım: post gövdesi ayrı detay sayfasını, comment ikonu hızlı
  yanıt dialogunu açar; yazarın `@username` alanları profil sayfasına gider. Gotcha: Q/A akışı ve
  video attachment desteği bu kapsamda değiştirilmedi.
  İlgili: `community/_components/community-quick-reply.tsx`, `thread-item.tsx`, `comment-row.tsx`,
  `message-shell.tsx`, `comment-shell.tsx`, `community-parity.css`.

- **Mobil detay başlığı ve koç köprüsü hizası (2026-08-10)** — Topluluk kabuğunun dashboard'a
  dönen sol üst kontrolü, detay içindeki geri navigasyonundan ayrıştırılarak ortak dairesel kontrolün
  `close` varyantına geçirildi. `CommunityCoachBridge` mobilde iki satıra kaymak yerine, dar alanda
  metni güvenle kısaltan tek satırlı bilgi + aksiyon düzeni kullanır. Detay başlığındaki sol-chevron
  geri kontrolü korunur. İlgili: `circular-back-link.tsx`, `community-header.tsx`,
  `community-coach-bridge.tsx`.

- **Topluluk üye profili redesign (2026-08-11)** — `/topluluk/uye/[username]` mobilde mevcut
  avatarı portre hero olarak kullanan, görüntü hatasında kullanıcıya özel pastel fallback'e düşen
  kimlik yüzeyine geçirildi. Premium üyelik yalnız `EntitlementService` üzerinden alınan public-safe
  boolean ile ışıltı rozeti olarak gösterilir; takipçi, takip edilen ve silinmemiş thread +
  yorum/yanıtların toplamından oluşan aktivite sayacı hero içinde yer alır. Paylaş aksiyonu Web Share
  API'yi, desteklenmeyen cihazlarda pano kopyalamayı kullanır; takip ve yol arkadaşı davranışları
  korunur. Desktopta 600 px profil/akış ile 300 px sticky ilerleme paneli; mobilde sekmelerden önce
  aynı panel kullanılır. Panel önceki–mevcut–sonraki seviyeyi keskin inline SVG medallionlarla,
  XP ilerlemesini ve kazanılmış badge açıklamalarını gösterir. Posts/Bookmarks seçimi URL geçmişine
  yazılır; doğrudan `?tab=bookmarks` ve tarayıcı geri/ileri davranışı korunur. Gotcha: avatar ayrı bir
  cover değildir; Premium rozeti doğrulanmış hesap işareti değildir ve abonelik nedeni/süresi public
  sözleşmeye çıkmaz. İlgili: `community.service.ts`, `forum-post.repository.ts`,
  `@mentor/types/community`, `profile-{header,shell}.tsx`, `profile-level-window.ts`, `badge-strip.tsx`,
  `messages/{tr,en}.json`.
  **Polish (2026-08-12):** Mobilde ayrı 52 px “Kanallar” satırı kaldırıldı; erişilebilir 44 px hamburger
  tetikleyicisi topluluk üst barına taşındı ve drawer kapanışında odak tetikleyiciye döner. Swipe-only
  gezinme, keşfedilebilirlik ve sistem geri hareketiyle çakışmaması için eklenmedi. Profil avatarı üst
  medya alanında maskeyle beyaz kimlik yüzeyine erir; isim artık görselin opak bölgesiyle çakışmaz.
  Premium işareti doğrulama tikinden ayrışan sıcak sparkle seal’e çevrildi. Yolculuk paneli ink zemin +
  mavi aktif ilerleme hiyerarşisini korurken yumuşak geçiş ışığı, belirgin mevcut medallion ve kart
  yerine sade badge satırlarıyla hafifletildi. İlgili: `community-header.tsx`, `zone-drawer{-context}.tsx`,
  `community-parity.css`, `profile-header.tsx`, `profile-shell.tsx`, `badge-strip.tsx`.
  **İnce ayar:** Hero tabanı beyaza ayrılarak medya zemininden sızan mavi sınır kaldırıldı; yolculuk
  panelindeki iki yinelenen açıklama ve işlevsiz dekoratif sparkle kaldırılarak seviye, XP ve kazanımlar
  tek bakışta okunur hale getirildi. Mobil yolculuk panelinin padding, medallion, bölüm aralığı ve
  açıklamalı rozet yoğunluğu sıkılaştırıldı; desktop ölçüleri korunurken 375 px görünüm için kart
  yüksekliği regresyon sınırı eklendi. Topluluk başlığı ve ortak uygulama kabuğundaki kullanıcı
  avatarları artık hesap merkezine değil, oturumdaki kullanıcının public topluluk profiline gider.
  **Profil/ayarlar ayrımı (2026-08-12):** Public kimlik yüzeyi `/topluluk/uye/[username]` altında
  kalırken hesap, bildirim ve uygulama tercihleri `/ayarlar` altında toplandı. Sol navigasyondaki
  “Profil” girişi dişli ikonlu “Ayarlar” olarak yenilendi; public profildeki düzenleme aksiyonları ve
  ayar gerektiren uygulama bağlantıları yeni adrese taşındı. Eski `/profil` adresi yer imleri ve dış
  bağlantılar bozulmasın diye `/ayarlar` adresine yönlenir. Kullanıcı adı bulunmayan avatar bağlantısı
  güvenli fallback olarak Ayarlar'ı açar. İlgili: `i18n/routing.ts`, `app-nav.tsx`,
  `(app)/{profile,settings}/page.tsx`, `community/member/[username]/_components/profile-header.tsx`.
  Kendi profilindeki hero kalem ikonu, aynı hedefe giden iki düzenleme aksiyonu oluşturmaması için
  kaldırıldı; aksiyon satırındaki metinli “Profili düzenle” bağlantısı tek birincil düzenleme girişi
  olarak bırakıldı. Bu bağlantı `/ayarlar?section=profile` adresini açar ve profil düzenleme panelini
  doğrudan gösterir; kullanıcı genel Ayarlar sayfasında ilgili alanı aramak zorunda kalmaz. Diğer
  kullanıcı profillerindeki sağ üst overflow menüsü değişmedi.
  **Detay navigasyonu (2026-08-13):** Üye profilinde üst üste görünen topluluk çıkış `X` kontrolü
  ve hero geri oku tek kontrole indirildi. Community header, üye profili route'unda `X` yerine
  `/topluluk` hedefli geri oku gösterir; hero içindeki yinelenen geri kontrolü kaldırıldı. Topluluk
  ana yüzeylerinde panel çıkışını sağlayan `X` davranışı korunur.
  **Hero görsel geçişi (2026-08-13):** Profil fotoğrafı blur, maske veya sis efekti olmadan keskin
  gösterilir. Kimlik alanı, referans görünümdeki gibi fotoğrafın altına hafifçe binen ve yalnız üst
  köşeleri yuvarlatılmış beyaz yüzeydir; isim, üyelik bilgisi ve sayaçlar bu sabit yüzeyde kalır.
  Böylece farklı avatar renklerinde geçiş tonu değişmez. İlgili: `profile-header.tsx`,
  `community-parity.css`, `community-member-profile.spec.ts`.
  **Görsel polish:** Kimlik yüzeyinin fotoğrafa oturuşu ince üst ayrımla netleştirildi; isim ölçüsü ve
  harf aralığı uzun Türkçe adlarda daha dengeli hale getirildi. Premium seal optik olarak küçültüldü;
  paylaş, takip ve düzenleme aksiyonlarına 150–250 ms hover/press geri bildirimi eklendi. Hareketler
  `prefers-reduced-motion` altında kapanır ve 44 px dokunma hedefleri korunur.
  **Hero kompozisyon oranı:** Aksiyonların hero dışında devam etmesi nedeniyle matematiksel `%50/%50`
  bölünme görseli gereğinden fazla kısaltıyordu. Referansın optik yarı-yarıya dengesi için portre hero
  yüksekliğinin yaklaşık `%60`ını kaplar; kompakt kimlik yüzeyi ve hemen altındaki aksiyonlar kalan
  görsel ağırlığı dengeler. Fotoğraf panelin arkasında 8 px devam eder; token tabanlı 1 px üst/yan
  sınırlar korunur.
  **Editorial sport polish:** Premium işareti rozet benzeri sarı daire yerine küçük, tek renk brass
  sparkle olarak sadeleştirildi. Yan aksiyonlarda geniş gölge yerine 1 px sınır ve yüzey hover'ı
  kullanılır. Seviye panelindeki radial glow, üst parıltı ve mobil blur halo kaldırıldı; koyu yüzey,
  aktif mavi medallion ve XP çizgisi tek vurgu sistemi olarak bırakıldı.
  **Desktop avatar düzeni:** Mobil portre hero korunurken `xl` görünümde büyük portre banner
  tekrarı kaldırıldı. Ayrı cover verisi bulunmadığından desktop, nötr cover yüzeyi üzerine binen
  104 px dairesel avatar kullanır; kimlik, sayaçlar ve aksiyonlar sola hizalanır. Desktop profil
  kolonundaki dış border kaldırılır, mobildeki çerçeveli yüzey değişmez.
  Desktop aksiyon grubu, cover'ın hemen altındaki avatar bindirme bandında sağ üste konumlanır;
  Twitter benzeri biçimde avatarla aynı yatay bölgede görünür. Mobildeki ortalanmış
  share/takip/düzenleme düzeni korunur.
  **Desktop yoğunluk polish:** Cover 180 px, hero 360 px ve avatar 96 px olarak sıkılaştırıldı.
  Bio/website bulunmayan profillerde aksiyon grubunun eski akış boşluğu kaldırılır; sayaçlardan
  sekmelere uzanan işlevsiz beyaz alan azaltılır. Bio bulunan profiller gerekli alt ritmi korur.
  Desktop sayaç grubu kimlik başlangıcına 8 px yaklaştırıldı. Aksiyon grubu sağ kenardan 20 px
  içeride konumlanır; desktop ikon kontrolleri 40 px, ana aksiyon 144×40 px olur. Mobilde 44 px
  dokunma hedefleri korunur.
  Desktop takipçi/takip/aktivite sayaçları eşit genişlikte sütunlar yerine sola hizalı kompakt bilgi
  satırı kullanır. İlk sayaç kimlik metniyle aynı başlangıç çizgisindedir; öğeler arası boşluk 32 px'tir.
  Avatarı bulunan kullanıcıların mobil hero görseli ve desktop dairesel avatarı tam ekran önizlemeyi
  açar. Görsel kırpılmadan gösterilir; Escape, backdrop ve kapatma düğmesi modalı kapatır, gövde
  kaydırması kilitlenir ve odak modalı açan avatara geri döner. Fallback avatar etkileşimsiz kalır.
  Önizleme açılış/kapanışında 200 ms ease-out opacity ve hafif scale geçişi kullanılır. Bounce veya
  layout animasyonu yoktur; `prefers-reduced-motion` açıkken geçiş anlık hale gelir. Odak, kapanış
  animasyonu tamamlandıktan sonra tetikleyici avatara döner.
  **Shared avatar sistemi:** Kullanıcı kimliği gösteren avatarlar uygulama seviyesindeki `UserAvatar`
  bileşeninde birleştirildi. Görsel ve baş harf fallback'i aynı renk/ölçü mantığını kullanır; varsayılan
  avatarlar token tabanlı 1 px dış halka, hero/profile avatarları `strong` 4 px beyaz dış halka alır.
  Topluluk `AuthorAvatar` API'si geriye uyumlu adaptör olarak `UserAvatar`ı kullanır; navigasyon,
  onboarding, hesap profili, topluluk ve çalışma arkadaşı yüzeyleri aynı kaynaktan render edilir.
  Post/attachment görselleri kullanıcı avatarı olmadığı için bu sisteme dahil değildir.
  Açık cover ve beyaz yüzeylerde çerçevenin kaybolmaması için standart avatar halkası nötr `%15` ink
  kontrastındadır. `strong` profil avatarı 4 px beyaz ayırıcıya ek olarak 1 px koyu dış hairline
  kullanır; geniş gölge veya glow eklenmez. Halkalar artık görsel kutusunun dışında çizilir: çerçeve
  96 px profil avatarını 88 px'e, 36 px post avatarını 34 px'e düşürmez; kaynak görsel tam hedef
  çözünürlükte render edilir.
  **Tekil hata sahipliği (2026-08-14):** Topluluk hub verisi ile yardımcı kanal listesi aynı anda
  yüklenemediğinde artık iki ayrı hata mesajı gösterilmez. Sayfa seviyesindeki merkezî hata ve yenileme
  aksiyonu tek kaynak olarak kalır; kanal listesi hatası sessizce boş listeye düşer ve sol paneldeki ana
  navigasyon kullanılabilir durumda tutulur. İlgili: `hub-shell.tsx`, `zone-sidebar.tsx`,
  `community-hub-redesign.spec.ts`.
  **Ortak post yoğunluğu (2026-08-14):** `CommunityPostCard` tarafından kullanılan canonical
  `ThreadItem` dikey ritmi sıkılaştırıldı. Kartın yatay 16/20 px gutter'ı korunurken dikey padding
  12 px'e indirildi; header, metin, görsel, etiket ve aksiyonlar arasındaki gereksiz 12–16 px
  boşluklar 4–12 px gruplama ritmine çekildi. Avatar ölçüsü ve aksiyonların minimum 44 px dokunma
  hedefleri değişmedi; akış, oda, üye profili ve bookmarks aynı görünümü kullanmaya devam eder.
  **Post/media görsel kontratı (2026-08-14):** Topluluk hub akışı, oda, üye profili, bookmarks ve
  post/cevap detaylarındaki gövde metni 15 px'e eşitlendi; reaction toplamları 13 px tabular numerals
  olarak sabitlendi. Ortak `AttachmentGallery` tek görselde kaynağın doğal aspect-ratio'sunu korur;
  çoklu görsel mobilde 1.25 slide swipe rail, desktopta Twitter benzeri tile düzenini sürdürür.
  Her medya öğesi bütün yüzeylerde kendi 30 px radius ve nötr `%20` sınırını taşır; çoklu görseller
  tek bir dış çerçeveye sarılmaz ve aralarında 10 px gap kullanılır. Galeri kendi 12 px üst ritmini sahiplenir, böylece çağıran kartların çift margin üretmesi
  engellenir. İlgili: `thread-item.tsx`, `discovery-feed-card.tsx`, `attachment-gallery.tsx`,
  `comment-row.tsx`, `comment-shell.tsx`, `question-shell.tsx`, `answer-item.tsx`.
  Media lightbox açılışında backdrop 200 ms ease-out ile belirir; görsel aynı sürede hafif scale ve
  dikey offset'ten yerine oturur. Kapanış ters yönde fade/scale kullanır. Animasyon yalnız opacity ve
  transform özelliklerini değiştirir; `prefers-reduced-motion` açıkken süre sıfırlanır.
  **Ortak post sahiplik aksiyonları (2026-08-15):** Oda, üye profili, bookmarks ve post detayında
  kullanılan `CommunityPostCard` üç nokta menüsü sunucu tarafından hesaplanan `capabilities`
  alanına bağlandı. Gönderi sahibi düzenleme süresi ve etkileşim kilidi uygunsa içeriği kart içinde
  düzenleyebilir; silme hakkı varsa onay sonrası gönderiyi kaldırabilir. Moderatör sabitleme/silme,
  diğer kullanıcı ise bildirme aksiyonunu görür. Yetki kullanıcı adı karşılaştırmasıyla istemcide
  tahmin edilmez; `ForumThreadService` edit/delete/moderation kararlarını tüm legacy `ThreadView`
  yüzeylerine ekler. İlgili: `forum-thread.service.ts`, `forum-thread.controller.ts`,
  `thread-item.tsx`, `thread-menu.tsx`, `community-post-actions.spec.ts`.
  **Ortak oluşturma/düzenleme alanı (2026-08-15):** Gönderi içi düzenleme formu, yeni gönderi
  composer'ındaki gövde alanıyla aynı `ComposerBodyField` bileşenini kullanır. Böylece 15 px metin,
  10 px yüzey radius'u, emoji seçici, 4000 karakter sayacı, disabled/focus durumları ve
  `Ctrl/Cmd + Enter` ile kaydetme davranışı iki akışta da aynıdır. Başlık alanı da aynı input
  yüzeyine eşitlendi; mevcut medya edit endpoint'i tarafından değiştirilmez. İlgili:
  `composer-body-field.tsx`, `global-composer.tsx`, `thread-item.tsx`,
  `community-post-actions.spec.ts`.
  **Masaüstü AppNav toplulukta kapalı açılır (2026-08-23):** Kanal listesi
  değişmedi. Panel sidebar'ı (`app-nav.tsx`) artık toplulukta gizlenmez;
  `/hedef/pano` gibi yerinde kalır ve 52 px kapalı rail ile açılır. Cookie
  yazılmaz; sayfadan çıkınca önceki genişlik geri gelir. Kullanıcı rail'deki
  mevcut `PanelLeft` ile genişletebilir. Mobilde AppNav header/tab yine yok
  (topluluk kendi chrome'unu kullanır). Community header'dan bildirim zili ve
  tema düğmesi kaldırıldı — ikisi AppNav'da (rail lambası / açık panel zili).
  Header close/geri yalnız mobilde kalır (`<lg`); masaüstünde AppNav çıkış yoludur.
  Kullanım: `/topluluk` → solda dar AppNav + kanal sidebar. İlgili:
  `app-nav.tsx`, `app-sidebar.ts`, `community-header.tsx`, `(app)/layout.tsx`.

- **Yol arkadaşının rolü daraldı (2026-08-25)** — Çalışma masası gelince buddy'nin **eş zamanlı**
  yarısı masaya devredildi; buddy artık yalnız **asenkron hesap verebilirlik**: partnerin bugünkü
  odak dakikası, serisi, "şu an çalışıyor" sinyali ve dürtme. Kaldırılanlar: `/seans` buddy
  kartındaki **kullanıcı adıyla davet kutusu** (kohort önerileri duruyor) ve **"birlikte
  çalışalım" daveti** — buton, `POST /v1/buddy/study-invite`, `BuddyService.sendStudyInvite`,
  `IdentityEventTopic.BUDDY_STUDY_INVITE`, kalıcı bildirim, canlı SSE ipucu ve istemci modal'ı
  dahil tüm zincir. Gerekçe: kullanıcı adı bilmek ve kabul beklemek, davet kodunun ortadan
  kaldırdığı sürtünmenin ta kendisiydi; aynı işi iki yerde tutmak rolleri yeniden bulandırırdı.
  Detay ve masa tarafı → [coaching](./coaching.md).

- **Yol arkadaşı önerileri artık birlikte çalışmaya dayanıyor (2026-08-26)** — Öneri listesi
  `suggestCohortPeers` ile kuruluyordu: *aynı `examType` + ACTIVE + username var → `ORDER BY
  created_at DESC LIMIT 5`*. Yani "seninle aynı sınava giren **en son kaydolmuş 5 kişi**" —
  ortak geçmiş, aktiflik, ritim yok; soğuk arama listesi. Yerine **gerçekten birlikte çalıştığın
  kişiler** geldi: aynı masada, **çakışan zaman aralığında** seans yapmış olanlar, birlikte seans
  sayısına göre sıralı, son 60 gün.

  Bu sinyal masa özelliğinin ürünü: `study_sessions.room_id` olmadan kimin kiminle çalıştığı
  bilinemiyordu. Sorgu `study_sessions` üzerinde tek self-join
  (`StudySessionRepository.listCoWorkers`). **`count(distinct mine.id)`** kullanılıyor — join
  satırı değil: karşı taraf senin bir seansın boyunca üç pomodoro yaptıysa bu bir ortak seanstır,
  üç değil.

  **Kompozisyon `community`'de:** sıralama sinyali `coaching`'de, uygunluk `identity`'de; ikisini
  birden okuyabilen tek yer burası. `BuddyService.getSuggestionCandidates` (kohort taraması) yerini
  `filterEligibleCandidates(viewerId, ids)` aldı — identity artık **uygunluğa** karar veriyor,
  **sıralamaya** değil; gelen sıra korunuyor. `suggestCohortPeers` **silinmedi**: forum kullanıyor.

  **İstek/onay mekanizması bilerek korundu.** Sorun "istek göndermek" değil, listede tanımadığın
  birinin olmasıydı; buddy karşılıklı rızaya dayanan bir hesap verebilirlik ilişkisi (§4 güven
  çizgisi) ve dört kez birlikte çalıştığın birine istek atmak zaten doğal.

  **Gotcha — agregat timestamp'i drizzle dönüştürmez.** `max(started_at)` ham bir `sql` parçası
  olduğu için sütun mapper'ı uygulanmıyor; node-postgres **string** döndürüyor, `sql<Date>`
  bildirimi yalan oluyordu ve servisteki `.toISOString()` 500 veriyordu. Repository artık dönüşü
  `new Date(...)` ile normalize ediyor. Unit testler yakalayamazdı (repo mock'u gerçek `Date`
  veriyordu) — **e2e yakaladı**.

  **UI:** kartta `@handle` kalktı (kimse artık yazmıyor), yerine **öneri gerekçesi** geldi
  ("4 kez birlikte çalıştınız"). Satır iki katmana ayrıldı: 288px kenar çubuğunda avatar + isim +
  handle + buton aynı satırda isme ~96px bırakıyor ve neredeyse herkesi kırpıyordu; şimdi 173px ve
  kırpma yok. Öneri sayısı 5 → **3** (liste artık sıcak). Ortak geçmiş yoksa `/topluluk` linki
  yerine **"önce bir masaya otur"** metni — masa, yol arkadaşlığının giriş kapısı.

  İlgili: `study-session.repository.ts` (`listCoWorkers`), `session.service.ts`
  (`listRecentCoWorkers`), `buddy-view.service.ts`, `buddy.service.ts`
  (`filterEligibleCandidates`), `users.repository.ts` (`listPublicByIds`), `buddy.controller.ts`,
  `packages/types` (`BuddySuggestionRef`), `session-buddy-card.tsx`, `lib/buddy.ts`,
  `messages/{tr,en}.json`, `study-rooms.e2e-spec.ts`.
