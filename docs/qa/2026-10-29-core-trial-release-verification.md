# Core-only trial: local release verification, 2026-10-29

## Scope and status

The owner confirmed the landing/notebook handoff complete and authorized release checks
against the existing working tree. Branch: `feature/APP-122`; baseline HEAD:
`e2e9bd734539e7929446e63576169f0c04e0a337`. Changes are uncommitted. This document
does not establish a successful GitHub CI run, clean Linux installation, hosted acceptance
or approval to deploy. No cloud, DNS, billing, credential upload, mail delivery or push
was performed in this verification.

The selected scope is the Free core-tools trial with admin HTTP access disabled and AI,
community/forum, human coaching, payments, SMS and advertising closed. See the
[implementation evidence](2026-10-29-closed-trial-implementation.md) and
[launch audit](2026-10-29-launch-readiness-review.md) for the separate live gates.

Local evidence is ignored under `.artifacts/deployment/release-20261029-core-trial/`.
Installed runtime: Node 22.14.0 / pnpm 11.1.1. Production Node 22.22.0 and GitHub's
Linux environment still require their own successful checks. Existing dependency audit
exceptions and secret-scan rules were preserved.

## Completed checks and open verification

| Check | Result | Qualification |
| --- | --- | --- |
| All-package lint/typecheck and prerequisite builds | 21/21 tasks successful, zero cache hits | Existing warnings remain. Four Premium UI files changed after this source snapshot; their final verification is recorded below. |
| Production dependency audit | Exit 0; zero critical/high, four moderate and two low findings | Existing high-severity policy and audit exceptions, not a zero-vulnerability claim. |
| Deployment configuration | Passed | Checks the retained optional paid Blueprint; it does not provision or validate the selected Free hosting profile. |
| Non-API tests | 5/5 tasks successful, zero cache hits | Web: 1,056 tests / 164 files plus seven native script tests. Final Premium UI delta still needs verification. |
| API/web production build and dependencies | 7/7 tasks successful, zero cache hits | Turbo filtered the QA-only dist environment variable; web output was the normal `.next` directory. |
| Admin production build | Passed | Separate `.next/release-20261029` output. Admin build skips generated route type errors by its documented accepted configuration; the separate admin typecheck passed above. |
| Web performance budgets | Passed all ten limits | Measured the actual normal `.next` build used by browser tests; report retained there. |
| Dedicated dummy-CAPTCHA web build | Passed | Separate `.next/release-security-20261029` output; no real Turnstile verification performed. |
| Full API command | Reached its 45-minute operator limit | API/shared-source hash stayed unchanged during that original run. No final full-suite summary. Focused dispositions are below. |
| Mobile/desktop browser suite | Stopped on the owner's explicit request to wait for ongoing web work | The second attempt used a PID-verified isolated API, but reported failures in plan, notebook deletion, SMS-off subscription copy and one mobile blog-ad case. No final green summary; diagnostics are retained for the web handoff. |
| Dedicated CAPTCHA/security browser suite | Waiting for web handoff | Must use the dummy-key build and preserve ordinary fixture behavior. |

The initial build with the extra test-process TCP preloader failed in a Turbopack helper
connection. Admin succeeded without that preloader, with provider credentials blank.
Build diagnostics changed no production code. Next added isolated generated-type includes
to admin/web tsconfig files; both were restored byte-for-byte from backups after checking
that no independent changes would be overwritten.

The first browser attempt is **invalid evidence**: its intended isolated API exited with
`EADDRINUSE`, while the readiness probe reached an existing development API. That run was
stopped and its partial log retained separately. The identified MentorApp API development
watcher was temporarily stopped, then a new isolated API was started. The replacement
listener PID and ready response were verified together before restarting browser tests.
The owned test API was stopped when the owner paused web verification. The original
development API watcher was not restarted automatically; this avoids resuming its configured
provider/queue behavior as part of a fake-provider release check.

## Backend fixes and final focused verification

Independent review of the notebook handoff identified count-then-write quota races,
nested connection acquisition inside user transactions, an allowance that could grow from
the saved-page row count, and a paginated frontend count replacing the server total.
Only backend fixes were implemented here. The frontend count finding remains deferred
under the owner's explicit web pause.

- Resolve one immutable policy containing entitlement and every quota value before the
  user transaction. Quota checks inside it use only its repository/client.
- Serialize Free quota mutations with a shared per-user PostgreSQL transaction advisory
  lock. Reread an entry after locking before deciding whether a solution adds a photo.
- Prefetch label taxonomy using the immutable exam ID before the write transaction; then
  validate merged references against the freshly locked entry without another pool query.
- Keep an exact previously saved page editable above a lowered limit. Its row count cannot
  create permission for another new page. Product limits and public DTOs are unchanged.
- Separate the collection fixture's STAFF/Premium pagination scenario from its Free quota
  regression. The actual default limit of one was not increased to make the test pass.

RED HTTP evidence reproduced **five creations when the Free limit was one**. The page
allowance regression also failed before its fix. Two further RED tests detected taxonomy
reads during an open transaction and validation of stale merged labels. The first version
of the stale-row test lacked its stored fixture; that setup error was corrected and the
RED test rerun before implementation.

Final checks:

| Check | Result | Evidence/limit |
| --- | --- | --- |
| Defter service, quota policy and real HTTP regressions | **50/50**, three files | Includes ten concurrent creates: one 201 and nine quota 403s; ten concurrent labeled updates: all 200. API/shared source unchanged throughout this final run. |
| Reminder, legacy notifications, phone-reactivation and interrupted-job fixtures | **18/18**, four files | Original setup timeouts did not reproduce after heavy web checks stopped. This observation does not establish a specific timeout root cause or justify increasing their timeouts. Source unchanged. |
| Supporting coaching/collection/history/migration/analysis flow run | **41/41**, five files | Preceded the final taxonomy delta; only newly added unit regressions changed its source hash during execution. The final service/HTTP run above verifies the subsequent code. |
| API unit-file coverage | **336 files / 3,172 tests accounted for**, zero skipped | Partitioned local evidence: 135 completed files from an interrupted first run plus 201 remaining files in a successful run; the two changed service specs were rerun against final code. Not a single clean full-API/full-workspace CI run. |
| Final API typecheck and owned-file ESLint | Passed | API compiler plus six owned source/test files; lint ran from the API workspace using its actual configuration. The earlier root-directory ESLint attempt ignored those files and is not counted. |
| Final API production compilation | Passed | Nest CLI with the same source/configuration and an isolated, path-checked output directory; no development `dist` overwrite for this final build. |
| Independent final backend review | No remaining blocking finding | Reviewer inspected the final policy/locking/taxonomy/page changes; did not execute tests or edit files. |

Final real-HTTP, fixture and remaining-unit runs share API/shared-source SHA-256
`8bef2ad95d08ceedd1193ac93f4ed36ddcb5ed46800e23d0a6fec1e77be5b629`.
The manifest intentionally includes shared packages. A later web/shared-style edit can
change that hash without making an old result evidence of a newer complete checkout.
Per-run result JSON and `api-unit-{partitions,aggregate}.json` retain the full attribution.

## Source stability

The initial source manifest contains 4,697 tracked/untracked non-ignored source files.
A mid-run comparison initially found four independent Premium UI edits after the snapshot:
`premium-paywall-{benefits,footer,modal,plan-picker}.tsx`. These edits were preserved.
The first build/test results cannot establish verification of those later file contents.
Further web/admin branding, Premium and shared-style changes continued in the other session.
They were preserved and are outside this run's accepted final backend verification scope.
The owner explicitly asked to wait on web verification. No final web, admin or complete
checkout release-readiness claim is made from the early snapshot.

## Secret-scan disposition

Gitleaks 8.30.1 was downloaded from its official GitHub release. The Windows archive matched
the GitHub asset SHA-256
`d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e`.
Scans used full redaction. No key was tested against a provider or submitted to a search
engine. No ignore rule or audit exception was added.

- **Pending patch plus non-ignored new files:** exit 0, no leaks found. This is a local
  patch scan; the eventual committed range must still pass the GitHub action. After the
  backend fixes, the final API/owned-documentation patch was rescanned separately: exit 0,
  no leaks found. Ongoing web work was excluded in accordance with the owner's pause.
- **Current-source snapshot:** exit 1, six reviewed generic-key findings. They are an
  obviously synthetic Access audience, an OTP test secret, a test-only password, a browser
  storage key and two literal `R2_PRIVATE_BUCKET` environment-variable names. No production
  credential was found in those six locations. The raw scan is not represented as green.
- **Full Git history:** exit 1, nine findings over 485 commits. Five match the generic
  fixture/identifier cases above. Four Google-key occurrences represent two distinct values
  from the imported template examples. Provenance is established below; this is not a
  credential-revocation check or a history-cleanup operation.

The four Google-key occurrences entered together in the original Duralux import,
`ad8e7ce5b553d687afeca04c9d8d9acfe2a2a6f9`. Commit `38f58be0` already replaced
them with `YOUR_YOUTUBE_API_KEY` in the current tree. The owner did not know their origin
and asked for source investigation. Exact full-value comparisons, without printing or
transmitting the values, established:

| Historical location | Public upstream source containing the same complete value |
| --- | --- |
| `apps/admin/Documentation/assets/Youtube-Channels-Playlist/index.html`, lines 136/143/151 | [Original YCP example, 2018-09-17 commit](https://github.com/bachors/jQuery-Youtube-Channels-Playlist/blob/1855838353bd3003dd3e2ff95daa63fa51e2d1ba/index.html) |
| `apps/admin/Documentation/js/main.js`, line 756 | [Duralux documentation script](https://duralux-next-doc.vercel.app/js/main.js), linked from the [vendor documentation](https://duralux-next-doc.vercel.app/index.html) |

This resolves their provenance as public sample values bundled in the template. Google
account ownership or revocation was not inspected, and no Git history was rewritten.
The local safe provenance records contain only source URLs, dates, compared length and
match booleans; they contain no key values.

The final backend fingerprint still matches the final HTTP run. `final-backend-status.json`
records that match and the final scoped secret-scan exit; whitespace checks also passed.

## Remaining release gates

Complete the verification dispositions above, select a reviewed fixed commit and pass full
CI. Then prepare the isolated trial DB, restricted runtime role, persisted closed-feature
flags and verified editorial calendar data. The retained upload quotas need a separate
aggregate storage/read/operation spending boundary; per-user counts do not establish one.
Free sleep/wake, maintenance triggers, public HTTPS auth/mail, private media, monitoring
and recovery remain hosted acceptance gates. `puhukoc.com` is the selected domain; prior
DNS/provider observations are in the launch audit and are not replaced by local tests.
