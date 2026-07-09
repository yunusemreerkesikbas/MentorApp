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
  + the viewer's own rank. `unit` is hard-filtered to XP so coin/net can never leak into the ranking.
  *(Redis sorted-set is the Phase-2 real-time upgrade.)*
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

| Endpoint | Purpose |
|---|---|
| `GET /v1/community/summary` | Effort board: streak, badges, and (economy-gated) xp/level/weekly leaderboard |
| `GET /v1/community/leaderboard?window=` | Effort ranking (today / weekly / all_time) |
| `GET /v1/community/profile/:username` | Public profile header — identity + gamification, no PII (APP-018) |

## Geliştirmeler (timeline)

- **Public profil başlığı — `getPublicProfile` (APP-018)** — Forum kullanıcı profil sayfası
  (`/topluluk/uye/[username]`) için `CommunityService.getPublicProfile(username)` +
  `GET /v1/community/profile/:username`. `getSummary`'nin özünü (streak/badges/level/xp) **hedef
  kullanıcı** için, **leaderboard hariç**, + public kimlik (displayName/username/avatar/examType/
  memberSince — **email/PII YOK**) döndürür; banlı/askıya-alınmış/olmayan → 404. Yeni tip `PublicProfile`.
  Kimlik+gamification zaten leaderboard'da public olduğundan tutarlı; §3 effort-only korunur.
  Aktivite feed'i forum tarafında (bkz. [`forum.md`](./forum.md)). *(APP-018)*
- **Leaderboard UX rötuş — "yeni" gürültüsü + boş durum + streak/xp kaldırma (APP-018)** — (1) İlk
  hafta önceki dönem verisi olmadığında her satırda "YENİ" gösterilmesi gürültüydü; yeni domain helper
  `resolveMovement` (null/boş baseline → `movement` null, "new" değil) bunu bastırır — gerçek geçmiş
  oluşunca ▲▼/"yeni" anlamlı döner. (2) Sıralama sayfasının altındaki Seri/XP/seviye bloğu (`StatSnapshot`)
  kaldırıldı (Profil/Panel'de zaten var; sayfada tekrar etmiyor) — rozetler yalnız varsa render olur.
  (3) Boş leaderboard (örn. "Bugün" sekmesi) düz metin yerine sıcak ikonlu boş durum (Trophy + mesaj).
  Test: `resolveMovement` unit (null/boş/gerçek baseline) + e2e movement yapısal kontrole çevrildi
  (paylaşılan test DB'sinde komşu-pencere verisi deterministik değil). *(APP-018)*
- **Leaderboard Faz 3 tamamlandı — ▲▼ hareket okları (APP-018)** — Fast-follow kapatıldı. **Snapshot
  tablosu/cron GEREKMEDİ (ponytail):** kapanmış bir dönem sabittir, o yüzden önceki dönemin sıralaması
  **okuma anında** ledger'dan hesaplanır. Yeni `LedgerRepository.xpRanksBetween(examType, since, until)`
  (kapalı pencere `[prevStart, curStart)` → userId→rank map) → `EconomyService.getPreviousRanks`. Domain:
  `previousWindowStart` (curStart − 1 dönem; Istanbul sabit +3, DST yok) + `computeMovement` (düşük rank =
  ▲). `CommunityService.buildLeaderboard` her satıra + `me`'ye `movement` ekler; `all_time` → `null`
  (anlamsız). Tip: `RankMovement` + `LeaderboardEntry.movement`. Frontend `MovementIndicator`: ▲ sakin
  yeşil (yeni `--color-success` token), ▼ **mat gri (kırmızı DEĞİL — §4 anti-shaming)**, "yeni" chip,
  "aynı" tire; podyum/senin-durumun/liste. İlk hafta veri yokken herkes "yeni". Test: unit 7/7
  (`computeMovement`/`previousWindowStart` dahil) + e2e 3/3 (all_time→null, weekly→"new"). *(APP-018)*
- **UI/UX polish — badge'ler + creative podyum + token bug fix (APP-018)** — Referans leaderboard'lardan
  ilham. (1) **Seri/XP badge'leri** (`StatSnapshot`, hem sayfa hem drawer): renkli dolu ikon-çipi
  (Seri → altın `--color-star`, XP → mavi `--color-progress`), her ikisinde de koyu ikon (kontrast ≈7:1,
  beyaz-mavi 2.4:1'i reddettik), ince kenarlık + `tabular-nums`. (2) **Creative top-3 podyum** — küçük
  rank rozeti kaldırıldı; yerine **kaideli basamak** (2/1/3 büyük League Spartan rakamı, kazanan en yüksek;
  altın/gümüş/bronz gradient). Full sayfada kaide `scaleY` (origin bottom) ile yükselir (reduced-motion
  saygılı); mini podyumda statik kompakt kaide. (3) **Bug:** `--color-cta` token'ı hiç tanımlı değildi →
  `color-mix(... var(--color-cta) ...)` geçersiz → senin-durumun/isMe highlight'ları render OLMUYORDU;
  tanımlı `--color-accent` (mavi) ile değiştirildi. Not: `zone-sidebar.tsx` de aynı tanımsız token'ı
  kullanıyor (pre-existing, ayrı follow-up). Dokunulan dosyalar lint-temiz. *(APP-018)*
- **UI/UX polish — duplikasyon kaldırma + animasyon (APP-018)** — impeccable + ui-ux-pro-max +
  web-design-guidelines geçişi. (1) **Duplikasyon:** `/topluluk/siralama` sayfası zaten tam leaderboard
  olduğu için sağ companion (EffortBoard aside + `EffortBoardDrawer` trigger) o rotada gizlendi — yeni
  `HideOnRanking` client wrapper (`usePathname === "/topluluk/siralama"` → null); feed/thread sayfaları
  companion'ı korur. Merkez `max-w-md mx-auto` olduğu için boşluk oluşmaz. (2) **Animasyon** (hepsi
  `prefers-reduced-motion` saygılı, transform/opacity + ease-out): XP sayıları `useCountUp` ile 0→değer
  (ease-out-quart, `tabular-nums` ile jitter'sız); sekme göstergesi framer-motion `layoutId` ile kayar
  (reduced-motion'da crossfade); sekme değişiminde board `key={activeWindow}` ile fade+stagger replay.
  Lint: dokunulan dosyalar temiz (`useCountUp` setState'i yalnız rAF içinde — `set-state-in-effect`
  kuralına uygun). *(APP-018)*
- **Code-review fix'leri — leaderboard error state'leri (APP-018)** — `/code-review` (code-reviewer +
  senior-architect + ponytail) bulguları kapatıldı: (1) `LeaderboardScreen` summary fetch fail olunca
  "Yükleniyor…" yerine artık `t("error")` gösterir; (2) sekme (Bugün/Tüm zamanlar) fetch'i fail olursa
  kalıcı iskelet yerine **hata + "Yenile"** butonu (`failedWindows` seti; retry pencereyi setten çıkarıp
  refetch tetikler) — sessiz yutma yok. (3) Servis kataloğu (`api.md §6`) yeni `/v1/community/leaderboard`
  endpoint'iyle güncellendi. Devnote: repo `docs/devnotes/` kullanmıyor → feature-timeline konvansiyonu
  (bu dosya) geçerli. Açık kalan düşük-öncelik follow-up'lar: `wait-for-port.mjs` soket timeout'u,
  `WindowTabs` klavye ok-navigasyonu (roving tabindex), `MEDAL` sabiti dup'ı, FE yüzdelik hesabının
  backend'e taşınması. *(APP-018)*
- **Leaderboard Faz 3 — zaman sekmeleri + Europe/Istanbul (APP-018)** — Tam sayfaya Bugün/Hafta/Tüm zamanlar
  sekmeleri. `LeaderboardView.window` tipi `today|weekly|all_time` olarak genişledi. Yeni
  `GET /v1/community/leaderboard?window=` endpoint'i (`CommunityService.getLeaderboard` + paylaşılan
  `buildLeaderboard`); `getSummary` haftalık board'u aynı builder'dan üretir. Pencere sınırları
  `domain/leaderboard-window.ts` → **Europe/Istanbul** (sabit +03:00, DST yok): `windowStart`
  (today=Istanbul gün başı, weekly=Istanbul Pazartesi, all_time=epoch) + `toWindow` (bilinmeyen→weekly).
  Frontend: segmented `WindowTabs`, pencere-başına lazy fetch + cache (weekly summary'den seed), Istanbul
  reset geri sayımı (all_time'da gizli). Çekmece haftalık kalır (sekme yok). ▲▼ okları hâlâ ertelendi
  (mat gri ▼ tonuyla, fast-follow). Testler: `leaderboard-window.spec` 5/5 (Istanbul gece-yarısı kenar
  durumu dahil) + community e2e 3/3 (windowed endpoint + garbage→weekly). Orval regen gerekmez. *(APP-018)*
- **Çekmece mini-podyum + podium arka planı (APP-018)** — Sağ panel/çekmece artık düz liste (`LeaderboardCard`,
  silindi) yerine kompakt `MiniLeaderboard`: top-3 mini podyum + senin-sıran kartı + "Tümünü gör →". Yeni
  tasarım artık tıklamadan panelde görünür. Tam sayfada podyum arkasına AI görseli bağlandı
  (`public/leaderboard/podium-bg.png`, beyaza feather'lı, sakin ton korunur); çekmece hafif kalsın diye
  sadece CSS gradient kullanır (1.3MB görsel yüklenmez). Follow-up: görseli webp'e çevir. *(APP-018)*
- **Leaderboard redesign Faz 2 — avatarlar + yüzdelik (APP-018)** — `LeaderboardEntry.avatarUrl` ve
  `LeaderboardView.totalParticipants` eklendi (`packages/types/src/community.ts`). Ledger
  `xpLeaderboardSince` artık `users.avatar_storage_key`'i de join eder (`XpLeaderRow.avatarStorageKey`);
  yeni `xpParticipantCountSince` (cohort'ta XP>0 distinct kullanıcı) → `EconomyService.getXpParticipantCount`.
  `CommunityService` StoragePort inject eder (`@Global`), her satır için `getPublicUrl(key)` ile avatarUrl'i
  çözer (economy saf kalır; community yalnızca orkestrasyon — tablo dokunmaz). Frontend: podyum/senin-durumun/
  liste gerçek avatar; cesaret bandı "Katılımcıların %X'inden öndesin" (yalnızca ≥%1 → asla "%0"; top-1/3
  kutlama mesajları öncelikli). Orval regen gerekmez (community raw `http<CommunitySummary>` kullanır).
  Test: community e2e'ye `totalParticipants` + `avatarUrl` assertion'ları (2/2 geçti). *(APP-018)*
- **Leaderboard redesign — tam sayfa `/topluluk/siralama` (Faz 1, APP-018)** — Referans-tabanlı redesign;
  guardrail: efor/XP only, sakin, anti-shaming (koyu gaming DEĞİL, açık marka). Yeni route
  `topluluk/siralama` → `LeaderboardScreen`: haftalık reset geri sayımı (client'ta Pazartesi 00:00 UTC'den
  türetilir), pozitif cesaret bandı (`me.rank`'e göre; asla düşük sıra utandırmaz), top-3 **podyum**
  (#1 ortada + taç + mat altın/gümüş/bronz halka), vurgulu "Senin durumun" kartı, tam liste, seviye+rozet
  (StatSnapshot/BadgeStrip reuse). Hareket: framer-motion kademeli giriş, `prefers-reduced-motion` saygılı.
  Kompakt panoya (`EffortBoard`) "Tümünü gör →" linki. i18n: `topluluk.rank_*`. Backend YOK (mevcut
  `/community/summary`). Plan: `docs/plans/2026-07-04-leaderboard-redesign-design.md`. Faz 2 (avatar +
  yüzdelik) ve Faz 3 (sekmeler + ▲▼) ertelendi. *(APP-018)*
- **Emek Panosu mobil erişimi — sağ çekmece (APP-018)** — Sağ kolon (`EffortBoard`) yalnızca `xl+`'de
  görünüyordu; mobil/tablette hiç erişilemiyordu. Yeni `EffortBoardDrawer` (`xl:hidden`) sol `ZoneDrawer`
  desenini yansıtır: sağ üstte "Sıralama" (Trophy) pill'i, dokununca sağdan kayan panelde profil + XP +
  leaderboard. `EffortBoard` yalnızca ilk açılışta mount edilir (drawer kapalıyken `/community/summary`
  fetch'i yok). `xl+`'de eskisi gibi sabit sağ sütun. i18n: `topluluk.board_open`/`board_close`.
  Not: `EmekPanosu`/`EmekDrawer` bileşenleri `EffortBoard`/`EffortBoardDrawer` olarak İngilizceye
  çevrildi (route slug'ları — `topluluk` vb. — Türkçe kalır, onlar URL).
  Gotcha: trigger `fixed top-[3.75rem]` global header altına hizalı, `z-20` (backdrop z-[29], panel
  z-30). *(APP-018)*
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
  idempotent + economy-off), community e2e (zarif küçülme + haftalık sıralama). *(APP-017)*
- **Code-review fix — cross-module table access kaldırıldı (APP-017)** — İlk sürümde `community` repo'su
  başka modüllerin tablolarını (`ledger_entries`, `streak_state`, `forum_posts`) doğrudan okuyordu
  (blocking, senior-backend §Modules). Düzeltildi: leaderboard aggregate'i **economy**'ye taşındı
  (`EconomyService.getXpLeaderboard/getXpStanding` — ledger'ın sahibi), streak **coaching**'e
  (`StreakService.getCurrentStreak`, yan-etkisiz snapshot), rozet sinyalleri **forum**'a
  (`ForumService.getAuthorActivity`), profil **identity** `UsersService.getMe`. `community.repository.ts`
  silindi; modül artık tablo sahibi değil, sadece public servisleri orkestre ediyor. Service catalog
  (`api.md §6`) güncellendi. *(APP-017)*
