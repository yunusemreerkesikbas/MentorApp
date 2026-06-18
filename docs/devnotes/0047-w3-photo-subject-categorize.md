# 0047 — W3 · Photo → Subject Categorize (MVP Slice 1)

> Date: 2026-06-19 · Scope: api (vision + storage + coaching persist) + web `/analiz` · Related: roadmap §10,
> AGENTS §4 (#2), workstreams W2/W3. Builds on mock-exam analysis ([0022](./0022-w2-mock-exam-analysis.md)).

## What was done
- **Vision:** module-local `VisionPort` + `FakeVisionAdapter` / `GeminiVisionAdapter` (`VISION_PROVIDER` env).
- **Storage:** `FakeStorageAdapter` + `R2StorageAdapter` (`STORAGE_PROVIDER`), signed upload URL flow.
- **API:** `GET /v1/coach/photo-access` · `POST /v1/mock-exams/photo-upload-url` ·
  `POST /v1/mock-exams/{id}/categorize-photo` (premium-only + rolling 30-day cap `ai.photo.monthly_limit`).
- **Persistence:** `mock_exam_photo_categorizations` + `GET /v1/coaching/analysis` → `photoSubjectSignals`.
- **Web:** `/analiz` photo card + chips (“Bu soru muhtemelen: …”) — no solution text (§4 #2).

## How to use (usage)
```bash
pnpm --filter @mentor/api db:migrate   # 0017_mock_exam_photo_categorizations.sql
pnpm --filter @mentor/types build && pnpm --filter @mentor/validation build
pnpm --filter @mentor/api dev && pnpm --filter @mentor/web dev
# Premium user: kaydet deneme → foto yükle → ders chip’leri
# Dev defaults: VISION_PROVIDER=fake, STORAGE_PROVIDER=fake
# Prod: VISION_PROVIDER=gemini + GEMINI_API_KEY, STORAGE_PROVIDER=r2 + R2_* env
```

## Gotchas
- **Premium-only** — no coin path this slice; free users see gate + `/abonelik` CTA.
- **Subject-level only** — no topic taxonomy yet; fake vision returns first seeded subject slug.
- **Idempotency** — `clientRequestId` unique per `(userId, subjectRef)`; multi-subject = multiple rows.
- **Rate limit** counts categorization **rows** (multi-subject photo = multiple toward cap).
- **Fake upload** uses relative `/v1/storage/fake-upload` + `express.raw` middleware in `main.ts`.
- **`shared/ports/llm.port.ts` LlmVisionPort** not wired — module-local `VisionPort` used (devnote).

## Related files & decisions
- `apps/api/src/modules/ai/{domain/vision.port.ts, application/photo-*.ts, presentation/ai-*-photo*.ts}`
- `apps/api/src/shared/{adapters/storage/*, storage/storage.module.ts}`
- `apps/api/src/modules/coaching/infrastructure/mock-exam-photo.repository.ts`
- `apps/web/src/{lib/analiz.ts, app/(app)/analiz/_components/photo-categorize-card.tsx}`
- `packages/types/src/{ai.ts, coaching.ts}` · `packages/validation/src/ai.ts`

## Code review (2026-06-19)

**Verdict:** merge-ready for dev/MVP slice after **one pre-prod fix** (upload gate). Guardrails §4 preserved.

| Severity | Finding | Action |
|---|---|---|
| **High** | `POST /mock-exams/photo-upload-url` has **no premium/rate-limit gate** — free users can still obtain upload URLs and fill storage (categorize is gated). | Gate via `PhotoAccessService` (or shared helper) before `createUploadUrl`. |
| Medium | Idempotent retry (`clientRequestId`) returns cached slugs without verifying rows belong to **same `mockExamId`**; names resolved from *current* exam taxonomy. | On idempotent hit, assert `existing.every(r => r.mockExamId === mockExamId)` or filter. |
| Medium | Vision runs **synchronously** on request (same as chat slice 1) — latency + cost exposure under load. | Backlog: `JobQueuePort` + poll/webhook; OK for MVP. |
| Medium | No **production lock** for `VISION_PROVIDER=fake` / `STORAGE_PROVIDER=fake` (payments has one). | Add env lock or ops checklist before prod cut. |
| Medium | Drizzle **0017 snapshot missing** in `drizzle/meta/` (SQL + journal only) — `db:generate` drift risk. | Run `db:generate` snapshot sync or document hand-written migration policy. |
| Low | No **unit tests** for `PhotoCategorizeService` / `PhotoAccessService` (e2e only). | Add `photo-categorize.service.spec.ts` with fake vision/storage. |
| Low | `photo-categorize.service.ts` idempotent branch indentation inconsistent (lines 64–75). | Cosmetic fix. |
| Low | FE `MAX_BYTES` duplicates `PHOTO_MAX_BYTES`; prefer `upload.maxBytes` only (already returned by API). | Optional UX cleanup. |
| Note | `putPhotoToSignedUrl` uses raw `fetch` — **accepted** (signed URL PUT is not API `/v1`). | — |
| Note | `ContentService` from AI module — same pattern as chat/RAG; coaching exposes `MockExamService` for persist. | Optional: taxonomy via coaching port later. |

**Guardrails checklist:** classify-only prompt + slug post-filter ✓ · premium-only categorize ✓ · no coin in analiz UI ✓ · no free AI ✓ · behavioral rows RLS ✓ · KVKK: image to Gemini when `VISION_PROVIDER=gemini` (disclosure elsewhere).

## Review follow-ups (2026-06-19 — applied)

- Upload URL gated via `PhotoAccessService.assertCanCategorize` (premium + monthly cap).
- Idempotent retry validates `mockExamId` match → `409 CONFLICT` on mismatch.
- Prod env locks: `VISION_PROVIDER=fake` / `STORAGE_PROVIDER=fake` forbidden in production.
- Unit tests: `photo-access.service.spec.ts`, `photo-categorize.service.spec.ts`.
- FE: file size check uses `upload.maxBytes` from API (no local `MAX_BYTES` duplicate).
