# Optional phone verification

Approved plan: keep SMS transport and phone availability off; independently configure mentorship and carded-trial phone requirements, both false by default. Keep sponsorship disabled and its real contact checks intact.

1. Add registry controls and authoritative invitation blocking state; apply optional contact checks to all mentorship reads and notifications.
2. Make trial fingerprints nullable through a generated forward migration; snapshot trial requirements in each claim, preserving checkout concurrency, idempotency and erasure fences.
3. Render API decisions in web, hide unavailable forms, preserve masked verified numbers and align TR/EN copy. Export OpenAPI and regenerate the client.
4. Add targeted unit, Postgres and browser acceptance; document operator settings and run wider checks before any readiness claim.

## Execution ledger

- Base: PR #145 d75228e8 reconciled with master 673a193a in isolated feat/sms-config-controls (7c3a5bca). Existing main-workspace edits preserved.
- Native worktree registration failed; a repository-local ignored worktree provides isolation. No production configuration or provider was contacted.
- Interfaces: nullable claim fingerprint records the phone requirement at reservation, so later config edits cannot change pending checkout requirements. New API response fields are additive.

- Contact/trial regression tests observed RED, then GREEN; 412 targeted units and 39 real Postgres/API assertions passed. Fresh schema and upgrade from 0125 preserve existing phone claims and ACTIVE subscriptions; replay is idempotent.
- Final review found two ordinary-notification gates still requiring phones (student-note event and identity contact snapshot). Both now follow the mentorship switch; sponsorship stays strict. Regression tests observed RED before fixes. No production/provider action occurred.
- Initial native build failed at an admin child-process handshake. A clean isolated native retry and final standard workspace build passed (8 tasks, concurrency one); performance budgets and deployment checks passed. Full typecheck and lint passed; final changed-file lint/backend types passed.

- Browser acceptance: phone/trial 74 passed; final coach/onboarding 82 passed and four existing viewport skips; exact TR/EN retention regression 4 passed. Post-review targeted backend 420 passed; dedicated phone/payment/sponsorship/erasure API 39 passed; coach-registry API 99 passed; corrected payments/followups plus study-room rerun 41 passed.
- Ruling: preserve strict-phone coverage by explicitly enabling its flags in existing HTTP fixtures; add optional HTTP checkout/invite scenarios instead of retaining unconditional requirements. Account-only mode cannot prevent multi-account phone-based abuse, as accepted in the approved plan.
- Full API attempts were not green: initial stale fixture failures and worker exit; later stale payment/followup expectations and a study-room bootstrap timeout. The relevant fresh rerun passed 41/41 with unchanged timeouts. Broad execution stopped after triage; no whole-suite or remote-CI success claimed. See docs/qa/2026-10-24-phone-config-controls.md.
- Review scope: browser and broad checks were verified separately above; live provider delivery, production overrides/migration and release remain deliberately unexecuted. Current remote master and PR heads were rechecked before publication; primary-checkout edits remain untouched.
