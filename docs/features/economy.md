# Economy

> Light append-only ledger substrate: XP reputation + non-monetary Coin (→ earned AI right). Module:
> `modules/economy`. Workstream: W6. Roadmap: MVP substrate + weekly quests + refund reversal +
> deep-analysis sink shipped (APP-025, launch-ready); Phase 2 = forum coin, Redis leaderboard,
> mahalle, real economy expansion.

## Overview

The economy is an append-only ledger system for XP (reputation) and Coin (non-monetary, capped, earned
right → AI chat access). It powers onboarding quests, invite rewards, and AI chat spending. **Coin is
non-monetary, capped. Never in chat UI (§4 #3). The ledger never stores a single number / never deletes.**

## Architecture (key decisions)

- **Append-only ledger** (`ledger_entries`): `unit` (XP|COIN), signed `amount`, `status`
  (PENDING|CONFIRMED|REVERSED, default CONFIRMED), `ref_type/ref_id` (idempotent event grants).
  **Balance = sum of rows, never a single number.** No UPDATE/DELETE RLS policy ⇒ immutable.
- **Capped earning:** rolling 24h/7d coin caps + minimum XP threshold for coin earning (anti-Sybil).
  Config from the central registry: `economy.coin.{daily_cap, weekly_cap, min_xp_for_coin}`.
- **Coin faucet = onboarding (one-shot) + invite conversion + `weekly.effort-allowance`** (the only
  RECURRING one: 5/7 active days → 15 coin ≈ 3 AI messages/week). Without the weekly one the free
  tier's "earned AI right" is a lifetime ~30-coin trial that ends in a silent wall.
- **Idempotent grants:** unique `(ref_type, ref_id)` where `ref_id` not null.
- **Spending:** `EconomyService.spend()` — atomic confirmed-coin debit, idempotent on ref.
  `INSUFFICIENT_COIN` (422). Free daily coin allowance for AI chat (separate from premium rate-limit).
- **Cross-module decoupling:** economy consumes events from payments (`subscription.activated`) and
  emits events consumed by itself (invite conversion). Forum XP is wired via `forum.answer.accepted`.
  **No runtime dependency on economy from forum** (type-only import).
- **Gated by `economy.enabled`** (default off) — dormant until admin flips the flag.

## Tutorials / Guides

```bash
# Enable economy (admin):
PATCH /v1/admin/config/economy.enabled { "value": true }

# Grant coin (system/other modules):
await economy.grant(userId, Currency.COIN, 10, { reason: "invite.converted", refType: "invite", refId });

# User: check balance, quests, invite code:
GET /v1/economy/balance       # { xp, coin, ... }
GET /v1/economy/quests        # catalog + progress (auto-grants newly completed)
GET /v1/economy/invite        # { code }
POST /v1/economy/invite/redeem { "code": "..." }   # PENDING

# AI chat spend (see ai.md for full flow):
GET /v1/coach/access          # { mode: PREMIUM|COIN|NONE, ... }
POST /v1/coach/chat { "message": "...", "clientMessageId": "<uuid>" }

# Admin: manual adjust (bypasses caps, audited):
GET /admin/users/:id/economy
POST /admin/users/:id/economy/adjust { "unit": "COIN", "amount": 30, "reason": "..." }

# Web: profil earn hub — http://localhost:3000/profil
# Hidden when economy.enabled=false
```

## API

| Endpoint                                  | Purpose                                                  |
| ----------------------------------------- | -------------------------------------------------------- |
| `GET /v1/economy/balance`                 | Self balance + XP `level` (tier/nextAt)                  |
| `GET /v1/economy/ledger`                  | Self ledger history                                      |
| `GET /v1/economy/quests`                  | Quest catalog + progress (auto-grants)                   |
| `GET /v1/economy/invite`                  | Get/generate invite code                                 |
| `POST /v1/economy/invite/redeem`          | Redeem invite code                                       |
| `GET /v1/economy/streak-rescue`           | Streak-rescue offer (eligible? cost? affordable?)        |
| `POST /v1/economy/streak-rescue`          | Buy the freeze for the break day (coin sink, idempotent) |
| `GET /v1/economy/deep-analysis?examId=`   | Deep-analysis unlock state (eligible? cost? unlocked?)   |
| `POST /v1/economy/deep-analysis`          | Unlock this week's deep analysis (coin sink, idempotent) |
| `POST /v1/admin/users/:id/economy/adjust` | Admin manual adjust (audited)                            |
| `GET /v1/admin/metrics/economy`           | Faucet/sink breakdown + float + faucet reach (calibration) |

## Geliştirmeler (timeline)

- **Seviye rozeti SVG kontratı kaldırıldı (2026-08-29)** — 2026-08-22 girdisindeki
  "gelecekteki SVG ailesi için `assets:check:journey-levels`" cümlesi **artık geçersiz**. Seviye
  rozetleri raster WebP'ye geçti (`public/img/levels/{levelKey}.webp`), planlanan bespoke relic
  ailesi iptal edildi. SVG-only validator (`<svg>` dokümanı, 1024 kare viewBox, şeffaf köşeler,
  vektör-dışı içerik yasağı) raster için tek bir kontrolü bile geçerli olmadığından üç script ve
  iki package.json komutu silindi; hedefi olan `public/journey-levels/puhu` dizini zaten hiç
  oluşturulmamıştı. Yerine `journey-level-contract.spec.ts` içinde 12 asset için varlık kontrolü
  var — CI'da `turbo run test` ile koşar. XP eşikleri, ledger ve `CommunityLevelView` sözleşmesi
  değişmedi. İlgili: `journey-level-medallion.tsx`, `journey-level-contract.spec.ts`,
  `apps/web/package.json`, detay için [community.md](./community.md) aynı tarihli girdi.

- **2026-08-29 — Reward kapasite rezervasyonu** — Reklam gibi dış akışlar Coin vaat etmeden önce
  günlük/haftalık organic cap içinde `coin_grant_reservations` kapasitesi ayırabilir; settle tek
  idempotent ledger grant üretir, close/expiry kapasiteyi bırakır. Ledger append-only kalır.

- **Yoldaşlık sesi Dalga 8 — quest katalog i18n (2026-08-29)** — `QUEST_CATALOG` öğrenci başlıkları (`title` / `badge` / `ledgerTitle`) `economy.json` `quests.*` companion kopyasına çekildi; id ve ödül mekaniği durdu. `{target}` kartta çözülür, ledger satırında strip; kilometre `{days}`/`{count}` id’den gelir. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: admin Swal ve `quests_subtitle` bu dalgada değil. İlgili: `quest.catalog.ts`, `quest-copy.ts`, `quest.service.ts`, `ledger-entry-view.ts`, `locales/{tr,en}/economy.json`.

- **Yoldaşlık sesi Dalga 7 — ledger i18n (2026-08-29)** — `toLedgerEntryView` sabit TR cümleleri `economy.json` companion hak diline çekildi (`ödül` → `hak`, `Accept-Language`). Quest açıklaması hâlâ katalog TR. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: `QUEST_CATALOG` başlıkları bu dalgada değil. İlgili: `ledger-entry-view.ts`, `locales/{tr,en}/economy.json`.

- **Yoldaşlık sesi Dalga 6 — davet overlay (2026-08-29)** — `invite_eyebrow` / `invite_headline` Puhu (“Birini yanına al. Yol yalnız gitmesin.”); `invite_subtitle` / `redeem_pending` companion hak gerçeği (ödül/FOMO yok, miktar yok). `quests_subtitle` ve coin satırları durdu. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: dönüşüm hâlâ kayıt+aktif; cap sunucuda. İlgili: `apps/web/messages/{tr,en}.json`, `economy-invite-card.tsx`.

- **Yoldaşlık sesi Dalga 5 — davet kodu kayıt hatası (2026-08-29)** — `economy.redeem_failed` companion: “Kaydedilemedi.” → “Şimdi kaydolmadı.” `invite_headline` dokunulmadı. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: FOMO kümesi duruyor. İlgili: `apps/web/messages/{tr,en}.json`.

- **Yoldaşlık sesi Dalga 4 — ledger empty (2026-08-29)** — `economy.ledger_empty` / `ledger_error` companion: hak defteri, kutlama değil (“Henüz bir hareket düşmedi.”). `invite_headline` FOMO satırları dokunulmadı. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: coin cüzdan dili yok. İlgili: `apps/web/messages/{tr,en}.json`.

- **Commit-sonrası XP seviye sinyali (2026-08-22)** — Başarılı ve gerçekten yeni bir XP ledger
  satırı, yeni bakiye hesaplandıktan sonra `economy.xp.changed` olayı yayınlar. İdempotent tekrarlar
  ve Coin hareketleri olay üretmez. Quest grantleri dış transaction tamamlanmadan sinyal vermez;
  commit sonrasında toplu olarak yayınlanır. Community bu sinyali kalıcı Gece Yolculuğu kutlama
  kaydına çevirir. Kullanım: XP veren mevcut akışlar değişmeden çalışır. Gotcha: transaction içinden
  `grantInServiceTx` kullanan yeni çağıranlar, başarılı commit sonrasında `publishXpChanged`
  çağırmalıdır. İlgili: `economy.events.ts`, `economy.service.ts`, `quest.service.ts`,
  `journey-level-events.listener.ts`.

- **Backend-derived Gece Yolculuğu progress sözleşmesi (2026-08-22)** — `CommunityLevelView`
  geriye uyumlu biçimde `key`, `chapter`, `currentAt`, `nextKey` ve hazır `progress` alanlarıyla
  genişletildi. Böylece profil, topluluk özeti ve ekonomi kartı toplam `xp / nextAt` oranını
  istemcide hesaplamayı bıraktı; progress her seviyenin kendi eşiğinde sıfırlanır ve üç yüzey aynı
  değeri gösterir. Mevcut 12 eşik, ledger ve XP kazanma kuralları değişmedi. Negatif admin
  düzeltmelerinde ham XP korunurken görsel yolculuk başlangıcı 0'a sıkıştırılır; Takımyıldız
  seviyesinde sonraki seviye ve progress `null` olur. Gotcha: frontend eşik veya yüzde türetmemeli,
  yalnız API alanlarını render etmelidir. Gelecekteki SVG ailesi için
  `assets:check:journey-levels` tam 12 vektörü, 1024 kare viewBox'ı, 300 KiB bütçeyi, şeffaf
  köşeleri ve raster/script/dış kaynak yokluğunu denetler. İlgili: `packages/core/src/index.ts`,
  `packages/types/src/community.ts`, `economy.service.ts`, `journey-level-asset-validator.mjs`.

- **Ekonomi gözlemlenebilirliği — musluk/sink dökümü (APP-031, 2026-07-31)** — APP-030'da tekrarlı
  coin musluğunu taktık ama sayacını takmamıştık: admin yalnızca iki toplam sayı görüyordu
  (`coinIssued`/`xpIssued`), kaynak bazında hiçbir kırılım yoktu. Roadmap §729 kazanç oranlarının
  "canlı veriden kalibre" edileceğini söylüyor — ölçüm olmadan o kalibrasyon tahmindir.
  **`GET /v1/admin/metrics/economy`** (`AdminEconomyStatsDto`) geldi: d1/d7/d30 rolling pencereleri,
  reason bazında COIN + XP dökümü, **outstanding float** (kullanıcılarda duran harcanmamış coin =
  yükümlülük; şişiyorsa musluk cömert, sıfıra dayanıyorsa duvar var), **faucetReach** (son 7 günde
  haftalık musluğu kazanan / XP kazanan tekil kullanıcı) ve **corrections** (admin adjust satırları).
  **Organik/düzeltme ayrımı bu işin can damarı:** `byReasonSince` yalnız `created_by IS NULL`
  satırlarını sayar — bir destek düzeltmesi kalibre edilmeye çalışılan organik oranı şişirmesin
  (`coinEarnedSince`'in cap muhasebesindeki ayrımıyla aynı mantık). Şema değişikliği yok; ledger
  zaten append-only, veri oradaydı, okunmuyordu. Pencereler **rolling** (takvim değil) — cap'ler ve
  AI maliyet pencereleriyle tutarlı, TZ-free; bu yüzden erişim metriği "bu ISO hafta" değil "son 7
  gün", böylece economy coaching'in `isoWeekStart` util'ine uzanmıyor (workstreams §3).
  Admin dashboard'a dördüncü blok olarak `EconomyCards` eklendi (`AiCostCards` kalıbı; reason→TR
  etiket eşlemesi admin app içinde — `ledger-entry-view.ts` son kullanıcı dilidir, operatörünki ayrı).
  Flag'den bağımsız (admin aracı). Dosyalar: `ledger.repository.ts`, `economy-stats.service.ts`,
  `economy.module.ts`, `admin-metrics.controller.ts`, `packages/types/src/economy.ts`,
  `apps/admin/src/app/EconomyCards.tsx`, `apps/admin/src/lib/types.ts`.

- **Yenilenebilir coin musluğu + XP seviyesi + cap muhasebesi düzeltmesi (2026-07-30)** — Ekonominin
  tasarım kırığı kapandı. **Teşhis:** coin musluğu tek seferlikti — 4 onboarding görevi (4×10) +
  davet dönüşümü; gerçekçi free bakiye **ömür boyu 30 coin = 6 AI mesajı** (dördüncü onboarding
  coin'i `first-subscription`, yani coin'in gereksizleştiği an geliyor). Kanıt: `daily_cap` 50 /
  `weekly_cap` 200, ömür boyu kazanılabilir toplamın 5 katı — tavanlar hiç devreye girmiyordu.
  "Kazanılan AI hakkı" bir döngü değil, sessiz duvarla biten tek seferlik trial'dı.
  **(1) `weekly.effort-allowance`** — ilk ve tek TEKRARLI coin musluğu: ISO-haftada
  `economy.quest.weekly_allowance_active_days_target` (5/7) aktif gün →
  `economy.quest.weekly_allowance_reward_coin` (15 = 3 sohbet mesajı). Aktif gün sinyali
  (`weeklyActiveDays`, ≥1 tamamlanmış seans VEYA ≥1 biten plan görevi) coaching'de zaten vardı;
  yeni kod yolu yok — quest engine zaten COIN grant ediyor, cap'li, idempotent, `disabled_ids` ile
  kapatılabilir. 7/7 gerektiren `weekly.streak-full-week`'in aksine hafta ortasında tamamlanır.
  **Guardrail sapması (bilinçli):** roadmap §3 "salt aktiviteye coin verilmez" diyor; kuralın
  roadmap'te yazılı gerekçesi (§2/§3) coin'in **sosyal** alanda ortamı bozması ve farming. Aktif gün
  özel + doğrulanmış emektir, sosyal değildir ve 5 ayrı gün çalışmadan farm edilemez → kuralın
  niyetine sadık kalınıp lafzı gevşetildi. **(2) `coinReward()` resolver'ı** — `xpReward()`'ın
  simetriği. Öncesinde `rewardUnit: "COIN"` olan HER görev koşulsuz `onboardingRewardCoin` (10)
  alıyordu; yeni haftalık görev bu olmadan sessizce yanlış tutar öderdi. **(3) F3 cap muhasebesi:**
  `coinEarnedSince` yalnız `ai.chat.refund`'ı dışlıyordu → `streak.freeze.refund` organik kazanç
  sayılıp cap headroom yiyordu (başarısız freeze apply'da kullanıcı hem iade alıp hem günlük cap'i
  doluyordu). Artık ortak `CORRECTION_REASONS` listesi (SQL predikatı ve spec fake'i aynı listeden
  besleniyor). **(4) Seviye eğrisi paylaşılan invariant'a:** `deriveLevel` + `TIER_THRESHOLDS`
  `apps/api/.../community/domain/level.ts`'ten `@mentor/core`'a taşındı (`STREAK_MILESTONES`
  emsali); `GET /v1/economy/balance` artık `level` döndürüyor ve `/profil` bakiye sheet'i tier adı +
  ilerleme çubuğu gösteriyor (i18n `community.level_*` yeniden kullanıldı, yeni anahtar yok).
  Community `deriveLevel`'ı kendi çağırmayı bırakıp `balance.level` kullanıyor. **(5) F4:** nav
  pill'lerinde coin↔XP ikonları terstİ (`Gem`/`Coins`), düzeltildi. **(6) `QuestDef.ledgerTitle`
  (provada çıktı):** ledger `{target}`'ı bilerek siler (satırlar config'ten uzun yaşar) — mevcut
  başlıklarda sorunsuz ("Bu hafta {target} odak seansı tamamla" → "…odak seansı tamamla") ama yeni
  başlık "Bu hafta gün aktif ol" gibi bozuk bir cümle bırakıyordu. Opsiyonel `ledgerTitle` alanı
  eklendi → "Haftalık aktif gün hedefi". Dosyalar: `quest.catalog.ts`, `ledger-entry-view.ts`,
  `quest.service.ts`, `config.catalog.ts`, `economy.constants.ts`, `ledger.repository.ts`,
  `economy.service.ts`, `economy.controller.ts`, `packages/core/src/index.ts`,
  `packages/types/src/economy.ts`, `community.service.ts`, `economy-balance-card.tsx`, `app-nav.tsx`.
- **Invite sheet visual restyle (2026-07-24)** — Full-screen invite overlay (not bottom sheet):
  chip-lavender hero, close on the visual (top-right), punchy two-line headline, **ticket** invite
  code (side notches + dashed perforation + Copy), wave into redeem form. Quests “invite” action
  dismisses the quests sheet then opens this overlay. Related: `economy-invite-card.tsx`,
  `economy-section.tsx`, `messages/{tr,en}.json`.

- **Economy flip provası — 10/10 smoke PASS (2026-07-19)** — `economy.enabled` ilk kez uçtan uca
  canlı prova edildi (lokal dev, all-fake providers + gerçek browser): admin config bound'ları +
  audit, balance/UI açılışı, günlük+haftalık görev grant'leri (period `2026-W29`), davet →
  webhook dönüşüm (+20) → admin refund reversal (−20 clamp, ikinci refund idempotent), streak
  rescue 2-tap (−20 + freeze satırı), derin analiz 2-tap (−25, narration render, double-debit yok),
  `/koc` guardrail temiz, kill-switch (disable→gizli+grant yok, clear→anında geri), flip-off
  (404'lar + UI gizleme + narration 403). Prova runbook'u: [core/setup.md](../core/setup.md)
  § Economy smoke test. **Bulunan ve düzeltilen:** panel `EconomyPill` flag kapalıyken "0 0"
  render ediyordu → balance null'da artık hiç render olmaz (dormant yüzey sızıntısı). Gotcha
  notları: weekly review GEÇEN tamamlanmış haftayı `ended_at` ile değerlendirir (lokal test
  backdate ister); route rename sonrası bayat `.next` cache tüm sayfaları 404 yapar.
- **Derin analiz coin sink'i (APP-025 WP-C, 2026-07-19)** — Üçüncü coin harcama yeri:
  `GET/POST /v1/economy/deep-analysis` — premium'a dahil haftalık AI değerlendirme anlatımı
  (`POST /v1/coach/weekly-review`, web'de ilk kez tüketiliyor) free kullanıcıya (sınav, ISO-hafta)
  başına tek seferlik `economy.coin.deep_analysis_cost` (default 25) ile açılır. Unlock durumu =
  ledger spend satırı varlığı (`deep_analysis`, `userId:examId:weekStart`) — tablo yok, apply adımı
  ve refund yok (satın alınan şey kalıcı unlock satırının kendisi; narration hatası ücretsiz retry,
  sonuç `weekly_review_cache`'te). Eligibility harcamadan ÖNCE (review READY şartı) →
  `DEEP_ANALYSIS_NOT_ELIGIBLE` 422. Narration gate: `!premium` → `economy.enabled` VE
  `DeepAnalysisService.isUnlocked` şartı, yoksa eskisi gibi `PAYMENT_PREMIUM_REQUIRED`. Web:
  `/analysis/recap` READY hikâyesinin yalnız final ekranında açma CTA'sı — premium/unlocked
  kullanıcıya anlatım arka planda gelir, free kullanıcıda iki-dokunuş onayı (streak-rescue UX
  emsali), yetersiz coin → görev hub'ına link, flag kapalıysa gizli. PARTIAL/EMPTY satış yüzeyi
  üretmez. AI chat bölgesinde DEĞİL (§4 #3). Dosyalar: `deep-analysis.service.ts`,
  `economy.controller.ts`, `weekly-review-narration.service.ts`, `weekly-recap-shell.tsx`.
- **Quest v3 — haftalık ritüel görevleri + kill-switch (APP-025 WP-B, 2026-07-19)** — Üç haftalık
  görev (ISO-hafta dönemli, `period_key` = `2026-W29`): `weekly.focus-sessions` (hedef config, 5),
  `weekly.plan-tasks` (hedef config, 10), `weekly.streak-full-week` (7/7 aktif gün — doğası gereği
  ancak haftanın son günü tamamlanır, bilinçli). Ödül `economy.quest.weekly_ritual_reward_xp` (20,
  yalnız XP — salt aktiviteye coin verilmez). Haftalık sinyaller coaching'den
  (`DailyQuestSignalService`: `weekKey`, haftalık seans/görev/aktif-gün sayaçları; economy coaching
  tablosu okumaz). `{target}` başlık şablonu view-time config'ten çözülür. **Kill-switch:**
  `economy.quest.disabled_ids` (CSV) — admin herhangi bir görevi deploy'suz kapatır (listelenmez +
  grant edilmez). Web: quests card'da "Bu Hafta" tab'ı; gün-bazlı olmayan sayaçlar artık "X/Y gün"
  yerine "X/Y" gösterir. Dosyalar: `date.util.ts`, `daily-quest-signal.service.ts`,
  `quest.catalog.ts`, `quest.service.ts`, `config.catalog.ts`, `economy-quests-card.tsx`.
- **Sertleştirme: advisory lock + refund reversal + ledger etiketleri (APP-025 WP-A, 2026-07-19)** —
  (1) **F1 kapandı:** `pg_advisory_xact_lock(hashtextextended('economy:'||userId, 0))` cap'li grant
  ve spend yollarının SERVICE tx'inde ilk statement — eşzamanlı cap-aşımı ve farklı-refId'li çifte
  harcama pencereleri kapandı (tx-scoped, reentrant; XP ve `enforceLimits:false` saf insert, lock
  yok). (2) **Refund'da davet ödülü geri alma:** `refundLastCharge` commit sonrası
  `payments.payment.refunded` emit eder → `RefundEventsListener` → `InviteService.onInvitedRefunded`
  → `EconomyService.reverse` (`invite.reverted`, refId = redemption id). Politika: **refund-only**
  (dönem sonu iptalde ödül kalır — ödemesi alınmıştı) + **clamp-to-zero** (bakiye asla eksiye
  düşmez; harcanmışsa kalan kısım silinmez, `note: orig:<amount>`). Idempotent: reversal refId
  pre-check + unique index; grant hiç düşmemişse (cap-denied) no-op. Onboarding `first-subscription`
  coin'i v1'de geri alınmaz (bilinçli — istismar vektörü davet ödülü). (3) Ledger TR etiketleri:
  `streak.freeze.purchase/refund`, `invite.reverted`, `analysis.deep.purchase` artık genel
  "Ekonomi hareketi" yerine anlamlı başlık taşır. Dosyalar: `ledger.repository.ts`,
  `economy.service.ts`, `invite.service.ts`, `refund-events.listener.ts`, `payments.events.ts`,
  `subscriptions.service.ts`, `ledger-entry-view.ts`.
- **Economy hardening + streak-rescue coin sink (2026-07-18)** — İkinci coin harcama yeri geldi:
  `GET/POST /v1/economy/streak-rescue`, aylık ücretsiz havuz yetmediğinde derivation'ın KOPTUĞU
  tek-boşluk gününü `economy.coin.streak_freeze_cost` (default 20) coin ile dondurur (walk en yeni
  boşlukları önce köprülediği için kopma en eski bu-ay boşluğunda görülür — hedef `stoppedAt`,
  "dün" değil). Uygunluk kuralları coaching'de (`StreakService.getFreezeRescueState` — kopma günü
  tek boşluk olmalı: önceki gün aktif; 2+ gün boşluk kurtarılamaz), debit ledger'da; spend→apply, apply hatasında compensating `streak.freeze.refund`
  (AI chat pattern'i). Idempotent uçtan uca: spend `(streak_freeze, userId:date)`, insert
  `(user_id, date)` unique. Web: panel `WeeklyStreakCard` uygunsa iki-dokunuşlu onaylı
  "Serini kurtar" CTA'sı gösterir (best-effort; economy kapalıysa gizli). Ayrıca: cap muhasebesi
  artık sadece organik kazanımı sayar (refund + admin adjust hariç — `coinEarnedSince`), forum
  self-accept XP farm kapandı (`canAcceptAnswer` cevap yazarını da kontrol eder), level eğrisi
  12 seviye / 10000 XP tavana uzadı. Dosyalar: `streak-rescue.service.ts`, `streak.service.ts`,
  `streak-freeze.repository.ts`, `streak.ts`, `ledger.repository.ts`, `forum.policy.ts`,
  `level.ts`, `panel-shell.tsx`, migration `0054`.
- **Seans → XP ödül döngüsü (2026-07-10)** — roadmap §262: tamamlanan seans artık XP'yi anında
  tetikler (lazy `/profil` beklemesi yok). `coaching.session-completed` event'i →
  `SessionCompletedListener` → `QuestService.evaluateAndGrant` (günlük `daily.focus-session-completed`
  - `milestone.focus_sessions.*`; idempotent, capped). Yeni ödül kalemi yok. Done ekranı mount'ta
    `GET /v1/economy/quests` okuyup son ~120sn'de tamamlanan `study-session` quest'lerinin XP toplamını
    sade pill ile gösterir; `economy.enabled=false` → sessiz. Dosyalar: `coaching.events.ts`,
    `session.service.ts`, `session-completed.listener.ts`, `economy.module.ts`, `session-done-state.tsx`,
    `messages/{tr,en}.json`.
- **Slice 1 — Ledger substrate + admin adjust** — `ledger_entries`, `EconomyService.grant()`
  (append-only, capped), self balance/ledger API, admin manual adjust (audited, bypasses caps).
  _(0021.)_
- **Slice 2a — Invite → conversion → coin** — `invites` + `invite_redemptions`, stable code per user,
  conversion listener on `payments.subscription.activated`, inviter coin reward (idempotent, capped).
  F1 fix: cap-check + append in one tx (TOCTOU race closed). _(0022.)_
- **Onboarding quests** — 4 auto-grant quests (profile-setup, email-verified, first-subscription,
  invite-redeemed), `user_quest_progress`, lazy-eval triggers (GET + event hooks), admin quest view.
  _(0027.)_
- **Coin → AI chat spend** — `EconomyService.spend()`, `GET /coach/access`, free daily coin allowance,
  LLM-failure compensating refund. _(0045.)_
- **Web profil economy UI** — earn hub on `/profil` (balance, quests, invite share + redeem).
  Hidden when `economy.enabled=false`. _(0046.)_
- **Profil görev sheet iyileştirmesi** — `GET /v1/economy/quests` artık görev başına `rewardCoin`
  döndürür; `/profil` görev sheet'i tamamlanma özetini, Framer Motion animasyonlu yarım daire
  progress gauge'ini, backend'den gelen Coin ödülünü ve abonelik/davet aksiyonlarını gösterir.
  Tamamlanan görevlerde metin rozet yerine soluk yeşil tick yeterlidir; eksik görevlerde satırın kendisi
  aksiyon olur. E-posta doğrulama satırı `POST /v1/users/me/verification-email` ile doğrulama mailini
  yeniden gönderir. Kart-içinde-kart görünümü kaldırıldı; ödül hâlâ otomatik işlenir, manuel claim yok.
  İlgili dosyalar: `QuestService`, `@mentor/types` economy contract, `economy-quests-card.tsx`.
  _(2026-07-05.)_
- **Quest v2 — günlük ritüel görevleri** — `GET /v1/economy/quests` artık onboarding görevlerine ek
  olarak günlük tekrar eden üç ritüel görevi döndürür: bugünün planından bir görev tamamla, bir odak
  seansı bitir, mood check-in yap. Contract `category`, `period`, `periodKey`, `rewardUnit`,
  `rewardAmount`, `badgeLabel` ve `action` alanlarıyla genişledi; eski `rewardCoin` alanı geriye
  uyumluluk için kaldı. Günlük görevler `+5 XP` verir (`economy.quest.daily_ritual_reward_xp`),
  onboarding görevleri Coin vermeye devam eder. `user_quest_progress.period_key` günlük idempotency
  sağlar (`once` vs `YYYY-MM-DD`). Quest completion + ledger reward aynı SERVICE transaction içinde
  işlenir; progress okumaları sadece `once` ve bugünün period key'i ile sınırlıdır. Economy, coaching
  tablolarını okumaz; `DailyQuestSignalService` üzerinden boolean sinyal alır. Web modalı iki bölüme
  ayrıldı: "Bugünkü Ritüel" + "Başlangıç"; görev listesi kendi içinde scroll eder ve navigasyon
  aksiyonları sheet'i kapatır.
  üstte tek "sıradaki küçük adım" CTA'sı bulunur. _(2026-07-06.)_
- **Quest v2.1 — streak milestone görevleri** — `GET /v1/economy/quests` streak eşikleri için
  tek-seferlik "Kilometre Taşları" görevlerini de döndürür (`7/14/30/100/365 gün`). Contract'a
  `category=milestone`, `action=panel`, `progressCurrent` ve `progressTarget` eklendi. Milestone
  ödülü Coin değil XP'dir ve `economy.quest.streak_milestone_reward_xp` ile yönetilir. Web profil
  görev sheet'i bu görevleri animasyonlu kategori tab'larında gösterir; sheet root'u sabit yükseklikte
  kalır, scroll yalnızca görev listesi panelindedir ve satır aksiyonu `/panel` yönlendirmesidir.
  Tamamlanan milestone progress'i streak resetlense bile hedefte gösterilir; streak eşikleri
  `@mentor/core` içindeki ortak invariant'tan okunur. Milestone satırlarında metnin yanında
  ince bir progress çizgisi gösterilir.
  _(2026-07-08.)_
- **Quest v2.2 — effort milestone görevleri** — `GET /v1/economy/quests` artık streak dışı toplam
  emek kilometre taşlarını da döndürür: `10/25/50/100` odak seansı ve `25/50/100/250` tamamlanan
  plan görevi. Hepsi `category=milestone`, `period=once`, XP ödüllü ve
  `economy.quest.effort_milestone_reward_xp` ile yönetilir. Economy coaching tablolarını okumaz;
  toplam sayaçları `DailyQuestSignalService` public boundary'sinden alır. Web görev modalında mevcut
  "Kilometre Taşları" tabında otomatik görünür; mobile app aynı `/v1/economy/quests` contract'ını
  native action mapping ile tüketebilir.
  _(2026-07-09.)_
- **Quest v2.3 — panel quest strip (updated 2026-07-23)** — daily quests surface on `/panel`
  inside **Bugünkü ritüel** as a compact `RitualQuestStrip` (not a second promo card). Best-effort
  `GET /v1/economy/quests`; economy off → strip hidden; tap opens the shared quests sheet.
  Plan/mood updates re-fetch quest state. _(2026-07-09; merge 2026-07-23.)_
- **Quest v2.4 — reward feedback + balance sync** — web artık panelde yeni tamamlanan görevleri
  önceki/sonraki quest snapshot'ından algılar; ilk yüklemede eski tamamlanmış görevler için toast
  göstermez. Plan veya mood aksiyonundan sonra `GET /v1/economy/quests` auto-grant'i tetikler,
  yeni ödül varsa kısa XP/Coin toast'ı gösterir ve ardından `GET /v1/economy/balance` ile üstteki
  bakiye pill'ini yeniler. Profil economy hub da stale balance riskini kapatmak için quest auto-grant
  okumasından sonra balance okur. Backend contract değişmedi.
  _(2026-07-09.)_
- **Quest v2.5 — reward ledger history UI** — `GET /v1/economy/ledger` artık ledger satırlarını
  kullanıcı-dostu `title`/`description` alanlarıyla döndürür; teknik `reason` debug için korunur ama
  web UI'da gösterilmez. Profilde bakiye sheet'i açılınca son 20 hareket lazy yüklenir, XP/Coin
  tutarı ve kısa tarih ile gösterilir. Yeni endpoint yok; mobile ileride aynı view contract'ını
  tüketebilir.
  _(2026-07-09.)_

## Gotchas / Known issues

- **`economy.coin.min_xp_for_coin` must stay 0** unless the onboarding order is reworked first.
  Raising it looks tempting now that a recurring faucet exists, but it BREAKS
  `onboarding.profile-setup`: a brand-new user has 0 XP, so their very first coin grant would be
  denied with `ECONOMY_LIMIT_EXCEEDED`. The anti-Sybil lever is the weekly quest's active-day
  requirement, not this threshold.
- **`weekly.effort-allowance` is the only recurring coin faucet.** It deliberately breaks the
  roadmap's literal "no coin for mere activity" rule while honoring its stated reason (coin in
  SOCIAL zones). If you disable it, the economy silently reverts to a one-shot trial (~30 lifetime
  coin per free user) — kill it via `economy.quest.disabled_ids`, and know what you're turning off.
- **Every COIN quest needs a `coinReward()` branch.** The resolver defaults to the onboarding
  amount; a new non-onboarding COIN quest without its own branch pays the wrong amount silently.
- **A `{target}` in a quest title is STRIPPED in the ledger, never resolved** (rows outlive config —
  a row granted at target 5 must not later claim 3). Check the stripped form reads as a sentence;
  when it doesn't ("Bu hafta {target} gün aktif ol" → "Bu hafta gün aktif ol"), set an explicit
  `QuestDef.ledgerTitle`. Only the view path (`quest.service.toViews`) resolves `{target}`.
- **Admin metrics exclude admin adjustments from the organic breakdown** (`created_by IS NOT NULL`
  → reported under `corrections`, never in `coinByReason`). A support correction must not inflate
  the earning rates it is used to calibrate. `windows.*` however are TOTAL flow and DO include
  corrections — the two numbers are meant to differ.
- **Caps are rolling windows** (now−24h / now−7d), not calendar — simple, TZ-free.
- **Cap accounting counts ORGANIC earnings only** — admin adjustments (`created_by` set) and every
  reason in `CORRECTION_REASONS` (`ai.chat.refund`, `streak.freeze.refund`) are corrections,
  excluded from `coinEarnedSince` so they never squeeze the user's daily/weekly headroom.
  **Add every new compensating-refund reason to that list** or it will silently eat cap headroom.
- **Admin adjust bypasses caps** (`enforceLimits:false`) — it's a correction; organic earning passes
  caps.
- **Invite: forward-only** — reward fires only on conversion AFTER redeem. Premium-at-redeem rejected.
- **Free daily coin cap** counts ledger rows with `reason=ai.chat.spend` in rolling 24h.
- **LLM fail after spend** → compensating `ai.chat.refund` grant (logged if refund fails).
- **Refund reversal is refund-only + clamp-to-zero** (APP-025): a period-end cancel keeps the
  inviter's reward (the period was paid); a spent-down balance forfeits the un-reversible remainder
  (recorded in `note`). Churn-based reversal deliberately NOT implemented.
- **F1 resolved (APP-025):** per-user `pg_advisory_xact_lock` serializes capped grants + spends
  beyond single-tx atomicity. XP grants and `enforceLimits:false` corrections skip the lock (pure
  inserts).
- **Quest lifecycle rules (APP-025):** quest ids are IMMUTABLE and never reused (they key
  `user_quest_progress` + ledger refs). Removing a quest = add its id to
  `economy.quest.disabled_ids` first (deploy-free), delete the catalog code in a later release;
  progress + ledger history stays, an unknown-id ledger row falls back to the generic label.
  `weekly.streak-full-week` is only completable on the week's last day (by design).
- **Deep-analysis unlock has no refund leg** (by design): the ledger spend row IS the unlock; a
  narration/LLM failure after purchase retries free (cache in `weekly_review_cache`). Eligibility
  (review READY) is checked BEFORE spending, so an ungeneratable report can't be bought.

## Related

- Seam: [ai.md](./ai.md) (coin spend), [forum.md](./forum.md) (XP on accepted answer),
  [payments.md](./payments.md) (subscription event), [admin.md](./admin.md) (config/economy UI)
- Smoke: [core/setup.md](../core/setup.md) § Economy smoke test (pre-flip, 10 adım)
- Status: [core/mvp-status.md](../core/mvp-status.md) (W6 breakdown)
