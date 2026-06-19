# 0048 — W3/W2 · Mood AI-Adaptive Layer (+ migration drift reconcile)

> Date: 2026-06-19 · Scope: api (mood schema + ai mood-reflection + context grounding) + web `/panel`
> mood card · drizzle meta reconcile · Related: roadmap §10 ("Duygu check-in / AI adaptif cevap"),
> AGENTS §4 (#1/#5/#6), workstreams W2/W3. Builds on [0014](./0014-w2-coaching-daily-loop.md),
> [0030](./0030-w3-ai-coach-chat-slice1.md), [0047](./0047-w3-photo-subject-categorize.md).

## What was done

### Part A — migration drift reconcile (pragmatic minimal)
- **0006 journal gap fixed:** `drizzle/meta/_journal.json` was missing the `0006_info_articles`
  entry (idx 5 → 7), so a clean `db:migrate` silently **skipped** it (root of the `mvp-status`
  "info_articles skipped" note). Re-added as `idx: 6` with a real in-sequence timestamp.
- **HEAD snapshot restored:** snapshots `0011/0012/0016/0017` were missing → `db:generate` fell back
  to the stale `0015` snapshot and wanted to re-emit applied migrations. Regenerated the full-schema
  HEAD snapshot and saved it as `meta/0017_snapshot.json`, so the next `db:generate` produced **only**
  the new mood delta (verified: 0018 contains exactly the 4 mood columns, nothing else).
- **Policy:** every migration is committed **with its snapshot + a real timestamp**; forward-only,
  never edit an applied migration. Closes the `mvp-status` team-action.

### Part B — mood AI-adaptive layer
- **Schema (`0018_mood_ai_reflection.sql`):** `mood_checkins` += `struggle_note`, `ai_reflection`,
  `ai_model`, `ai_reflected_at` (all nullable; existing RLS covers them).
- **Coaching (W2):** `MoodService.upsertToday(mood, struggleNote?)` (re-check clears the cached
  reflection) + `setTodayAiReflection(...)`; `MoodService` now **exported** from `CoachingModule`.
- **AI (W3):** `POST /v1/coach/mood-reflection` (`AiMoodController` + `MoodReflectionService`) —
  **premium-only**, grounds on today's mood + note via `buildMoodReflectionPrompt`, meters into
  `ai_usage` (§7), caches the result back through coaching. Idempotent per day (cache hit → no LLM).
- **Context grounding:** `ContextBuilder` reads `MoodService.getToday` → `CoachContext.moodLevel` +
  `struggleNote`; `buildSystemPrompt` adds a "Bugünkü ruh hali" line, so coach **chat** is now
  mood-aware too (closes the long-standing "mood grounding deferred" note in ContextBuilder).
- **Web `/panel`:** premium users get an AI reflection (cached, shown on load) + optional
  "zorlandığın konu" note; free users keep the rule-based message + a subtle `/abonelik` hint.

## How to use (usage)
```bash
pnpm db:up                                   # local pg (test DB on 5433)
pnpm --filter @mentor/api db:migrate         # applies 0006 (fresh DBs) + 0018
pnpm --filter @mentor/types build && pnpm --filter @mentor/validation build
pnpm --filter @mentor/api openapi:export && pnpm --filter @mentor/api-client generate && pnpm --filter @mentor/api-client build
pnpm --filter @mentor/api dev && pnpm --filter @mentor/web dev
# Premium: /panel → pick mood (+ optional note) → AI reflection; reload → served from cache.
# Free: rule-based message + premium hint, no reflection call. Dev default: AI_PROVIDER=fake.
```

## Gotchas
- **Premium-only**, no coin path this slice (consistent with photo slice 1). Free → rule-based only.
- **Cost control = idempotent daily cache + premium gate.** The cache is invalidated **only when the
  mood value or note actually changes** (`mood-checkin.repository` upsert uses a `CASE … IS DISTINCT
  FROM` guard), so re-submitting the same mood or reloading the panel never triggers a fresh LLM
  call. Generation is bounded to ~one call per distinct daily mood state. Usage is still metered to
  `ai_usage` (§7). A hard per-day generation cap (`ai.mood.daily_limit`) is **backlog** — it needs an
  `ai_usage` `feature` column for accurate per-feature counting (same shape as the 0047 note).
- **AI never writes `mood_checkins`** — it calls `MoodService.setTodayAiReflection` (workstreams §2).
- **Existing local DBs**: backfilling 0006 with a past timestamp fixes **fresh** migrates only; a DB
  that already skipped 0006 won't auto-apply it (drizzle applies `when > last`). If `info_articles`
  is missing locally, apply `0006_info_articles.sql` once by hand.
- `aiMoodControllerReflect`/`aiChatControllerGetAccess` generated responses are typed `void` by
  orval (no `@ApiOkResponse` schema) — web casts via `@mentor/types` (existing pattern).

## Related files & decisions
- `apps/api/src/database/schema.ts` (mood_checkins) · `apps/api/drizzle/0018_mood_ai_reflection.sql`
- `apps/api/src/modules/coaching/{application/mood.service.ts, infrastructure/mood-checkin.repository.ts, coaching.module.ts}`
- `apps/api/src/modules/ai/{application/mood-reflection.service.ts, application/context-builder.service.ts, presentation/ai-mood.controller.ts, domain/ai.constants.ts}`
- `apps/web/src/app/(app)/panel/_components/mood-checkin.tsx`
- `packages/types/src/{coaching.ts, ai.ts}` · `packages/validation/src/{coaching.ts, ai.ts}`

## Verification fixes (pre-existing failures surfaced)
Running the full api suite on a fresh `mentor_test` surfaced two pre-existing issues (independent of
the mood feature) that are fixed here:
- **Photo categorize gate order** (`photo-categorize.service.ts`): the storage-key validation ran
  before the premium gate, so a free user with a foreign/invalid key got `400` instead of `403`.
  Reordered to **idempotent-retry → premium gate → key validation** (authorize before validating a
  *new* categorization; idempotent retries still return cache without re-gating). Fixes
  `ai-photo.e2e` "free user → 403" while keeping `photo-categorize.service.spec` green.
- **Notifications cron e2e** (`notifications.e2e-spec.ts`): asserted a single immediate cron call
  processes a just-enqueued job — racy at the enqueue→claim boundary (a job at `run_at=now()` is
  picked up on a following tick in prod). Switched to **condition-based polling** of the cron, and
  forced the no-op email adapter (`POSTMARK_TOKEN=""`) so the handler completes deterministically
  regardless of a local `.env`. No production code changed.

> Test-DB note: e2e suites share a persistent `mentor_test` and aren't all run-idempotent (e.g.
> `content.e2e` assumes the seeded article sorts first; admin-editor articles accumulate across
> repeated local runs). A fresh DB per run (CI, or `DROP/CREATE mentor_test`) is green; this is
> pre-existing test-isolation debt, not a regression.
>
> Known pre-existing failure (untouched here): `health-down.e2e` boots the app with `DATABASE_URL`
> pointed at an unreachable port, but `SubjectSeedService.onModuleInit` (content) eagerly queries the
> DB at boot and throws, so `app.init()` fails before the readiness assertions run. Independent of
> this change (not in the diff); fix belongs to W1 (make the seed boot-resilient or skip on DB-down).

## Guardrails (AGENTS §4)
classify→reflect prompt forbids official info (#1) & medical/legal advice → professional referral ·
premium-only reflection, free stays rule-based (#5) · PII-free grounding: exam + countdown + coarse
mood level only, no name/email (#6) · behavioral rows RLS-scoped · §7 cost metered to `ai_usage`.
