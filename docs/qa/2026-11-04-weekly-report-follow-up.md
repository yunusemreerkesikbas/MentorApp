# Weekly recommendation follow-up verification

Scope: [approved design](../plans/2026-11-04-weekly-report-follow-up-design.md).

## Decisions

- Preserve the shared feature checkout and unrelated in-progress changes.
- Reuse the existing Plan editor, task table, user plan lock and completion events. Introduce
  structural WEEKLY_REPORT provenance through generated migration0139; no new tracking table.
- Track live progress separately from frozen report content. Follow only the immediately preceding
  owned report; use an actual later attempt before the displayed week's end, not a fabricated score.
- Delete/re-add is explicit. Retrying while a task exists, including DONE, reuses its ID.
- A task-completion test originally expected an unchanged balance. Completion can legitimately
  grant daily Coin, so the final assertion checks the number of immutable report-spend rows instead.
- First browser Plan test used the wrong dialog label ("Görev ekle"); the actual existing form is
  "Yeni görev". Corrected the test selector and reran both viewport cases.

## Completed checks

- New ownership/Coaching service unit tests: 9 passed (initial missing implementation was RED).
  Final run including the existing analysis-task/idempotency regressions: 17 passed.
- Shared Plan-prefill tests: 3 passed.
- Local HTTP/Postgres suite: 21 passed. Covers generated migration, ownership, concurrent saves,
  DONE replay, subject injection/edit rejection, deletion/re-add and a genuine bounded measurement.
  Inserting backdated/out-of-period attempts does not change the selected measurement. Source
  report JSON remains unchanged. Existing Coin and report policies remain green.
- Browser tracking card: 10 passed across mobile/desktop (new, pending, completed, previous
  measurement, explicit retry). Plan form attributed-save and rhythm-task edit cases: 4 passed.
  Final combined run: 14 passed.
- API/web TypeScript, shared types/validation/client builds, and touched API/web lint passed.
- OpenAPI exported and Orval client regenerated.

## Final review and regression

- Independent review found a rhythm-only task edit sending its display label as a subject. The
  regression failed with that label, then passed after preserving the stored null subject in PATCH.
- Added rhythm-only service coverage: no fabricated baseline, measurement or measurement query.
- Added exact creation/end boundary attempts to the HTTP measurement scenario; focused rerun:
  1 passed, 20 unrelated tests skipped. Equal timestamps and out-of-period attempts are excluded.
- Rechecked web TypeScript and touched Plan/browser lint after the edit fix; both passed.
- Diff whitespace check reports only whitespace emitted in the newly generated Orval endpoint
  blocks. Generated formatting was retained; no handwritten-file whitespace errors were reported.

No production migration, deploy, live-provider AI request or full-workspace CI was performed.
Migration `0139_weekly_report_task_origin.sql` must be applied before deploying these task writes.
