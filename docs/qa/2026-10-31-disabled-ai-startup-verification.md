# Disabled AI startup verification

Implementation: 2026-10-30/31, Europe/Istanbul. The owner approved the written
[design](../plans/2026-10-30-disabled-ai-startup-design.md) and
[inline plan](../superpowers/plans/2026-10-30-disabled-ai-startup.md).
This extends the core-trial candidate `035f92171b81d47fc7d93763eacdd0cfb773db27`.
It is source/local verification, not hosted acceptance or publication.

## Result

`AI_PROVIDER=disabled` and `VISION_PROVIDER=disabled` select a credential-free closed
deployment, including production environment validation. Both must be selected together.
Real provider selections still require their keys; production fake-provider checks remain.
The new rejecting adapter is selected by the actual Nest module factories, without fake
responses, and refuses completion, lazy streaming, embedding and photo categorization.

The central registry returns effective `ai.enabled=false` for this deployment even when
the stored value or catalog default is true. The admin listing agrees. Attempting to
enable it fails before storage/events; false and unrelated configuration remain editable.
Existing availability/access policies consume this effective value. Reopening requires
a reviewed real-provider/key deployment, then the existing runtime/cost/privacy gates.

The ignored local trial runtime file now selects both disabled values and contains no AI
provider key or migration-owner connection. Its current-user-only Windows ACL is retained.
No remote credential, provider selection, DNS, billing or service was changed by this work.

## Verification

Ignored evidence: `.artifacts/deployment/disabled-ai-20261030/`, including the hash-verified
`sdd-evidence/` archive of this plan's execution ledger/review/task logs. Only this plan's
temporary `.superpowers/sdd/` workspace is removed after completion; sibling workspaces remain.

| Check | Result |
| --- | --- |
| Existing affected baseline | 101/101 |
| New disabled startup/pair behavior before implementation | 7 expected failures; valid real/unknown-provider cases stayed green |
| Actual Nest factory before wiring change | Selected fake for `disabled`; expected denial test failed |
| Provider/env/adapter task gate | 88/88, before splitting new env cases into a focused file |
| Disabled registry before implementation | 3 expected failures; 15 existing/adjacent cases passed |
| Registry/availability/provider gate | 38/38 |
| Final affected units | **210/210**, 16 files, `final-units.log` |
| Local real HTTP/Postgres | **6/6**, new startup smoke and existing core-trial boundary, repeated task gate passed |
| API typecheck and production build | Passed, `api-typecheck.log` / `api-build.log` |
| Targeted lint | Zero errors; the existing ignore policy leaves two Vitest config files unlinted, reported as warnings |

The HTTP run uses fresh loopback `mentor_disabled_ai_test`, synthetic users, test storage
and no AI credential. A deliberately stored `ai.enabled=true` cannot reopen access:
availability reports closed, own-account GET succeeds, photo access reports `AI_DISABLED`,
and direct chat, mock-photo classification and notebook prelabelling return 404 with that
code. Global fetch is a throwing spy and remained unused. Touched config rows (including
original absence) and modified environment values are restored in failure-safe teardown.
The production configuration contract is validated separately; test storage in this HTTP
fixture does not establish a real production provider startup or hosted browser result.

Source inspection found the existing global test cleanup connected before per-file
database safety checks. A shared test-only guard now runs before that connection and is
reused by the new fixture. Eleven unit cases accept loopback `_test` URLs and reject
remote/non-test targets and URL-query overrides without echoing credentials.
The first HTTP attempt correctly stopped on a developer-only local ad flag leaking into
the test environment. Both runners now pin that flag false; the production guard was not
relaxed. New disabled env cases were split into a small dedicated test file to keep the
existing environment test file within its original size.

## Review and release boundary

One fresh read-only review approved the 22-file candidate preview against `035f921`,
with no Critical, Important or Minor findings. No fix pass or deferred minor is needed.
The scoped candidate is **`1513a5bb12d30d557d415a6991d65224f5a7e9c2`**, pushed by fast-forward
on `feat/core-trial-release-20261030`. All 2,747 executable/config/test source files in scope
matched the accepted working source; the new-range secret scan found zero leaks.

[Full Linux CI 41131102949](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/41131102949)
**passed on that exact SHA**. Its job completed at 2026-10-30 22:15:33 UTC /
2026-10-31 01:15:33 Europe/Istanbul.

| Full CI check | Result |
| --- | --- |
| Dependency audit, deployment check and secret scan | Passed |
| Workspace lint, typecheck, builds and web performance budgets | Passed |
| API suites | **3,875 passed**, 405 files |
| Web suites | **1,099 passed**, 166 files, plus Node script checks |
| Ordinary browser suite | **1,276 passed**, 126 configured skips |
| Account security/CAPTCHA browsers | **90 passed** |
| Closed core-trial browsers | **20 passed** |

The configured ordinary-suite skips include viewport/feature/opt-in cases, not failed
tests hidden by this change. This CI uses fixture providers; live provider behavior remains
separate. The original owner branch/index/working edits remain intact. The final local
completion gate passed: candidate source, exact CI identity and all 210 affected units again.
The optional paid Blueprint remains the existing real-provider alternative, not this trial.
No schema, dependency or frontend change is required. No real AI call or email was sent.
Hosted cold starts, provider/media/mail/monitoring acceptance, recovery and final
publication approval remain in the [hosting record](2026-10-30-core-trial-ci-and-hosting.md).

## Execution decisions and their limits

1. Preserved the original checkout/index and used one scoped candidate commit after review.
   Intermediate task states therefore rely on retained test/ledger evidence, not separate commits.
2. Added the missing test-target guard before global cleanup. Remote, non-_test and URL-query
   override fixture targets are intentionally refused; production runtime behavior is unchanged.
3. Kept hosted startup/provider/recovery acceptance separate. Source/CI evidence cannot establish
   live availability, delivery or recovery, so admission remains gated on that evidence.
4. Required the new exact-commit full CI rather than the previous green run. This costs a full
   verification wait and reproducible failures would have blocked this candidate.
5. Relied on startup's validated paired provider invariant inside the registry/factories.
   Manually constructed services outside that startup contract do not independently enforce pairing.
6. Retained raw stored before-values in accepted config-write audit events. An audit may show
   before=true while effective AI availability was already false; denied enable emits no event.

No minor finding was deferred. These decisions are recorded in the execution evidence.

## Subsequent hosting preflight and next design

Read-only checks on 2026-10-31 confirmed Cloudflare's existing nine DNS records are mail-related;
root/www/API/media still have no web address. One p=none DMARC record remains. R2 Overview
shows 120.7 MB, 70 Class A, 4.08k Class B and USD 0 billable usage; its separate Billing rollup
shows 0.08 GB-months, 69 Class A, 3.48k Class B and USD 0 observed/projected cost. The existing
USD 10 alert was viewed, not changed, and is not a usage stop. No production bucket pair exists.
Management-only Neon reads show both retained staging and selected core-trial endpoints idle;
The last Render read showed zero services. No hosted SQL, credential upload, provisioning,
DNS or billing write occurred during this follow-up.

The owner declined extra staging cost/development, approved the
[aggregate storage design](../plans/2026-10-31-bounded-trial-storage-design.md) section by section,
and requested its [implementation plan](../superpowers/plans/2026-10-31-bounded-trial-storage.md).
That future storage code is not implemented or certified by this CI; plan review is still required.
