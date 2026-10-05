# Netgsm release preparation verification, 5 October 2026

## Scope

Follow-up to merged SMS OTP implementation. Based on origin/master a8d2956b in an isolated
managed worktree; the original feature/APP-117 checkout and unrelated package deletions remain
untouched. Retains the sender-minimum fix, tests the official REST v2 boundary and rejects an
empty provider task ID as UNKNOWN. No public API/schema change, production migration, live
Netgsm call, portal permission change, purchase or rollout occurred.

## Current evidence

| Check | Result |
| --- | --- |
| Empty task ID RED | Two assertions failed as expected (empty/whitespace jobid incorrectly SENT), 22 passed. |
| Focused units GREEN | 10 files, 119/119 tests: Netgsm transport 24, phone environment 7, existing environment 48, crypto/input, trial/sponsored entitlement and Sentry privacy. |
| Real Postgres/API | Seven files, 66/66 tests: phone 12, trial claims 7, auth 26, erasure fence 5, reactivation 1 and sponsorship/concurrency 15. |
| Migration rehearsal | Fresh and upgrade-from-0119 databases each applied 125 journal entries and replayed idempotently. Three forced-RLS phone tables, five required columns and four unique indexes verified. Existing user/ACTIVE subscription preserved with null contact fields. Only two dedicated localhost test DBs were created and removed. |
| Full workspace lint | 13 tasks succeeded; existing warnings remain. |
| Full workspace types | 13 tasks succeeded. |
| Production dependency audit | Exit 0 at the CI high-severity threshold under existing audit policy; two moderate advisories remain and one high advisory is already ignored by repo policy. No new exception. |
| Full build, test and browser | Running; update before closing this follow-up. |
| Fresh diff review | No actionable finding; independent reviewer did not execute tests. |

Shared package build was required in the clean worktree before tests could resolve package
exports; the first wider unit attempt passed 83 assertions but five suites could not import
unbuilt packages. Building packages and rerunning passed all 119. This was setup, not a runtime
code defect. Raw run logs are local temporary files named mentor-netgsm-*.log and not committed.

## Remaining gates

- Fresh complete CI, including secret scan and dashboard performance budget. The preceding
  dashboard budget failure is tracked separately; do not raise budgets, skip the gate or call
  a failing/skipped pipeline green.
- Approved sender/KEP completion, active OTP units, verified outbound allowlist, server secrets
  and real Turnstile hostname. Use the ordered checklist in ../core/integrations.md.
- Normal target migration deployment and consented three-operator carrier pilot. Mock transport
  and browser tests establish behavior, not live delivery. Keep production phone/sponsor rollout off.
- Completed iyzico integration and separate real-card acceptance before live carded trials.

See ../plans/2026-10-05-netgsm-release-prep.md for the execution rulings and
../core/integrations.md for rollout/stop semantics. Phone kill-switch blocks both sends and
confirmation; setting global daily send quota to zero pauses sends without that confirmation block.
