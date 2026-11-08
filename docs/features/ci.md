# CI — Scoped Pull Requests and Full Release Validation

CI checks changes automatically before they are merged. It does not deploy production services.

## Execution policy

| Change / event | Verification |
|---|---|
| Local development or branch/master push | No automatic CI run |
| Draft PR targeting `master` | Wait until ready for review |
| Documentation, marketing or design-only PR | Scope-policy tests and secret scan; no application build/tests |
| Ordinary web or admin PR | Affected application/dependency lint, typecheck, build and unit tests |
| Ordinary API PR | API/dependency static checks, dependency unit tests and `@mentor/api test:unit` |
| Auth, payment, ledger, AI/mentorship trust, database, shared-contract, dependency or CI-policy changes | Full CI profile |
| Unknown code/configuration path | Full CI profile |
| Manual `CI` workflow dispatch | Full CI profile for the selected ref |

Every code PR retains the production dependency audit and deployment-configuration check. New commits cancel obsolete runs of the same PR. No duplicate push or post-merge run is started. Manual release runs have independent concurrency groups.

## Usage

1. Create a development branch from `master` and open a normal PR targeting `master`, as before.
2. Read **Select verification scope** in the Actions summary to see whether the run is scoped or full.
3. Require the existing **lint · typecheck · build · test** check to pass before merging. Its final gate fails when selection, secret scanning or selected checks fail, including when a downstream job was skipped because selection failed.
4. Before production deployment, open **Actions → CI → Run workflow**, choose the release ref (normally `master`) and wait for full validation. CLI equivalent: `gh workflow run ci.yml --ref master`.
5. Confirm the successful run covers the deployed code tree. A scoped green run is insufficient for release; an already-successful full run can be reused when the merge changes only commit identity and the Git tree is identical.

## Full profile and gotchas

Full mode retains the workspace checks, API database integration tests, ordinary mobile/desktop browser regression, CAPTCHA checks, core-trial checks, bounded-media checks and invite-only waitlist/auth-layout checks. Live-provider tests stay opt-in; this workflow does not call paid production providers.

The manual **Run workflow** button becomes available after the updated workflow is on the default branch, as required by [GitHub's workflow-dispatch rules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch).

Existing development branches should incorporate the updated `master` before their next push; otherwise they may still contain the old push-triggered workflow. New branches created from the updated `master` inherit the new policy.

The selector uses both sides of the PR diff, disables rename collapsing, and handles filenames as NUL-delimited data. A failed/invalid diff fails selection rather than silently selecting no tests. Unknown paths fall back to full coverage. Root tooling and CI policy edits are intentionally full-mode changes.

Normal PRs do not launch Postgres or browser servers. The admin package currently has no unit-test task; its static/build checks and dependency unit tasks still run. Existing browser tests are retained unchanged rather than deleted or disabled. Full validation can still take about an hour; ordinary PR duration must be measured after rollout, not assumed.

## Geliştirmeler (timeline)

- **2026-11-08 — Manual release history scan baseline:** Reviewed the nine additional findings exposed by a full-history manual secret scan: dummy test constants, a browser storage identifier, an environment variable name, and historical Duralux documentation examples absent from the release tree. Recorded only their exact historical fingerprints in `.gitleaksignore`. New occurrences, changed commits and all other files/rules remain scanned; the secret gate still fails closed. Run the manual full profile before deployment as usual. Related files: `.gitleaksignore`.

- **2026-11-08 — Selective PR CI:** Replaced duplicate push/PR runs with scoped checks on ready PRs, cancellation of outdated PR runs and manual full release validation. Sensitive/unknown paths retain full coverage, and the existing required check name now aggregates selection and execution results. Policy tests and execution of the real result-gate shell guard missing, failed and cancelled outputs. Related files: `.github/workflows/ci.yml`, `scripts/ci-scope{,.spec}.mts`, `scripts/ci-workflow.spec.mts`, `AGENTS.md`, `docs/standards/code-review.md`.
