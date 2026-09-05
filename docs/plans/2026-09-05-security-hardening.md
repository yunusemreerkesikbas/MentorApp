# Security hardening implementation

Source: the user-approved security review and implementation plan in this task.

## First package

1. Allowlisted HTTP/error/Sentry logging, no credentials or personal content.
2. Persistent, revocable sessions (`sid`), transactional refresh rotation/reset/logout, live principal checks, cross-tab refresh, SSE revalidation.
3. Explicit Google linking after verified email and password confirmation; remove implicit email merges.
4. Push provider allowlist, bounded delivery, subscription cap and no network calls inside database transactions.
5. Single-use authenticated upload tickets, server-side streaming limits/file inspection, private-by-default personal media, durable object cleanup.
6. Supported Next.js 16 baseline, production configuration/database safety checks, CI dependency/secret scanning.

## Acceptance

Regression coverage for logged secrets, pre-hijacking, stale roles/sessions, concurrent refresh/logout/reset, private push targets, invalid/replayed/oversized/cross-user uploads. Targeted checks per slice; full CI before release readiness. Forward-only migrations; one-time login reset accepted for this closed-test rollout.

## Operational boundary

Implement and verify local changes. Production session revocation, cron key rotation, historical log retention, storage migration/cache purge, Access/MFA and origin configuration require the actual deployment environment and are documented as release actions, never claimed performed from local tests.

## Follow-up review

AI provider data minimization/disclosure, client-reported ad rewards, AI spending reservations, admin persistent tokens/CSP and deployment access policy remain separately tracked follow-up work.
