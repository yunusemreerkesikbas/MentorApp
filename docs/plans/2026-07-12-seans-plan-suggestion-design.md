# Seans sonrası plan önerisi (reflection + Plana ekle)

**Date:** 2026-07-12 · **Tracks:** W3 AI (+ W2 coaching seam)

## Decision

Close roadmap §259 on the `/seans` done screen: after micro check-in, premium session reflection
may include one concrete plan-task suggestion. User confirms via existing `/plan?add=1` prefill.
AI never writes `plan_tasks`.

## Shape

- Extend `POST /v1/coach/session-reflection` with optional `suggestedTask` (same `<<TASK{...}>>`
  marker + `extractSuggestedTask` as coach chat Dilim 4).
- Persist `study_sessions.ai_suggested_task` jsonb for cache hits; clear with reflection when
  feedback changes.
- Shared `SuggestedTaskCard` on done screen (and coach transcript).

## Out of scope

- Free rule-based suggestion
- Automatic plan table writes / multi-suggestion
- Regenerating old caches that lack a task
- Ambient / history polish _(90/20 preseti backlog'dan kaldırıldı — 2026-07-17)_
