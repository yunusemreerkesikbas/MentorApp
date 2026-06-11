# 0014 — W2 · Coaching daily-loop (Slice 2-a + Slice 5 mood)

> Date: 2026-06-10 · Scope: api (`modules/coaching`), packages (`types`, `validation`) · Related: roadmap §0/§9, plan `docs/plans/2026-06-10-w1-w2-content-coaching-design.md` (Slices 2 & 5), standards backend/api/engineering-principles

## What was done
- New bounded context `apps/api/src/modules/coaching/**` (domain/application/infrastructure/presentation, mirroring `identity`) wired into `app.module.ts` (one alphabetical line).
- **Schema (append-only `/* W2 · coaching */` block):** `plan_tasks`, `study_sessions`, `daily_activity` (UNIQUE user+date), `streak_state` (UNIQUE user), `mood_checkins` (UNIQUE user+date). Migration `drizzle/0002_w2_coaching.sql` (generated, then hand-appended `set_updated_at` triggers + **RLS ENABLE+FORCE per-user policies** for all 5 tables, matching the 0001 pattern).
- **Endpoints (`/v1`, Zod-validated, `ApiError` envelope, `RequestUser.id`, RLS double-belt):**
  - `GET /v1/coaching/today` — composite Panel payload (greeting · calm countdown · streak · today's tasks · session presets · today's mood).
  - `GET/POST /v1/plan-tasks`, `PATCH/DELETE /v1/plan-tasks/:id` — toggling status recomputes `daily_activity.tasks_done` in the **same tx**.
  - `POST /v1/study-sessions` (start), `PATCH /v1/study-sessions/:id` (complete/abandon) — finalizing recomputes `daily_activity.has_session` (same tx).
  - `POST /v1/coaching/mood-checkins` (upsert today → rule-based localized message), `GET /v1/coaching/mood-checkins` (paginated trend).
- **Streak = read-time derived** (no cron): pure `domain/streak.ts` walks `daily_activity` backward; a single missed day is bridged by one of 2 monthly freeze tokens; two consecutive misses soft-reset. Idempotent (always derives from active dates + monthly allowance → no token double-spend).
- **ContentPort seam:** `domain/content.port.ts` (interface + `CONTENT_PORT` token) bound to `ContentServiceAdapter` (W1). Countdown reads `users.examType` via **identity `UsersService.getMe`**, never a coaching query on `users`, never `users.examDate`. *(Temporary `ContentStubAdapter` removed in devnote 0016.)*
- Shared contracts appended: `@mentor/types` (`coaching.ts` — `TodayPanelResponse`, `PlanTaskDto`, `StreakSummaryDto`, `CountdownDto`, `SessionPresetDto`, `MoodCheckinDto`, `StudySessionDto`) and `@mentor/validation` (`coaching.ts` — request/query schemas). Error codes `COACHING_*` + TR/EN `errors.json`; mood/motivation copy in new `coaching.json` locales.

## How to use (usage)
```bash
# DB for tests/dev (pgvector image, host port 5433, also creates the test DB)
docker compose up -d
pnpm --filter @mentor/api typecheck && pnpm --filter @mentor/api lint && pnpm --filter @mentor/api build
pnpm --filter @mentor/api test            # vitest run (non-interactive — never watch mode)
```
- Panel swap: the web mock `apps/web/src/app/(app)/panel/_mock.ts` matches `TodayPanelResponse`; replace `getTodayPanel()` with the real `GET /v1/coaching/today` client. `mood` is an additive field (was absent in the mock; `null` when not checked in).
- `GET /v1/coaching/today` shape:
```jsonc
{
  "greetingName": "Elif",
  "motivationalLine": "…",           // rule-based, backend-localized (TR)
  "countdown": {                      // null if no examType / no calendar date (no silent fallback)
    "examType": "KPSS", "examName": "KPSS Lisans 2026",
    "daysRemaining": 184, "examDateLabel": "12 Temmuz 2026",
    "source": "ÖSYM", "sourceUrl": "https://www.osym.gov.tr"
  },
  "streak": { "currentStreak": 7, "longestStreak": 21, "freezeTokens": 2 },
  "tasks": [{ "id": "…", "title": "…", "subject": "Türkçe", "status": "DONE", "sortOrder": 0, "taskDate": "2026-06-10" }],
  "sessionPresets": [{ "id": "25_5", "label": "25 / 5 dk", "focusMinutes": 25, "breakMinutes": 5 }, { "id": "50_10", … }],
  "mood": null
}
```

## Gotchas
- **Repositories take the RLS-scoped `tx`** (opened by the service via `withUserContext`) so multi-table writes (task/session ↔ `daily_activity`) are atomic. Don't open a second tx inside a repo.
- **Day math is UTC** (`domain/date.util.ts`); `daily_activity.activity_date` for a session = UTC date of `started_at`. Per-user timezone can be threaded later without changing the pure helpers.
- **Study session status** enum is COMPLETED|ABANDONED (final outcome). A just-started session has `ended_at = null` and is NOT counted as activity until completed (the `has_session` query requires `ended_at` set).
- **Streak persistence is a snapshot/cache**; `current_streak` is always recomputed on read. `freeze_tokens` = monthly allowance − this month's bridges (derived, not decremented across reads).
- **ContentPort** — bound to W1 `ContentServiceAdapter` since devnote 0016; no hardcoded exam dates in coaching.
- DB-integration/e2e for coaching repositories was **deferred** (pure unit tests cover the logic). Note: unrelated pre-existing e2e suites (`payments` on a dirty volume, `auth`/`health-down`) can show failures depending on local DB state; coaching specs are pure and DB-independent.

## Related files & decisions
- `apps/api/src/modules/coaching/**`, `apps/api/src/database/schema.ts`, `apps/api/drizzle/0002_w2_coaching.sql`
- `apps/api/src/app.module.ts`, `apps/api/src/modules/identity/identity.module.ts` (exports `UsersService`)
- `packages/types/src/coaching.ts`, `packages/validation/src/coaching.ts`
- `apps/api/src/common/errors/error-code.ts`, `i18n/locales/{tr,en}/{errors,coaching}.json`
- Decision: streak read-time derived for MVP; path to W5 = move `StreakService.getSummary` recompute behind `JobQueuePort` (`coaching.recompute-streak`, nightly). No hard dependency on the (unbound) queue adapter.
- Open risks (from plan §6): `JobQueuePort` has no bound adapter (avoided via read-time derivation); `ContentService` not yet available (stubbed); `users.examDate` deprecated/ignored for countdown.
