# 0049 — W2/W3 · Ghost (geçmiş-ben) comparison + premium AI narration

> Date: 2026-06-20 · Scope: api (coaching ghost domain + mock_exams cache) + ai (ghost-narration) + web `/analiz` · Related: roadmap §0 (no ranking), AGENTS §4 (#1/#5/#6), workstreams W2/W3. Builds on [0022](./0022-w2-mock-exam-analysis.md), [0048](./0048-w3-mood-ai-adaptive.md).

## What was done

### Part A — rule-based "geçmiş-ben" (W2)
- **Domain (`domain/ghost.ts`):** pure comparison of the latest mock-exam attempt vs the user's OWN past — signed net deltas, personal record flag, i18n headline keys (no cross-user ranking §0).
- **Coaching:** `MockExamService.buildGhost` attached to `GET /v1/coaching/analysis` as `ghost` (null until ≥2 attempts); localized headline via `coaching.ghost.*` locale keys.
- **Schema (`0019_mock_exam_ghost_narration.sql`):** `mock_exams` += `ai_ghost_narration`, `ai_ghost_model`, `ai_ghost_at` (nullable; RLS unchanged).

### Part B — premium AI narration (W3)
- **AI:** `POST /v1/coach/ghost-narration` (`AiGhostController` + `GhostNarrationService`) — **premium-only**, grounds on rule-based ghost DTO via `buildGhostPrompt`, meters into `ai_usage` (§7), caches per latest attempt through `MockExamService.setLatestGhostNarration` (AI never writes `mock_exams` directly — workstreams §2).
- **Web `/analiz`:** `GhostCard` shows rule-based comparison for all users; premium users get an AI progress narration (auto-generated on mount when uncached).

## How to use (usage)
```bash
pnpm --filter @mentor/api db:migrate         # applies 0019
pnpm --filter @mentor/api dev && pnpm --filter @mentor/web dev
# ≥2 mock exams → /analiz shows "Geçmiş-ben" card with headline + deltas.
# Premium: AI narration appears (cached on the latest attempt row).
# Free: rule-based headline + subtle /abonelik hint, no LLM call.
```

## Gotchas
- **Premium-only**, no coin path (same as mood reflection slice). Free → rule-based comparison only.
- **Cost control = idempotent per-attempt cache + premium gate.** A new mock exam clears the need for re-narration on the prior attempt; only the latest attempt gets narration.
- **AI never writes `mock_exams`** — it calls `MockExamService.setLatestGhostNarration` (workstreams §2).
- **Concurrent cache miss:** two parallel `POST /ghost-narration` before the first write completes may both call the LLM (low probability; backlog: conditional update / lock).
- `aiGhostControllerNarrate` generated response typed `void` by orval — web casts via `@mentor/types` (same pattern as mood-reflection, devnote 0048).

## Related files & decisions
- `apps/api/src/modules/coaching/domain/ghost.ts` · `apps/api/drizzle/0019_mock_exam_ghost_narration.sql`
- `apps/api/src/modules/coaching/application/mock-exam.service.ts` · `apps/api/src/modules/ai/application/ghost-narration.service.ts`
- `apps/web/src/app/(app)/analiz/_components/ghost-card.tsx`
- `packages/types/src/coaching.ts` (`GhostComparisonDto`) · `packages/types/src/ai.ts` (`GhostNarrationDto`)

## Guardrails (AGENTS §4)
Ghost prompt forbids official info (#1) & cross-user ranking (§0) · premium-only narration, free stays rule-based (#5) · PII-free grounding: net numbers + subject names only (#6) · behavioral rows RLS-scoped · §7 cost metered to `ai_usage`.
