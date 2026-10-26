# Netgsm release preparation verification, 5–6 October 2026

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
| Full workspace build | Eight tasks passed with the CI public build values; an initial clean-environment attempt lacked NEXT_PUBLIC_SITE_URL and failed before rerunning. |
| Phone browser acceptance | Chromium mobile and desktop, 38/38 passed (TR/EN, paste, deadlines/resend, disabled provider, reauthentication, sponsorship, explicit paid/trial and resumable checkout). Mock API responses, not carrier evidence. |
| Full workspace tests | Failed: API 354 files / 3,092 assertions passed, one stale AI-call assertion failed, and auth 26 cases skipped after 30s boot timeout; web 142 files / 919 assertions plus seven Node script tests passed. The stale AI test is fixed (2/2 pass). Auth alone passed 26/26 with --hookTimeout 120000, without a committed timeout change. This is not a green single full-suite run. |
| Dashboard performance budget | FAIL: attributed 833,417 / 778,240 bytes (+55,177), total 1,385,789 / 1,326,080 (+59,709). Other reported budget checks passed. No threshold/gate changes. |
| Remote CI | [Initial run 37368844229](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/37368844229) and [code/fixture head run 37373814199](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/37373814199) FAILED on dashboard performance; secret scan, audit, lint, typecheck and build passed. Later test/seeded-API/browser steps were skipped, not passed. Remote dashboard sizes: 833,490 / 778,240 and 1,385,922 / 1,326,080 bytes. |
| Full browser inventory | FAIL: 916 cases, 787 passed, 20 failed, 109 skipped in 22.5 minutes, two workers. All 38 phone cases passed within this full run as well. Existing viewport/feature skips remain; no new skip or weakened assertion. |
| Fresh diff review | No actionable finding; independent reviewer did not execute tests. |

Shared package build was required in the clean worktree before tests could resolve package
exports; the first wider unit attempt passed 83 assertions but five suites could not import
unbuilt packages. Building packages and rerunning passed all 119. This was setup, not a runtime
code defect. Raw run logs are local temporary files named mentor-netgsm-*.log and not committed.

## Acceptance coverage

- Phone API suite: authenticated routes, ownership/session binding, expiry, resend invalidation,
  concurrent replay and uniqueness, account/number and global quota atomicity, erasure-resistant
  abuse counters, fresh login versus refresh, old-number preservation and UNKNOWN confirmation.
- Trial claims plus entitlement/checkout suites: atomic account/phone reservation, activation rollback,
  detached 12-month consumed history, unknown claims after erasure, paid choice without SMS and
  ineligible trial without provider effects.
- Sponsorship/mentorship suites: both contacts, activation, repair/reallocation and post-verification
  listener under sponsorship flags. Existing gates were tested without granting live entitlements.
- Browser suite: paste/full code, recoverable invalid code, deadlines/manual resend, unavailable SMS,
  safe Google/password return and paid/trial/sponsored states in TR/EN at both viewports.
- Transport tests: official URL/auth/body, ASCII length, long string IDs, documented rejections,
  malformed/non-2xx/empty IDs, configured abort, no automatic retry or disabled-provider call.

## Broader test findings

The first broad browser attempt was interrupted after repeated profile/settings error boundaries.
Trace confirmed undefined.verified: four existing mocks returned a bare 204 for the newly used
phone GET. They now return a typed unavailable/unverified status; no send/confirm mock or product
behavior changed. Targeted rerun passed 16 cases and still failed eight journey-scene cases, whose
assertions expect the previous dialog while production loads JourneySpotlightScene. These unrelated
journey assertions remain a separate gate; their checks were not weakened or skipped. A subsequent six-worker attempt was stopped after host slowdowns (snapshot: 478 pass, 12 fail);
it is not a completed or passing suite. The subsequent complete two-worker run finished with 787 passed, 20 failed and 109 skipped across 916 cases. Its 38 phone cases all passed.

The AI daily-limit failure used an obsolete three-argument brief.generate call after delta became
an explicit parameter. Adding null aligns the existing call and preserves the coach payer assertion;
both daily-limit tests pass. No production AI logic changed.

A subsequent auth rerun met local PostgreSQL recovery (57P03) before tests. The existing shared
local container recovered automatically; no data reset or container restart was performed. Only
this task's isolated browser API was restarted. After stopping heavy concurrent work, auth passed 26/26 in 38.92s total with a 120s setup
allowance (no repository timeout change). These focused reruns do not replace the failed full-workspace attempt.

## Separate browser work

The completed inventory has 20 failures in four files: journey-level-celebration.spec.ts (8),
notebook.spec.ts (10), notebooks.spec.ts (1), and community-member-profile.spec.ts (1). Journey
assertions still request the old combined tier/name dialog label, while the current spotlight scene
uses the scene name; the separate readable-name spotlight test passed. Notebook failures cover
sticker/note/drawing/eraser/edit/remove controls, and the community failure covers profile/bookmark
URL history. Their complete root causes are not established by this OTP follow-up. Investigate
these flows separately and rerun the unchanged full inventory; no UI production patch or test bypass
was added to hide them. The original phone DTO error no longer occurred in the completed run.

## Separate dashboard work

The dashboard budget is outside this OTP follow-up. Reduce its initial JavaScript below both
existing limits, then rerun the unchanged budget check and full CI. The previous dated report
already records the same gate; this PR changes no production frontend code. Current measured evidence:
[evidence/2026-10-05-netgsm-web-performance-budget-report.json](evidence/2026-10-05-netgsm-web-performance-budget-report.json).
Do not change the limit, skip the check, or call the draft merge-ready while this gate is red.

## Remaining gates

- Resolve the separately recorded browser failures and obtain a green complete workspace test run.
- Fresh complete CI, including secret scan and dashboard performance budget. The preceding
  dashboard budget failure is tracked separately; do not raise budgets, skip the gate or call
  a failing/skipped pipeline green.
- Approved sender/KEP completion, active OTP units, verified outbound allowlist, server secrets
  and real Turnstile hostname. Use the ordered checklist in ../core/integrations.md.
- Normal target migration deployment and consented three-operator carrier pilot. Mock transport
  and browser tests establish behavior, not live delivery. Keep production phone/sponsor rollout off.
- Completed iyzico integration and separate real-card acceptance before live carded trials.

## Handoff

[Draft PR #145](https://github.com/yunusemreerkesikbas/MentorApp/pull/145) contains the bounded code,
test-fixture maintenance and runbook changes. Code and local verification work are recorded; merge
and live-release acceptance remain blocked by the gates above. Task-owned test servers stopped and
the final dedicated browser database was removed after the completed run.

See ../plans/2026-10-05-netgsm-release-prep.md for the execution rulings and
../core/integrations.md for rollout/stop semantics. Phone kill-switch blocks both sends and
confirmation; setting global daily send quota to zero pauses sends without that confirmation block.
