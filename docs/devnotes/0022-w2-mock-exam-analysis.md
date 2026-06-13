# 0022 — W2 Mock Exam + Analysis

> Date: 2026-06-13 · Scope: api (content taxonomy + coaching mock-exams) · web `/analiz` · Related: design doc Slice 3, devnote 0016

## What was done
- W1: `subjects`, `exam_subjects` schema + migration `0011_*` + KPSS Lisans seed.
- `GET /v1/content/exams/:slug/subjects` — editorial taxonomy for deneme form.
- W2: `mock_exams`, `mock_exam_subjects`, `domain/net.ts` (KPSS penalty rule from `net_rule`).
- `POST/GET /v1/mock-exams`, `GET /v1/mock-exams/:id`, `GET /v1/coaching/analysis`.
- `/analiz` UI: per-subject D/Y/Boş, net from POST response, ProgressBar trend (no chart lib).
- Unit tests: `net.spec.ts`, `mock-exam.service.spec.ts`; e2e happy path in `coaching.e2e-spec.ts`.

## How to use (usage)
```bash
pnpm --filter @mentor/api db:migrate   # apply 0011
pnpm dev
# POST /v1/mock-exams { examId, subjects: [{ subjectRef, correct, wrong, blank }] }
# GET /v1/coaching/analysis — personal trend only (no ranking)
```
- Seed subjects load on API boot (`SubjectSeedService` after exam calendar seed).
- `ExamSummaryDto` now includes `id` (needed for mock-exam POST).

## Gotchas
- Net is **never** computed on the frontend — display `totalNet` / `net` from API only.
- `mock_exams.exam_id` is a SOFT ref (no FK to content) — validated via ContentPort at write time.
- RLS on `mock_exams` + child policy on `mock_exam_subjects` (via EXISTS on parent).

## Related files & decisions
- `apps/api/drizzle/0011_w1_subjects_w2_mock_exams.sql`
- `apps/api/src/modules/coaching/domain/net.ts`
- `apps/api/src/modules/coaching/application/mock-exam.service.ts`
- `apps/web/src/app/(app)/analiz/_components/analiz-shell.tsx`
- Decision: trend UI uses `ProgressBar` bars, not a chart library (DESIGN.md has no chart primitive).
