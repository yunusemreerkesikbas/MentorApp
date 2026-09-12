# SDD ledger — plan: docs/plans/2026-09-12-mentorship-followups.md

Spec: user-approved plan in task, implemented by shared contract alongside it.

| Tasks | Shared surface | Ruling |
| --- | --- | --- |
| Backend / frontend | DTO and endpoint contract | Contract fixed in plan file; root generates client. |
| Backend / notifications | ID-only events and public read seams | Backend owns seams; notifications owns delivery and queue rechecks. |
| Backend | Access, immutable text, version/retries | All mutations lock active link; current period required. |
| Frontend | Visibility and responses | Separate coach/student DTOs and views; no private text in shared projection. |
| Notifications | Delivery and retries | Deduplicate using existing notifications; execution-time checks. |

Task 1 backend: in progress.
Task 2 frontend: in progress.
Task 3 notifications: in progress.
Task 4 integration/docs/review/checks: in progress (feature docs and API catalog added; early access review dispatched).

Ruling: use new feat/mentorship-followups branch in shared checkout. Existing unrelated user edits retained and excluded from task.
Ruling: short title is coach-only because it may contain private context; student sees shared decision only.
Ruling: immutable record text avoids silently altering previously accepted decisions; replacement refers to a closed record.

Validation: existing attention and risk domain suites pass (29 tests). Local Postgres test DB confirmed reachable at localhost:5433/mentor_test. pnpm exec lookup is unreliable in this shell; direct Node CLI or pnpm run works. Types and validation builds passed.
Ruling: daily reminders include dated due OPEN records only; undated CHANGE_REQUESTED records appear in actionable inbox and immediate response notifications.
Workspace note: user/other-task changes also appeared in profile components, mentor-toast, shared button, and identity docs during work. They are outside this feature and must not be reverted.
