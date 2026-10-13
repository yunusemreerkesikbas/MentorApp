# Blog ads: performance and release verification

Completed: 2026-10-10. Scope agreed with the product owner: restore dashboard performance budgets,
then run the repository's full CI checks locally. Production advertising remains disabled.

## Measured fix

`AppShell` statically imports the notebook contents cache for sign-out cleanup. The cache's
static notebook-client import pulled the upload constants, validation barrel and Zod into the
dashboard's initial bundle even though that route never requests notebook contents. Moving
the notebook-client import into `prefetchNotebookContents` removes that initial dependency.
The desk/editor still requests contents before opening. No budget threshold was raised.

| Uncompressed JS metric | Before | After | Existing limit |
| --- | ---: | ---: | ---: |
| Dashboard route chunks | 843.3 KiB | 739.3 KiB | 760 KiB |
| Dashboard total | 1382.7 KiB | 1278.7 KiB | 1295 KiB |
| Article total | 970.3 KiB | 970.3 KiB | 985 KiB |

All eight budget gates pass. This measures build artifacts, not real-user Web Vitals.
The final measurements include the mobile theme hit-area fix and CI GA4/VAPID configuration.
The separate CAPTCHA-enabled build retains the same values and passes all eight gates.
The article has limited remaining headroom. Four cache tests and an independent review
cover deduplication, retry and account-change cleanup; no regression was found.

## Additional CI findings

- Updated `proxy-addr` to 2.0.8, `source-map-js` to 1.2.2 and all `sharp` resolutions to 0.35.5
  after the production audit reported one critical and two high findings. Frozen offline
  installation and the high-severity audit pass. Two moderate findings and the existing
  documented development-only `braces` exception remain; the audit is not vulnerability-free.
- The proxy unit fixture expected a nonexistent `public/images` namespace. Corrected it to
  the actual `public/img` namespace and added `/ads.txt` to the real matcher checks. Dotted
  page protection stays unchanged. All 978 web unit tests pass.
- Gitleaks found no secrets in the current CI commit range, added diff lines or newly created source files.
  A broader scan of all 424 historical commits also reported test-fixture false positives
  and Google keys in vendor documentation demos. The four current demo occurrences were
  replaced with explicit placeholders; history was not rewritten and key validity/ownership
  was not checked. Any owner of a valid historical key must revoke it through the provider.
  A raw diff scan still reports the four removed demo keys because it includes deleted lines.
  A current changed-file content scan reports the existing `R2_PRIVATE_BUCKET` configuration
  name as a generic-key false positive; it is a registry name with `sync: false`, not a secret.

## Repairs verified during CI

- Zero-gap auth quota admission incorrectly treated transaction-start time as a send gap.
  Rewarded-ad retries could miss a concurrent idempotent session creation. Minimal fixes
  have deterministic regression tests; positive send gaps and quotas remain enforced.
- Notebook fixes keep the mobile theme hit area within the header and hide the single-card
  preview while its editor is open. Saved writing stays in the preview; missing taxonomy
  keeps reading available without exposing an unusable editor.
- Payment, panel, community and coach browser fixtures now match the existing UI and the
  approved automatic-trial flow. Assertions for entitlement, price, accessibility and lifecycle
  remain. API AI/email fixtures match the existing service signatures; ads expiry checks its
  own session's reservation release rather than assuming an empty global test database.
- Auth setup measured 53.706 seconds and rate setup 78.579 seconds under diagnostic load.
  Only those suites' `beforeAll` hooks use the existing 90-second integration convention.
  Global hook/assertion limits stay at 30/15 seconds. Diagnostic timers were removed.
- Plan tests now distinguish legacy UTC-day CRUD/summary fixtures from Istanbul-day plan
  adaptation fixtures. All 29 passed while the dates differed. Production date policy is
  unchanged; it remains documented in `date.util.ts` and `features/coaching.md`.

## Final local validation

| Check | Final result |
| --- | --- |
| Workspace lint | 13 tasks passed; existing warnings remain |
| Workspace typecheck | 13 tasks passed; API checked again after the fixture repair |
| Workspace build | 8 tasks passed with updated dependencies |
| Web performance budgets | 8 gates passed on ordinary and CAPTCHA-enabled builds |
| Full serial workspace tests | 7 tasks passed, exit 0, 17m8.165s; 5 unchanged build tasks cached |
| API tests | 359 files, 3202 tests passed; zero failed/skipped |
| Web tests | 151 files, 978 Vitest tests and 7 Node script tests passed; zero failed/skipped |
| Full mobile/desktop browsers | 984 passed, 122 skipped, zero failed/flaky; 27.7 minutes, exit 0 |
| Separate CAPTCHA/security browsers | 90 passed; 1.7 minutes, exit 0 |
| Frozen offline installation / production audit | Passed; remaining audit findings described above |
| Secret checks / whitespace diff | Passed for the CI range, added lines and new source files |

The full workspace test run passed **4187** tests (4180 Vitest + 7 Node). Both API and web
test tasks executed without cached test results; API integration used the isolated `mentor_test` database.
Browser skips cover viewport-specific cases, separately enabled CAPTCHA checks and opt-in
real-provider/API QA. The CAPTCHA phase stubs provider responses. These results do not establish
live Turnstile/Google provider behavior or opt-in external QA environments.

Hosted GitHub Actions has not run for this uncommitted working tree. Local Windows checks cannot
establish a hosted Linux run or a real staging deployment. Production advertising was not enabled.

## External rollout gates

`puhukoc.com` has not yet been purchased. Google account selection, domain/site approval,
Ad Manager demand linkage, real seller ID, privacy review, official staging inventory and real
production impression/revenue evidence are still pending. A stubbed browser test is not Google
fill or revenue proof. Follow `docs/core/integrations.md` before changing production flags.
