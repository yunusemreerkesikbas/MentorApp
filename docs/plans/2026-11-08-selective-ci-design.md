# Selective CI

## Approved direction

Approved on 2026-11-08: ordinary PRs use application-scoped static checks and unit tests; broad browser/integration coverage runs for sensitive changes and before release.

Keep the tests; stop running the entire product suite for every push. Automatic CI runs on ready pull requests targeting `master`, without a duplicate branch-push or post-merge run. New commits cancel obsolete PR runs. Documentation, marketing and design-only changes receive lightweight policy/secret checks without application builds or database services.

Normal code PRs lint, typecheck, build and unit-test affected applications and their dependencies. Ordinary API changes use the existing `test:unit` runner without a database. Sensitive auth, payment, ledger, database, shared-contract, dependency and CI-policy changes retain full validation. Unknown executable/configuration paths fail toward full coverage.

The existing full CI profile remains available through a manual workflow dispatch before release. It includes the full ordinary browser suite and the existing CAPTCHA, core-trial, bounded-media and waitlist checks. Live-provider tests remain opt-in. This replaces the previous requirement to run every suite for every ordinary PR; it does not permit merging red checks or releasing without full validation of the exact code tree.

## Implementation and validation

1. Test path classification, including docs-only, UI, API, admin, sensitive changes, deleted/renamed paths, unknown paths and manual full validation.
2. Add a dependency-free TypeScript selector and wire scoped checks into the existing workflow. Preserve the required check name with an always-running result gate so selection errors cannot look green.
3. Preserve existing browser/integration tests unchanged and run them only in full mode. Ordinary PRs do not start browser servers or Postgres.
4. Update engineering/release policy and add usage documentation.
5. Run selector tests, validate workflow syntax, inspect resolved package selection and review the final diff. CI policy changes themselves use full validation.

## Operational constraints

No production services, branch protections, provider credentials or repository settings change. No new dependency is needed. Draft PRs wait until ready for review. Manual release validation is not cancelled by an unrelated PR. A successful PR gate means the scoped checks passed; only a successful full run validates the entire CI profile.
