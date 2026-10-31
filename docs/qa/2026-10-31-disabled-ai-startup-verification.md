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

Ignored evidence: `.artifacts/deployment/disabled-ai-20261030/` and this plan's
`.superpowers/sdd/2026-10-30-disabled-ai-startup/` ledger.

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
Integration still requires full CI on the new exact candidate; the prior successful CI
run does not certify this code. The original owner branch/index/working edits remain intact.
The optional paid Blueprint remains the existing real-provider alternative, not this trial.
No schema, dependency or frontend change is required. No real AI call or email was sent.
Hosted cold starts, provider/media/mail/monitoring acceptance, recovery and final
publication approval remain in the [hosting record](2026-10-30-core-trial-ci-and-hosting.md).
