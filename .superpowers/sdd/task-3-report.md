# Task 3 report: W8 mentorship orchestration

## Delivered behavior

- Added the COACH-only `/v1/mentorship/plan`, batch assignment, pending-only single/group
  assignment mutation, and event create/update/cancel routes.
- Removed the public W2 event POST/PATCH/cancel decorators while preserving participant reads
  through `/v1/plan-events` and `/v1/plan-items`.
- Added the W2 `PlanService` multi-student seam: one SERVICE-context transaction, one generated
  `assignmentGroupId`, stable sorted student locks, per-row link provenance, and no student
  description.
- Added W2 pending-only single/group update/delete predicates scoped by task/group, student, and
  the W8-authorized expected link. Status, description, origin, and group id cannot be patched.
- Added the bounded coach aggregate: personal tasks, this coach's active-link assignments, and
  events this coach organizes. Grouping, all-day/time ordering, and pagination happen after the
  merge. Student self/AI/community tasks and student descriptions are absent.
- Extended display identity with a StoragePort-resolved `avatarUrl`; storage keys remain inside W0.
  Coach event responses and the coach aggregate carry full attendee display identities, while
  student/public event DTOs remain count-only.
- Event attendees are all gated through `requireActiveLink` before W2 mutation. Empty attendees
  create a personal event; the implicit organizer is rejected as an attendee.
- Link ending removes future attendee rows before changing the link to ENDED. Cleanup is
  idempotent through the W2 seam and a cleanup failure leaves the link active/retryable.
- Student delete/completion behavior is unchanged; dropped assignment audit/event projections now
  carry `assignmentGroupId`.
- Added stable mentorship errors and TR/EN messages. Updated mentorship, coaching, and identity
  feature timelines.

## RED evidence

All RED tests were committed before their production behavior.

1. W2 assignment seams:

   `pnpm --filter @mentor/api exec vitest run --config vitest.unit.config.ts src/modules/coaching/application/plan-mentorship.service.spec.ts`

   Exit 1: 1 file failed, 4 tests failed/4. Expected missing methods:
   `createMentorshipBatch`, `updateMentorshipTask`, and `updateMentorshipTaskGroup`.

2. W8 assignment gate and link-end cleanup:

   `pnpm --filter @mentor/api exec vitest run --config vitest.unit.config.ts src/modules/mentorship/application/mentorship-assignment.service.spec.ts src/modules/mentorship/application/mentorship-link.service.spec.ts`

   Exit 1: 2 files failed, 6 failed/24 passed. Five missing assignment orchestration methods and
   one missing future-attendee cleanup call.

3. Mutation route boundary:

   `pnpm --filter @mentor/api exec vitest run --config vitest.unit.config.ts src/modules/mentorship/presentation/mentorship-plan-routes.spec.ts`

   Exit 1: 1 file failed, 2 tests failed/2. W2 mutations were still reachable and W8 routes were
   absent.

4. New W8 event/aggregate services:

   `pnpm --filter @mentor/api exec vitest run --config vitest.unit.config.ts src/modules/mentorship/application/mentorship-event.service.spec.ts src/modules/mentorship/application/mentorship-plan-orchestration.service.spec.ts`

   Exit 1: 2 suites failed before collection because both required services were missing.

5. Dropped group provenance:

   `pnpm --filter @mentor/api exec vitest run --config vitest.unit.config.ts src/modules/mentorship/application/plan-task-feedback.listener.spec.ts`

   Exit 1: 1 file failed, 2 failed/9 passed. Audit calls and emitted payloads lacked the group id.

6. Coach event attendee identities:

   `pnpm --filter @mentor/api exec vitest run --config vitest.unit.config.ts src/modules/mentorship/application/mentorship-event.service.spec.ts`

   Exit 1: 1 file failed, 1 failed/5 passed. The response carried raw input attendee IDs instead
   of public display identities.

7. Empty/forbidden assignment edits:

   `pnpm --filter @mentor/api exec vitest run --config vitest.unit.config.ts src/plan-event-validation.spec.ts`

   Exit 1: 1 file failed, 1 failed/8 passed. A group update containing only `studentIds` was
   accepted.

## GREEN and verification evidence

Final exact command:

```bash
pnpm --filter @mentor/types build && pnpm --filter @mentor/validation build && pnpm --filter @mentor/api exec vitest run --config vitest.unit.config.ts src/plan-event-validation.spec.ts src/modules/coaching/application/plan-mentorship.service.spec.ts src/modules/coaching/application/plan.service.spec.ts src/modules/coaching/application/plan-event-create-read.service.spec.ts src/modules/coaching/application/plan-event-mutation.service.spec.ts src/modules/coaching/application/plan-event-attendees.service.spec.ts src/modules/coaching/application/plan-event-boundary.service.spec.ts src/modules/coaching/application/plan-item.service.spec.ts src/modules/mentorship/application/mentorship-assignment.service.spec.ts src/modules/mentorship/application/mentorship-event.service.spec.ts src/modules/mentorship/application/mentorship-plan-orchestration.service.spec.ts src/modules/mentorship/application/mentorship-link.service.spec.ts src/modules/mentorship/application/plan-task-feedback.listener.spec.ts src/modules/mentorship/presentation/mentorship-plan-routes.spec.ts && pnpm --filter @mentor/types typecheck && pnpm --filter @mentor/validation typecheck && pnpm --filter @mentor/api typecheck
```

- Exit 0.
- Types build: passed.
- Validation build: passed.
- Tests: 14 files passed, 104 tests passed, 0 failed.
- Types, validation, and API typechecks: passed, exit 0.
- The feedback-listener resilience tests intentionally print their simulated `db down` logger
  output; both tests pass.

Targeted lint:

```bash
pnpm --filter @mentor/api exec eslint $(git diff --name-only cf35b8b8..HEAD -- 'apps/api/src/**/*.ts' | sed 's#^apps/api/##')
```

- Exit 0, no warnings/output.

Diff check:

```bash
git diff --check cf35b8b8..HEAD
```

- Exit 0, no output.

New focused production files are size-bounded: assignment service 185 lines, event service 95,
plan orchestration service 148, plan controller 149, W2 plan helper 155, and W2 repository helper
120.

## Commits

- `ee330733` test: define W2 mentorship assignment seams
- `3d611113` test: define W8 coach plan orchestration
- `b5ca008a` test: preserve dropped assignment group provenance
- `14475770` feat: orchestrate coach plan events and assignments
- `b19917bf` test: use native invocation ordering assertion
- `51df9553` test: remove unused mentorship fixture
- `26324fbc` test: require coach event attendee identities
- `6b72c4bf` feat: hydrate coach event attendee identities
- `0a9fb8e0` test: reject empty coach assignment group edits
- `248f0c6b` fix: reject empty coach assignment group edits

## Self-review

- W8 imports only exported W2 services, never W2 repositories/schema/tables.
- Every student-scoped W8 mutation calls `assertEnabled` and `requireActiveLink` before W2.
- SERVICE-context SQL retains explicit student, link, organizer, status, and date predicates.
- Batch validation and all link checks happen before the first write; W2 then performs all rows in
  one transaction after acquiring locks in sorted student-id order.
- Assignment mutation builds an explicit patch allowlist. Completed rows are neither updated nor
  deleted.
- W2 reduces event attendee IDs to W8's active-link allowlist. Raw IDs remain server-side; storage
  keys never leave identity.
- Aggregate pagination occurs only after task grouping, event merge, and final ordering.
- The attached plan/brief file was read but not edited. No push or PR operation was performed.

## Concerns

- No real-Postgres integration run was performed. The new repository predicates and transaction
  behavior are typechecked and unit-tested with transactional fakes, but database/RLS execution
  remains for CI or an environment with the test database.
- No workspace-wide suite/build was run; verification stayed focused on W8, the changed W2 seams,
  affected existing plan/event/link behavior, shared contracts, API typecheck, and targeted lint.
