# Weekly report recommendation follow-up

Approved continuation of option A, 2026-11-04.

## Behavior

- Keep the saved weekly report immutable. Add a separate live follow-up resource to owned reports.
- A student edits and confirms the suggested task in the existing Plan form. The server checks
  report ownership, READY status and its saved suggestion, resolving subject labels from that
  snapshot. Store report/exam/week/subject provenance on the ordinary plan task.
- One extant task per report, including completed tasks, serialized by the existing user plan
  lock. Explicit task deletion allows re-adding; concurrent/replayed saves return the existing task.
- The report shows live task state and a date-specific Plan link. Editing its title/date is allowed;
  changing the subject is rejected because it would invalidate the tracked recommendation.
- On the following week's report, show the preceding week's linked task and the first matching
  exam recorded/taken after task creation and before the displayed report week's end. Compare it
  with the saved source-week subject average, labelling the baseline and new measurement clearly.
- Missing baseline, missing next exam, rhythm-only tasks and deleted tasks never invent results.
  Task completion is explicitly live; a measured net change never implies causation.
- No new charge, recurring Free AI, model request, or expansion of report access.

## Boundaries

AI authorizes report reads and supplies structural snapshot evidence to Coaching. Coaching alone
reads/writes plan/exam tables. A new WEEKLY_REPORT origin extends the existing provenance check;
generate a forward-only Drizzle migration. No new table or tracking pipeline is needed.

## Delivery plan

1. Shared origin/follow-up contracts, strict save validation, generated origin-check migration.
2. Coaching repository/service for idempotent task creation, live state and bounded measurement;
   AI orchestration/controller checks ownership before every read/write.
3. Preserve report attribution in the existing Plan prefill/save flow; add a follow-up card to the
   report, including its preceding-week action and localized messages.
4. Targeted calculation/service tests, real HTTP ownership/replay checks and mobile/desktop
   browser scenarios; codegen, relevant type/lint checks, feature/API documentation and review.

## Verification focus

Foreign/unopened reports, duplicate tabs, completed/deleted tasks, forged subjects, stale or absent
report suggestions, first report, absent previous report, future-dated exams, backdated entries,
missing baseline, and unchanged Coin/model counts. Preserve unrelated work in this feature checkout.
