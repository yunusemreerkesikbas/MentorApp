# Haftalık sandık · arka uç dilimi (uygulama planı)

> Uygulama: bu oturumda, kullanıcı "Şimdi başla" dedi (2026-11-01). Web dilimi görseller gelince ayrı plan.

**Amaç:** Sandığın durumunu (sürüyor / hazır / açıldı / devreden) sunucuda hesaplayan ve açılışı kaydeden iki uç.

**Mimari:** Coin verme yolu aynı kalır (`QuestService.evaluateAndGrant`). Sandık, `user_quest_progress`
satırının yeni `revealed_at` alanıyla "açıldı" olur. Yeni `WeeklyChestService` (economy) sinyalleri
coaching'in `DailyQuestSignalService`'inden okur.

**Spec:** `docs/superpowers/specs/2026-11-01-weekly-chest-opening-design.md` ("Durumlar", "Kod etkisi").

## Sabitler
- Görev kimliği `weekly.effort-allowance`, dönem anahtarı ISO hafta (`2026-W45`), gün sınırı UTC (`todayIso`).
- Devir: yalnız geçen hafta (`isoWeekStart(today) - 1 gün` haftası), tamamlanmış ve `revealed_at` boş.
- Ekonomi kapalı → `reward: null`; uçlar yine açık (quests ucu gibi).
- Gerçek Coin tutarı ledger'dan: `LedgerRepository.findByRef("quest", row.id)`.
- Hata: `WEEKLY_CHEST_NOT_FOUND` → 404 (başka hafta, satır yok, görev kapalı).

## Görevler
1. **Sinyaller** (`coaching`): `DailyQuestSignals` + `weeklyActiveDates: string[]` (sıralı, `<= date`) +
   `weeklyFocusMinutes`. `StudySessionRepository.sumCompletedFocusSecondsBetween(tx, userId, from, until)`;
   `...OnDate` bunu çağırır. Test: `daily-quest-signal.service.spec.ts`.
2. **Migration:** `userQuestProgress.revealedAt` (timestamptz null) → `drizzle-kit generate` (0138) +
   geri doldurma: mevcut sandık satırları `revealed_at = completed_at` (eski genel kutlamayı zaten gördüler;
   lansmanda kimse "geçen haftanın sandığı"yla karşılaşmaz). `QuestRepository.markRevealed(userId, id)`.
3. **Servis** `economy/application/weekly-chest.service.ts`: `getView(userId)`, `open(userId, periodKey)`.
   Durum: satır varsa `revealedAt ? OPENED : READY`; satır yok + cap bekliyor → `READY` + mesaj; değilse
   `PROGRESS`. `summary` yalnız READY/OPENED. `open`: `markRevealed` + eşleşen makbuz `markSeen`; cap
   bekleyen sandık açılınca notu döner ama kalıcı yazmaz (Coin yatınca satır doğar).
   Test `weekly-chest.service.spec.ts`: sürüyor, hazır, açıldı, devreden, iki hafta geri devretmez, ekonomi
   kapalı, cap bekleyen, open idempotent + makbuz, open ödeme yapmaz, başka hafta 404.
4. **Uçlar + sözleşme:** `GET /v1/economy/weekly-chest`, `POST /v1/economy/weekly-chest/open { periodKey }`
   (200). `WeeklyChestView` (@mentor/types), `weeklyChestOpenSchema` (@mentor/validation), DTO'lar,
   OpenAPI export + orval.
5. **Doğrulama:** hedefli vitest, typecheck, lint. **Doküman:** `docs/features/economy.md`, `docs/standards/api.md`.

## Gözden geçirme odağı
- Pazartesi 00:00 UTC'de devreden sandık + yeni haftanın ilerlemesi birlikte (yalnız devreden gösterilir).
- Geçen haftanın sandığı açıldıktan sonra GET bu haftaya döner.
- Ekonomi kapalıyken tamamlanmış satırın ledger'ı yok → `reward: null`, hata yok.
- Görev `economy.quest.disabled_ids` içindeyse 404 (web gizler).
- Aynı `open` iki kez → ikinci çağrı aynı görünümü döner, ikinci yazma yok.
