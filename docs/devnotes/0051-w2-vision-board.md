# 0051 — W2 Hayal/Hedef Panosu (vision/goal board)

## What was done

Roadmap'in **MVP** işaretli son feature'ı (§6 satır 277; B2C listesi 659). Metin tabanlı **tek hedef
ankoru** per user: hedef + (opsiyonel) şehir + (opsiyonel) "neden". Free katman hedefi okur; **premium**
ek olarak kısa AI motivasyon notu alır (mood/ghost pattern'i). Görsel pano + küratörlü içerik = backlog.

### Backend (W2 coaching + W3 ai)
- **`vision_boards` tablosu** (`database/schema.ts`) — unique `(user_id)` → tek pano; AI cache kolonları
  (`ai_note`, `ai_model`, `ai_note_at`). RLS self-or-service (migration `0020_tranquil_shard.sql`, mood ile
  aynı policy — drizzle DDL'ine elle eklendi).
- **coaching:** `VisionBoardRepository` (upsert; içerik değişince AI cache `CASE WHEN`/`IS NOT DISTINCT FROM`
  ile invalidate) · `VisionService` (`getMine`/`upsert`/`setAiNote`) · `toVisionDto` mapper ·
  `GET /coaching/vision`, `POST /coaching/vision` (idempotent upsert, mood gibi). `mood-checkin`'in birebir kopyası.
- **ai:** `VisionNoteService` (premium gate `EntitlementService` + `AI_ENABLED` flag + idempotent cache +
  `ai_usage` metering + `buildVisionNotePrompt`) → `POST /coach/vision-note`. AI tabloya direkt yazmaz;
  `VisionService.setAiNote` ile coaching'e yazar (workstreams §2).
- Kontratlar: `VisionDto`/`VisionNoteDto` (`@mentor/types`), `upsertVisionSchema` (`@mentor/validation`).
- Test: `vision.service.spec.ts` (upsert + normalize + AI cache invalidate/keep) — 4/4.

### Frontend (apps/web, tam TR/EN)
- **`panel/_components/vision-board-card.tsx`** — kendi verisini çeker; premium ise `aiVisionControllerNote`
  ile AI notunu üretir/gösterir; free + hedef var → premium nudge (`/abonelik`); boş → "Hedefini belirle" → `/hedef`.
  `panel-shell` ana grid'ine eklendi.
- **`app/[locale]/(app)/hedef/`** — düzenleme sayfası (server `setRequestLocale` + `HedefShell` formu →
  `coachingControllerUpsertVision`). **Nav'a sekme eklenmedi**; karttan link ile.
- i18n `vision` namespace (tr+en parite 338/338), hooks `const translate`.
- api-client orval ile regen: `coachingControllerGetVision/UpsertVision`, `aiVisionControllerNote`.

## Usage
```
GET  /v1/coaching/vision         → VisionDto | null
POST /v1/coaching/vision  {goalTitle, targetCity?, motivation?} → VisionDto  (idempotent upsert; mirrors mood)
POST /v1/coach/vision-note       → { note, model }   (premium; idempotent cache)
```

## Gotchas
- Tek pano (unique user_id) — `PUT` upsert. AI notu yalnız içerik (goal/city/motivation) değişince yenilenir;
  aynı içerik tekrar kaydedilince LLM çağrısı yok (maliyet, §7).
- `bilgi-shell`'deki gibi countdown burada saklanmaz — panelin mevcut countdown kartından gelir.
- **KVKK (bilinçli karar):** mevcut `admin anonymize` yalnız `users` satırını scrub eder; `mood_checkins`
  `struggle_note` gibi davranışsal free-text'i **scrub etmez**. `vision_boards` (goal/motivation) de aynı
  sınıfta. Vision'a özel/cross-track scrub eklemek tutarsız olurdu → **tüm davranışsal free-text için holistik
  bir erasure adımı W6/identity follow-up** olarak bırakıldı (tablo `onDelete: cascade`, gerçek user silinince
  düşer). Bkz. `modules/admin/infrastructure/admin-users.repository.ts` `anonymize`.

## Doğrulama
- `pnpm --filter @mentor/api typecheck|lint|test` → temiz · 70/70 (vision dahil).
- `pnpm --filter @mentor/web typecheck|lint|build` → temiz; `/hedef` `●` SSG (tr+en), panel `●`.

## Related files
- `apps/api/src/modules/coaching/{application/vision.service.ts, infrastructure/vision-board.repository.ts, presentation/coaching.controller.ts, application/coaching.mappers.ts}`
- `apps/api/src/modules/ai/{application/vision-note.service.ts, presentation/ai-vision.controller.ts, domain/ai.constants.ts}`
- `apps/web/src/app/[locale]/(app)/{panel/_components/vision-board-card.tsx, hedef/page.tsx, hedef/_components/hedef-shell.tsx}`
- `apps/api/drizzle/0020_tranquil_shard.sql` · `packages/{types,validation}/src/*`
