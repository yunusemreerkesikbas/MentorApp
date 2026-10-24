# Independent phone requirements: verification (2026-10-24)

## Behavior

SMS transport and self-service OTP remain off by default. The audited registry independently
controls `mentorship.phone_verification_required` and
`payments.trial.phone_verification_required`, both false by default. Ordinary coaching retains
verified email and existing role/link/seat/consent checks. Sponsored Premium remains off and
always requires actual verified coach/student phones.

New trial claims store a null fingerprint when phone ownership is not required. Existing non-null
claims retain their phone checks; later flag changes cannot alter a reservation's verification
mode. Account limits, concurrent reservation locks, provider holds, explicit trial/paid intent,
webhook idempotency and erasure fences remain in place. Account-only mode cannot deduplicate
trial abuse across different accounts by phone.

## Evidence

- 420 targeted backend assertions passed after the fresh review fixes, including optional coach
  notification delivery, identity contact snapshots, trial toggles and strict sponsorship.
- 39 dedicated local Postgres/API assertions passed for phone, trial claims, checkout concurrency,
  erasure fencing and sponsorship. The extended trial suite covers concurrent null claims and
  activation after enabling the requirement.
- Fresh migration and upgrade from 0125 passed. Upgrade preserved an existing phone claim and
  ACTIVE subscription; full-journal replay was idempotent. Migration 0126 was generated with
  Drizzle and only drops fingerprint NOT NULL; indexes and RLS remain intact.
- 99 additional mentorship/coach-registry API assertions passed. Strict-contact scenarios now
  explicitly enable their requirement; the registry suite also exercises optional invitations
  with an unverified phone and an authoritative null `inviteBlockedReason`.
- All 1,009 web unit assertions passed. Full workspace lint and typecheck passed; existing lint
  warnings remain. Deployment configuration checks passed. The final backend typecheck passed.
- 74 mobile/desktop Chromium phone and trial browser cases passed, including TR/EN SMS-off trials,
  paywall consent, pending payment resumption and masked read-only verified numbers.
- Final coach/onboarding Chromium run: 82 passed, four existing viewport-specific skips. The
  initial two stale completion-copy expectations were corrected; the full rerun passed. A final
  TR/EN SMS-off disclosure rerun passed 4/4 with the exact English retention-copy prefix.
- 41 additional Postgres/API assertions passed for the updated strict-phone payment/followup
  fixtures and the study-room setup rerun. The payment suite also proves a real phone-optional
  carded checkout consumes a null-fingerprint claim.
- Final standard Turbopack workspace build passed 8/8 tasks with concurrency one. The earlier
  admin child-process handshake failure did not recur in the clean isolated retry. No project
  compiler setting was changed. Native web performance-budget checks and deployment-config
  checks passed. The earlier webpack web build also passed.
- Final changed-file lint and backend typecheck passed. No lint rule, budget or timeout was
  weakened, and the migration journal is forward-only.

## Whole-suite limit

The earlier full workspace attempt passed all 1,009 web assertions but did not complete API
coverage: stale strict-phone fixture assumptions failed and the worker exited. A subsequent
single-worker full API attempt exposed seven payment and three followup fixture failures and
one study-room 90-second bootstrap timeout (16 cases skipped). Those fixtures now opt into
strict phone verification; fresh focused reruns passed all 41 assertions, including study rooms
without increasing the timeout. The broad attempt was stopped after triage rather than claimed
green. No complete green API-suite run or remote full-CI result is claimed; remote CI is still
required before merge.

## Review and limits

One fresh-context review found two ordinary-notification paths still requiring phones: the
student-note event and final verified-email contact snapshots for digests/followups. Regression
tests reproduced both before the fixes and passed afterwards. Sponsorship's contact gate remains
strict. Stale strict-phone fixture assumptions and onboarding copy expectations were updated to
match the selected requirements; assertions and production gates were not removed.

No production migration, live config override, provider setup, carrier SMS, payment or deployment
was performed. The work is based on current master 673a193a reconciled with PR #145; the primary
checkout's existing edits remain untouched. Apply the migration before the API/web rollout, and
check effective live overrides explicitly. Full default CI remains required before merge.
