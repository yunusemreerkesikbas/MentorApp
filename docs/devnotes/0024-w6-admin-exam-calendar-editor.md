# 0024 — W6 · Admin Exam-Calendar Editor (exams + events)

> Date: 2026-06-15 · Scope: api (admin + content) + admin UI + packages/validation · Related: roadmap §9,
> AGENTS §4 #1, workstreams W6/W1, follows [0023](./0023-w6-admin-content-editor.md) ("exam calendar = next")

## What was done
- **Admin exam-calendar editor for `exams` + `exam_events`** — list exams · create/update exam (idempotent
  by slug) · per-exam calendar events (upsert by type + delete). Mirrors the article editor pattern
  (audited, role-gated admin controller wrapping the W1 `ContentService`); writes already lived in
  `ContentService.upsertExam`/`upsertEvent` — this slice wires them to an **ADMIN/EDITOR-guarded, audited**
  surface and adds the missing admin reads.
- **Event types extended** (`content.constants.ts` `ExamEventType`, append-only): `EXAM_DATE` +
  `APPLICATION_START`, `APPLICATION_END`, `RESULT_DATE`. Countdown still keys off `EXAM_DATE` only
  (`listFamilyCandidates`, `getExamCalendarForCoaching`) → no coaching/web break.
- **content module (W1, additive):** `ContentService` gained `listExamsForAdmin`, `getExamForAdminWithEvents`
  (exam + raw events), `deleteExamEvent`, and `assertValidEventType` (called from `upsertEvent`). New admin
  views: `AdminExamView` / `AdminExamEventView` / `AdminExamDetailView`. `ExamRepository.listPaged` gained an
  optional `family` filter; `ExamEventRepository.deleteByExamAndType` added.
- **admin module (W6):** `AdminExamCalendarController` (`@Roles(ADMIN, EDITOR)` + `AdminAuditInterceptor`,
  `imports: [ContentModule]`):
  - `GET /admin/content/exams?family=&page=` (list) · `GET …/:slug` (exam + events) ·
  - `POST /admin/content/exams` (exam upsert) — `@Audit('content.exam.upsert')` ·
  - `POST …/:slug/events` (event upsert) — `@Audit('content.exam-event.upsert')` ·
  - `DELETE …/:slug/events/:type` — `@Audit('content.exam-event.delete')`.
- **Validation** (`@mentor/validation/content.ts`): `adminListExamsQuerySchema`, `upsertExamSchema`
  (netRule `{kind:'PENALTY', divisor:int>0}`), `upsertExamEventSchema` (trust metadata **required** —
  source/sourceUrl/verifiedBy/verifiedAt; §4 #1), `EXAM_EVENT_TYPES` constant.
- **Error codes / audit:** `CONTENT_EXAM_EVENT_NOT_FOUND`, `CONTENT_INVALID_EXAM_EVENT_TYPE` (+ TR/EN);
  `AuditAction.CONTENT_EXAM_{UPSERT,EVENT_UPSERT,EVENT_DELETE}` + `AuditTargetType.{EXAM,EXAM_EVENT}`.
- **Admin UI (TS):** `Sınav Takvimi` menu (ADMIN/EDITOR), `/content/exams` (list), `/content/exams/new`
  + `/[slug]` (shared `ExamForm`) and `EventsEditor` (events table + upsert-by-type form with prefill + delete).

## How to use (usage)
```bash
# EDITOR or ADMIN: /content/exams → + Yeni sınav (slug/ad/family/variant/net böleni/güncel) → Oluştur.
# Edit page → Takvim etkinlikleri: tür seç (varsa formu doldurur) → tarih + güven bilgisi → kaydet; Sil.
# Public calendar reflects EXAM_DATE: GET /v1/content/exams/:slug/calendar
```

## Gotchas
- **§4 #1 guardrail:** event trust metadata (source/sourceUrl/verifiedBy/verifiedAt) is REQUIRED by Zod —
  official dates are entered editorially with a verifiable source; the LLM never generates them.
- **Web rendering of new event types** (APPLICATION_*/RESULT_DATE) is **not** done here — `bilgi` still
  renders EXAM_DATE only. Surfacing the extra types on web is a separate frontend task (backlog).
- **`isCurrent` not unique per family** — countdown falls back to nearest-upcoming when multiple are current;
  single-current enforcement deferred (backlog).
- **RLS:** all admin reads/writes run in **SERVICE context** inside `ContentService` (parity with the article
  editor). Local `mentor` is superuser → RLS bypassed locally; verify on Neon/prod.
- **No schema change/migration** — `exams`/`exam_events` (+ `(examId,type)` unique) already exist (0016);
  only a code-level enum extension.
- **DELETE returns 204** (no body, api.md §3); the UI refetches `GET /:slug` for the fresh events list.
  Event upsert POST returns 201 with the refreshed exam detail.

## Related files & decisions
- `apps/api/src/modules/admin/presentation/admin-exam-calendar.controller.ts` · `admin.constants.ts` · `admin.dto.ts`
- `apps/api/src/modules/content/application/content.service.ts` · `infrastructure/exam.repository.ts` · `exam-event.repository.ts` · `domain/content.constants.ts`
- `packages/validation/src/content.ts` (`upsertExamSchema`, `upsertExamEventSchema`, `EXAM_EVENT_TYPES`)
- `apps/admin/src/app/(general)/content/exams/{page,new/page,[slug]/page,ExamForm,EventsEditor}.tsx` ·
  `utils/fackData/menuList.ts` (Sınav Takvimi) · `lib/types.ts` (AdminExam/AdminExamEvent/AdminExamDetail)
- **Verified:** e2e 9 (403 non-editor; 400 missing netRule / invalid family / invalid event type / missing
  trust metadata; create→listed+audited; event upsert→public calendar reflects EXAM_DATE+audited;
  delete→gone+audited; 404 deleting missing event); api lint+typecheck, admin typecheck+build green.
- Decisions (with owner): extended event set; exam upsert-only (no exam delete) + event delete; ADMIN+EDITOR.
