# Deployment preparation verification

Date: 2026-10-12. Scope: source preparation for `puhukoc.com` and `s1.puhukoc.com`.
No DNS change, provider provisioning, production migration or external deployment was performed.

| Check | Result | Evidence / scope |
|---|---|---|
| `pnpm check:deployment` | PASS | Script typecheck plus both Blueprints: domain/service isolation, environment names, cron references, migration/build setup, direct frontend closure and Turbo build inputs |
| API targeted unit tests | PASS, 85 tests | Env validation, edge-origin middleware, email routing/HTML safety, push endpoint security |
| Web targeted unit tests | PASS, 17 tests | Metadata routes, deployment indexing, security headers, site URL validation, canonical URLs; also exercised with `APP_ENV=staging` inherited |
| Web typecheck | PASS | `pnpm --filter @mentor/web typecheck` |
| Admin typecheck | PASS | `pnpm --filter @mentor/admin typecheck`; its build intentionally skips route-type validation for vendor demo pages |
| Touched-source lint | PASS | Web metadata/header/config files, API instrumentation/email/push files and deployment script |
| Production-mode app builds | PASS | `turbo run build --filter=@mentor/api --filter=@mentor/web --filter=@mentor/admin`, with staging URLs and `APP_ENV=staging`; 8/8 app/shared-package tasks succeeded |
| Compiled stage metadata | PASS | Generated `robots.txt` has `Disallow: /`; generated sitemap has no URL entries; web/admin response manifests contain the noindex header |
| Admin configuration | PASS | Loaded Next config applies noindex to `/:path*` |
| Diff whitespace check | PASS | `git diff --check` |

The admin build emitted existing vendor Sass deprecation warnings and the CSS `a::hover`
warning in untouched theme files. These remain visible and are not a warning-free-build claim.
The local Node 22.14 runner also emits its experimental TypeScript stripping warning; hosted Node
is pinned separately in the Blueprints.

Full CI, dependency/secret scans, API DB integration/e2e, live Cloudflare Access/CORS/TLS,
browser smoke tests, provider permissions/credentials, migrations with a restricted runtime role,
Postmark sender verification and actual environment isolation were not certified by these checks.
Keep production release gated until those checks are completed on the staging-tested commit.

Operational next steps: [deployment runbook](../core/deployment.md).
