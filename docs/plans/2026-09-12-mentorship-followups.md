# Mentorship follow-up implementation

Approved scope: coach follow-up records with private notes, optional shared decisions, student ACCEPTED / CHANGE_REQUESTED responses, optional Istanbul date, OPEN / COMPLETED / CANCELLED lifecycle, paginated coach inbox and student history. Existing attention/risk/note flows remain independent. Shared decisions are immutable; replacement creates a new record referring to a closed predecessor. Ended relationships lose access on both sides; re-link creates a new relationship period. No new AI inputs or chat.

## Shared implementation contract

- New types/validation file `mentorship-followup.ts`, exported from package indexes.
- `MentorshipFollowupDto`: id, studentId, studentDisplayName, title, privateNote (nullable), sharedDecision (nullable), response (PENDING / ACCEPTED / CHANGE_REQUESTED), followUpDate (YYYY-MM-DD or null), status (OPEN / COMPLETED / CANCELLED), version (integer), replacesId (nullable), createdAt, updatedAt, respondedAt, closedAt (ISO timestamps/null as applicable).
- `MentorshipSharedFollowupDto`: id, sharedDecision (non-null), response, followUpDate, status, version, createdAt, updatedAt, respondedAt, closedAt. Explicit projection: no title/privateNote/student identity/replacesId.
- GET `/mentorship/followups?studentId=&view=ALL|ACTIONABLE&page=&pageSize=` returns Paginated<MentorshipFollowupDto>. ACTIONABLE = OPEN and (CHANGE_REQUESTED or date <= Istanbul today), order change requests then due date nulls last then createdAt/id. Student history view ALL newest first. All filtering before pagination.
- POST `/mentorship/students/:studentId/followups`: operationId UUID, title (1..120), privateNote (nullable max 2000), sharedDecision (nullable max 2000), followUpDate (nullable date, today or later), replacesId (nullable UUID). Response MentorshipFollowupDto. Replaces only closed same-period record. Operation ID retry with same payload returns original; changed payload conflict.
- PATCH `/mentorship/students/:studentId/followups/:followupId`: version required, optional followUpDate and status COMPLETED|CANCELLED. No text edits; only OPEN records mutable. Response updated DTO.
- GET `/mentorship/my-coach/followups?page=&pageSize=` returns Paginated<MentorshipSharedFollowupDto>, shared decisions only current active period.
- PUT `/mentorship/my-coach/followups/:followupId/response`: version, response ACCEPTED|CHANGE_REQUESTED. Only OPEN records; same response retry returns same row without notification. Return shared DTO.
- GET `/mentorship/followups/availability`: `{ enabled: boolean }`, requires authentication; combines mentorship.enabled + mentorship.followups.enabled for UI hiding. All data operations also enforce flags and access.
- `mentorship.followups.enabled` default false. Error codes FOLLOWUP_NOT_FOUND, FOLLOWUP_CONFLICT, FOLLOWUP_DISABLED, FOLLOWUP_DATE_INVALID prefixed MENTORSHIP_; localized TR/EN.
- Events emitted after commit, with IDs/version only: `mentorship.followup.shared`, `mentorship.followup.responded`. Payload `{ followupId: string, version: number }`.
- Export `MentorshipFollowupService` from module with notification seams `getNotificationTarget(followupId, kind: 'shared'|'responded', version)` returning `{recipientId, link: string}|null`, `listDueCoachIds(now)` and `getDueCount(coachId, now)`; recheck enabled/active period/status for notifications. No note or decision text crosses seam.
- Due notification summary once per coach/Istanbul day through existing cron/queue, app plus preference-aware email. Recheck candidates at send execution. Account erasure cascades followups via link FK.

## Ownership and verification

Backend worker: schema/migration, link period, mentorship module/services/controllers/repos, types/validation/config/error translations, API unit/integration tests. Frontend worker: web components/lib/messages and UI tests. Notification worker: notifications module, scheduler/events/copy/email/types used only by notifications, tests. Root: generated API client/OpenAPI integration, feature docs, API catalog, review and full verification. No commits/push. Existing analysis changes belong to user.

Acceptance: immutable decisions; private DTO exclusion; transactional active-link gate; no old-period access; optimistic concurrency and idempotency; accurate global actionable pagination; no stale notification sends; TR/EN accessible loading/empty/error flows. Targeted checks during implementation, full CI-equivalent before release readiness.
