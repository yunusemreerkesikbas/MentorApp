# Platform release preflight

2026-10-29. Original checkout, existing `feature/APP-122`; baseline HEAD
`dd5e6746409e708460df03f69aae8becd70b1211`. The owner confirmed landing-page work is still
in progress and requested infrastructure-only continuation. No branch/worktree, commit,
push, service, plan, credential upload, deployment, mail or DNS change was made here.

This is a **local platform preflight**, not exact-commit full CI or release approval.
Web build, browser checks and performance budgets await the completed landing work.
Notebook-quota edits also started in API/admin/shared contracts during this run, and HEAD
moved externally to `e2e9bd73`. The earlier check results are observations at their execution
time, not validation of the current moving source tree. Those owner changes were preserved.
Local Node is 22.14.0 and pnpm is 11.1.1; this does not verify the deployment's pinned
Node 22.22.0 runtime or a clean Linux CI installation.

## Completed checks

| Check | Result | Scope and limitation |
| --- | --- | --- |
| Production dependency audit | Exit 0 at the existing high-severity threshold | 0 critical / 0 high; metadata still reports 4 moderate / 2 low. Existing workspace audit exceptions were preserved. |
| Deployment configuration | Passed | Validates the retained optional paid `render.yaml`, not a Free deployment or live billing settings. |
| Platform lint/typecheck and prerequisite builds | 17/17 tasks successful | API, admin and shared packages; 13 content-cache hits and 4 executed tasks. Web excluded. |
| API/admin production builds and dependencies | 5/5 tasks successful | All five executed, no cache hits. Local build only; no app started or deployed. |
| Broad API test command | Not completed | Hit the runner's 20-minute limit; source fingerprints changed concurrently. No final suite summary or full-API success claim. |

The API runner owns only `mentor_release_1793284853995_test` on existing local PostgreSQL.
It preserves `mentor`, `mentor_test`, the earlier queue test database and Neon. Tests use
fake AI/vision/storage/payments, disabled SMS, no Resend/VAPID/Turnstile sending credentials,
and a test-process-only TCP guard that rejects non-loopback destinations. The guard was
self-checked before the run. No production source was changed in this preflight.
The runner records API/shared-source fingerprints before and after execution; a moving
source tree cannot be treated as a verified snapshot. Its helpers/logs are ignored local
evidence under `.artifacts/deployment/free-first/release-*`.

## Queue test-isolation regression

The broad run reported three failures in `job-interruption.e2e-spec.ts`: its pending fixture
was not completed, expected retry count stayed zero, and the blocked-handler test never
started. A read-only query in the disposable database found other suites' pending email,
embedding, payment and storage jobs. The production runner correctly consumes the global
queue; the fixture assumed it contained only its own jobs.

The same nine tests were rerun alone against that dirty test database and reproduced the
same three failures. The fixture now clears `jobs` once in `beforeAll`, after its existing
explicit `_test` URL guard, with per-test cleanup retained. The test configuration already
serializes files. This removes inter-suite residue without modifying claim/recovery/retry
behavior. This cleanup is for the dedicated test database only, never a production procedure.

The initial related-suite recheck picked up the developer's local `ADS_LOCAL_TEST_ENABLED`
setting and failed environment validation before the legacy notification suite could boot;
this is a harness issue, not a production bypass. Its rerun explicitly pins the CI-safe
environment with that setting false. Final focused results are recorded below.

**Final focused verification: 17/17 tests across four files passed**, including all nine
interrupted-job cases, legacy queue delivery, daily reminder idempotency and the real
PostgreSQL role check. Touched-file ESLint passed. Evidence:
`release-queue-isolation-{red,green,lint}.log` and `release-queue-diagnostic.json` in the local
evidence directory. The RED reproduction and GREEN run used the same disposable database.
No full-suite success is inferred from this correction; rerun exact-commit CI after the
owner's API/shared-contract and landing changes settle. The local test database is retained
for reproducibility; all test processes have completed.

## Public DNS snapshot

Public resolver 1.1.1.1 returned:

| Name | Query | Result |
| --- | --- | --- |
| `puhukoc.com` | A / AAAA | ENODATA for both |
| `api.puhukoc.com` | A | ENOTFOUND |
| `admin.puhukoc.com` | A | ENOTFOUND |
| `media.puhukoc.com` | A | ENOTFOUND |
| `puhukoc.com` | NS | `brian.ns.cloudflare.com`, `serena.ns.cloudflare.com` |

The domain uses Cloudflare DNS, but these application hostnames have no public service
address yet. This does not invalidate the separately verified mail records/domain ownership.
The first query was not executed because automatic approval review temporarily exhausted
its usage window. It succeeded through the same approval flow after the stated reset time;
no review check was bypassed. No DNS record was changed.

## Additional Free web acceptance case

Current [Render Free documentation](https://render.com/docs/free) says sleeping Free web
services answer `/robots.txt` with **disallow all** without waking the service. Active
services route that request to the application normally. Consequently, successful auth
after waking does not establish dependable public crawling, SEO or AdSense readiness.

In the attended rehearsal, let the web service actually sleep, fetch `/robots.txt` before
opening any other page, and record body/status through the intended domain and Cloudflare.
Then wake it and compare. Do not add keep-alive traffic, paid upgrades or permissive cache
rules as an unreviewed workaround. Keep ads off until the public-site acceptance passes.

## Remaining release gates

- Complete web work, select the reviewed release commit, and run full CI, secret scanning,
  performance budgets and browser security checks on that exact commit.
- Preserve the owner's refusal of Access card/overage terms and the existing production
  Access guards. Admin publication is still blocked by the unresolved acceptable Access setup.
- The owner retains first-release uploads and owns the notebook quota implementation.
  Per-user counts alone do not bound total storage/read operations or the shared R2 invoice;
  the spending-control gate remains open. No upload feature or quota was changed here.
- Prepare isolated rehearsal roles/secrets and recovery acceptance; never promote local
  acceptance credentials or archived staging data without the required scoped authorization.
- Verify Free cold auth/recovery, queue interruption/quarantine, scheduled maintenance,
  aggregate Render/Neon quotas, actual exhaustion behavior and public-HTTPS mail receipt.

See [free-first evidence](2026-10-28-free-first-launch.md),
[external migrations](2026-10-29-free-hosting-preparation.md),
[queue recovery](2026-10-29-queue-recovery.md) and
[storage/Sentry acceptance](2026-10-29-storage-monitoring-preflight.md).
