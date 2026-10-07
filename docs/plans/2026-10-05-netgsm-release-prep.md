# Netgsm release preparation execution record

## Approved scope

Close the existing sender validation/tests, complete the operational checklist, renew unit/DB/browser
acceptance, and prepare one follow-up PR. No live SMS, portal changes, production migration or
rollout. Preserve other workspace edits; iyzico and dashboard performance remain separate.

## Tasks

- [x] Validate the Netgsm contract and finish boundary fixes.
- [x] Complete the ordered onboarding/network/secrets/migration/pilot/stop runbook.
- [x] Renew focused unit, real DB and TR/EN browser evidence; rehearse fresh and upgrade migrations.
- [x] Review, run full CI scope, prepare a draft PR and record outstanding gates. Merge/release gates remain red.

## Rulings

- Isolate from feature/APP-117 and its unrelated package deletions; base this worktree on origin/master.
  Copy only seven existing OTP files, leaving the original checkout untouched.
- Existing phone kill-switch blocks sends and confirmations; document this rather than silently
  changing the API. A zero global send quota preserves pending confirmation.
- The preceding sender-minimum fix already has recorded RED/GREEN evidence; retain it and rerun.
- All database checks use dedicated localhost test databases. No developer/provider secrets copied.
- Dashboard budget failures remain separate and block merge readiness; no threshold increases.

## Verification

Current runs completed on 6 October. See the dated QA report for final results and external gates.
Draft PR #145 is reviewable, not merge/release-ready: full CI stopped on the unchanged dashboard
budget, and the complete browser inventory has unrelated failures. No live SMS or rollout.

- Task 1: complete. New empty/whitespace jobid tests failed (2 failures, 22 pass), then the guard passed in the 119-test focused unit run.
- Task 2: complete. Checklist reflects verified official docs and existing kill-switch behavior.

- Broad verification exposed missing phone DTOs in four profile/settings browser mocks. Corrected exact GET fixtures only; original scene/navigation assertions remain intact.
- Broad verification exposed a stale coach AI brief test signature. Added the already-existing null delta argument; both daily-limit tests pass without changing production AI.
- Full API attempt: 354 passing files, 3,092 passing assertions; auth boot hit 30s and one stale AI test failed. Corrected AI test passes separately; auth retry passed 26/26 with a 120s test-boot allowance. Complete browser inventory: 787 passed, 20 failed, 109 skipped / 916 cases in 22.5 minutes; all 38 phone cases passed.
- Journey scene assertions still expect the previous dialog; record independently rather than rewriting journey UI in this OTP follow-up.
