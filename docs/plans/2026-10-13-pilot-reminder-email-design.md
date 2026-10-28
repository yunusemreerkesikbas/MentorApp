# Pilot reminder email control

The earlier proposal used an invited 20–50-person pilot
and the existing Postmark Free plan (100 messages/month). On 2026-10-13 the owner selected
in-app/push daily reminders and reserved email for account verification/reset flows.

> Current cost direction (2026-10-28): free plans first, measured need before bounded paid
> usage, no fixed total-budget target. Resend replaces Postmark and invited mode stays off.
> This reminder-control design remains valid; its historical provider/cohort assumptions do not
> select today's launch profile. See [current plan](2026-10-28-free-first-launch.md).

## Decision

Add `notifications.daily_reminder.email_enabled` to the existing configuration registry.
Default it to `true` to preserve current installations. Operators explicitly set it to `false`
for the pilot; this development does not change a live flag or deploy anything.

Read the setting once when dispatching daily reminders. A disabled email channel must not
enqueue email or consume an email delivery-deduplication claim. In-app reminders still exist;
push follows the user's existing preference. Never overwrite the user's preferences.

Recheck the setting in the existing email handler for `coaching.daily-reminder` only, so
previously queued reminders are suppressed after a pause. A suppressed job completes
intentionally and is not replayed on re-enable. An already in-flight provider call cannot be
recalled. Identity token checks, verification/reset mail, payment mail and coach mail retain
their existing boundaries. The flag is not a global email quota or a delivery guarantee.

## Alternatives and evidence

- Disabling users' email preferences would hide individual choices and affect other messages.
- Postmark Basic costs USD 15/month; the owner selected the free quota instead.
- Increasing queue polling intervals would not stop Render's DB readiness probes from keeping
  Neon active. Verification tokens currently last 180 seconds; the existing 5-minute catch-up
  cron cannot be their sole delivery mechanism. Preserve polling, readiness and maintenance.

No new endpoint, migration, queue implementation, provider, billing acceptance, secret,
hosting change or public admin exposure is required. Separate source branch from PR #157.

## Verification

Reproduce paused-email failures before implementation. Test enabled/disabled dispatch, inbox
and push preservation, queued suppression, and guarded verification/reset delivery. Verify
the registry and handlers together against local PostgreSQL, then run API targeted checks.
Full exact-head CI is required before declaring the PR ready for review. Record measured
cost assumptions separately; local fake-provider timings are not production latency evidence.
