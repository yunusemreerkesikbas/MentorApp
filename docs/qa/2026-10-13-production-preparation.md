# Production source preparation evidence (2026-10-13)

Scope: PR #156 prepares production source and records deferred staging. It does not certify a
live environment. No provisioning, paid upgrade, DNS mutation, production DB access or merge
was performed. Parallel mentorship changes in the shared checkout are excluded from the PR.

## Targeted verification

- `pnpm check:deployment`: passed; production-only Blueprint, exact app/dependency builds,
  manual deploy gates, first-level domains/CORS, owner/runtime URL requirements, cron references,
  port-aware frontend starts and Turbo build inputs checked.
- Web: 6 tests passed across production indexing, metadata routes and security headers.
  Production sitemap entries use `https://puhukoc.com`; robots advertises its sitemap.
- API: 22 tests passed across Access guard (10), runtime-role unit tests (11) and actual
  PostgreSQL catalog-query regression (1). The real test owner/superuser is rejected with the
  intended safety error, not a SQL syntax error. Tests use the local `_test` DB, not Neon.
- Unfinished staging tests and their corresponding indexing branches are removed; existing
  production Access/env validation is preserved. No API endpoint or migration was added.
- The archived local staging patch parses successfully with `git apply --stat` (7 owned files).
  `.env.staging` and the patch are Git-ignored; no secret env file is part of the archive.
- Retained Neon endpoint read returned `idle`; both EU staging R2 buckets remain present.
  Public bucket: 0 objects / 0 B. Private usage is not reported by the dashboard.
- `.gitleaksignore` retains only the three previously approved historical fingerprints.
- Targeted ESLint passed for touched web config/metadata/indexing/header files. The actual admin
  Next config's header function was loaded and its global noindex rule asserted successfully.
- Prior CI exposed a plan browser fixture using the runner's local weekday while the wizard
  uses Istanbul dates. The fixture now uses its existing Istanbul-date helper plus UTC weekday
  extraction; no application behavior or unrelated mentorship files changed.

## Final revision acceptance

The authoritative exact-head full results are the [PR #156 checks](https://github.com/yunusemreerkesikbas/MentorApp/pull/156/checks)
and its updated PR description. Before presenting the PR as ready for review, require successful
lint, typecheck, builds/performance budgets, application tests, browser smoke/CAPTCHA checks,
production dependency audit and secret scan. A passing older staging revision is insufficient.
Targeted local checks alone are not a claim that the whole workspace or production is ready.

## Remaining release gates

Production provider keys (including missing Gemini), Postmark domain/sender verification,
acceptable Cloudflare Access activation without unapproved overage billing, DNS/TLS, approved
hosting/provider budget, restore/rollback and real-provider/browser evidence remain outstanding.
Support/legal contact stays `info@mentor.com`. See [the runbook](../core/deployment.md) and
[deferred resource inventory](../core/deferred-staging.md).
