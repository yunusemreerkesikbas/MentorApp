# 0016 — W1 · Exam calendar (Slice 1)

> Date: 2026-06-11 · Scope: api (`modules/content`), web (`bilgi`), packages (`types`, `validation`, `api-client`) · Related: roadmap §4 guardrail #1, plan `w1_slice_1_takvim_3aa95118.plan.md`, standards backend/api

## What was done
- New bounded context `apps/api/src/modules/content/**`: editorial `exams` + `exam_events` tables, seed JSON, public read endpoints, countdown selection (`selectExamForCountdown`).
- **Endpoints (`/v1`, public read):** `GET /v1/content/exams`, `GET /v1/content/exams/by-type/:type/calendar`, `GET /v1/content/exams/:slug/calendar`.
- **Coaching seam:** `ContentServiceAdapter` replaces the temporary stub; `TodayService` countdown reads verified calendar via `ContentPort` (no hardcoded dates). Stub adapter removed.
- **Web:** Bilgi Merkezi page (`/bilgi`) renders the EXAM_DATE data card with source + verification metadata.
- Migration `drizzle/0005_w1_exam_calendar.sql` + idempotent startup seed (`exams.seed.json`).

## How to use (usage)
```bash
docker compose up -d   # Postgres on :5433 (test DB auto-created)
pnpm --filter @mentor/api db:migrate
pnpm --filter @mentor/api dev

# Public calendar (no auth)
curl http://localhost:3001/v1/content/exams
curl http://localhost:3001/v1/content/exams/by-type/KPSS/calendar

# Regenerate client after API changes
pnpm --filter @mentor/api openapi:export
pnpm --filter @mentor/api-client generate
```
- Countdown resolution: `users.examType` (KPSS|YKS|LGS) → family match → prefer `isCurrent` → nearest upcoming `EXAM_DATE`. Returns `null` when no upcoming date (no silent past-date fallback).
- Bilgi UI: loads `/v1/users/me` for `examType`, then `/v1/content/exams/by-type/{type}/calendar`.

## Gotchas
- **Never generate official dates in LLM or coaching code** — only editorial seed/admin writes (guardrail §4 #1).
- YKS/LGS seed rows exist but have no `EXAM_DATE` events yet → calendar returns `null` for those families until editorial adds events.
- Seed path resolves from compiled `dist/` at runtime; keep `seed/exams.seed.json` copied by Nest build (Nest `assets` in `nest-cli.json`).
- `ContentSeedService` logs and continues on failure — empty calendar until seed is fixed.
- E2E relies on global vitest setup migrating `mentor_test`; seed runs once per app boot in e2e `beforeAll`.
- Migration `0005` was hand-written (includes RLS/triggers); `meta/0005_snapshot.json` added so `db:generate` stays in sync — do not re-apply duplicate DDL.

## Related files & decisions
- `apps/api/src/database/schema.ts` — `exams`, `exam_events`
- `apps/api/src/modules/content/**` — service, repos, seed, controller
- `apps/api/src/modules/coaching/infrastructure/content-service.adapter.ts` — W1→W2 port binding
- `apps/web/src/app/(app)/bilgi/**` — Bilgi Merkezi data card
- `packages/types/src/content.ts`, `packages/validation/src/content.ts`
- Decision: family-level countdown (not KPSS variant pick yet); variant column reserved for future editorial rules.
