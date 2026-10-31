# Core-trial social boundary verification

Date: 2026-10-30, Europe/Istanbul. Local uncommitted candidate on `feature/APP-123`,
base `4bbd4136b9ea23501d44f620bfe197528a02e831`. This is source/local acceptance,
not production deployment or complete Linux CI.

Final executable/test source fingerprint (2516 files):
`58befdd209193a8dc05d5b7a85883e3e79650170df70a37cbad68fee5018307e`.
The ignored `final-source-manifest.json` records each file hash. Temporary QA type includes were
restored only after checking the original/current compiler settings matched; React type pins
were preserved. Owned temporary servers were stopped, and the existing development API was retained.

## Result

The approved boundary closes relations, invitation side effects and other-user profile/badge
reads independently of the forum. Own progress remains available. Closed room starts reject before
transaction writes, including existing members; existing finalization and solo work remain usable.
Stale identity/invite/buddy/room signals cannot deliver social notifications or write delivery markers.

Eleven public, allowlisted booleans supply one nullable server document snapshot. Purchase composition
stays on the server; existing-account coach registration is independent of new-account signup.
Shared optional navigation/clients, stale destinations and coach account safety follow that snapshot.
Failed/malformed snapshots and safe destinations have unit coverage. Server policies remain
authoritative when a document becomes stale. No visual redesign was made.

## Evidence

Logs are in `.artifacts/deployment/core-social-20261030/` (ignored).

| Check | Result / evidence |
| --- | --- |
| Affected API unit suites, after review fixes | 240/240, 17 files, `review-combined-green.log` |
| Real HTTP/Postgres boundary and exact config teardown | 4/4, `review-isolation-green.log` |
| Final web unit suites | 1099/1099, 166 files, plus 8 Node checks, `web-unit-complete.log` |
| Ordinary enabled browser regressions | 297 passed, 9 intentional viewport skips, no failures/retries, 306 cases, `enabled-browser-final.log` |
| Enabled panel/analysis after final visual fixes | 61 passed, 1 intentional viewport skip, no failures/retries, `visual-enabled-browser.log` |
| Standalone community-ad browser suites | 96/96, `community-ads-browser.log`, provider calls stubbed |
| Closed core browser profile | 20/20 TR/EN x mobile/desktop, including premium automatic-AI refusal, `core-browser-complete.log` |
| Production API / web builds and web typecheck | Passed, `api-final-build.log`, `web-complete-final-build.log` |
| Workspace lint/typecheck and prerequisite package builds | 21/21 before final review fixes, existing warnings recorded, `workspace-lint-typecheck.log` |
| Actual final QA-build performance budgets | Passed, `web-complete-final-budgets.log`; root messages 695 B / 1024 B |
| Deployment configuration | Passed, `deployment-check.log` |

Browsers use isolated loopback Postgres databases, API `:3401` and web `:3100`; the existing
development API on `:3001` was preserved. Acceptance helpers block non-loopback provider sockets.
Ordinary core cases use real signup, account updates and core API data, stubbing silent auth
with the real access token. The premium case additionally stubs entitlement/analysis metadata to
check that globally closed greeting and ghost narration never start. Its coach case verifies presentation; adjacent server coach policies
were independently reviewed. It does not grant or prove server coach authorization.

An earlier concurrent run stopped on a notebook flight-overlay timing assertion. The complete
quiet rerun above passed; focused repeated replay is recorded separately. Initial fixture signup
was corrected to send the required Origin header; no security guard was weakened.

## Review and decisions

One fresh read-only review found three P2 defects, each reproduced before correction: global flags
leaked across HTTP suites, the standalone SSR ad fixture lacked availability, and signup closure
incorrectly hid existing-account coach registration. The fix pass restores exact touched rows
(including original absence), restores environment/default test URL in failure-safe teardown,
supplies explicit test-only availability, and splits `coachRegistration` from `coachSignup`.
Each fix has RED/GREEN evidence. No reviewer minor findings were deferred.

Screenshot inspection in the same fix pass found a remaining shared Premium ask. RED browser checks
also reproduced automatic daily-greeting and ghost-narration requests from a simulated premium
entitlement while AI was globally off. Shared purchase nudges now follow audience availability;
both hooks stop on global closure and retain rule-based encouragement. Expanded core acceptance
passed 20/20. The notebook flight timing assertion also passed a focused 6/6 repeated replay.
Panel/analysis enabled-mode regressions after these final visual findings passed 61 with one
intentional viewport skip. Settled Turkish desktop screenshots are in `final-screenshots/`.

Execution decisions: owner continuation approved the reviewed inline design; current checkout/owner
edits were preserved; availability is a document snapshot, not authorization; commits/integration
remain deferred; isolated ports preserve the development service. Costs: stale presentation until
reload, source identity needing revalidation after concurrent edits, and full CI still requiring an
exact reviewed commit. Signup booleans describe global switches; per-email pilot admission remains
a backend decision. The core profile has pilot off. An uninvited pilot user may still reach a form
and be refused on submission; no email-specific entitlement is exposed.

## Live inventory and remaining gates

Read-only DNS on 2026-10-30 found no A/AAAA address answer for `puhukoc.com`; `www` and `api`
returned name-not-found from `1.1.1.1` (`domain-dns.json`). Mail records were not changed.

The connected Neon account shows one Free (`free_v3`) project, `puhu-s1`, Frankfurt
(`aws-eu-central-1`), PostgreSQL 16. Its only visible branch is archived default `staging`.
A dedicated active production database was not found in this connected account. Only management
metadata was read: no SQL, credential retrieval, branch activation or remote write.

Before admission: freeze/review a commit and pass full Linux CI including security browsers;
prepare a dedicated trial DB with separate runtime/migration roles and verified flags/content;
rehearse Free-host cold starts/maintenance; verify actual auth mail/Turnstile, private media,
Sentry, recovery, closed-mode rollback and support without admin. Aggregate R2 spending/reservations
remain separate from per-user quotas. The optional paid `render.yaml` was not applied. No live
provider/billing/DNS write, deployment, commit, push or history rewrite occurred in this implementation.
