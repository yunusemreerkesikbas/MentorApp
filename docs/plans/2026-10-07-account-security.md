# Pre-release account security implementation

Approved scope: authenticated Cloudflare origin and client IP, exact auth POST origins,
durable HMAC-keyed Postgres auth counters, login/forgot-password Turnstile, Cloudflare
Access on admin auth, recent authentication for email change/self-deletion, and atomic
email/token/session invalidation. Existing `/v1` routes and success contracts remain.

## Execution ledger

1. Complete: identity backend, durable counters, shared validation, forward migration and tests.
2. Complete: pre-parser edge boundary, CSRF, admin Access, environment/release settings.
3. Complete: web Turnstile, explicit reauthentication flows and generated auth API contracts.
4. Complete: focused isolated verification, independent source reviews and feature documentation.

## Verification

- 234 relevant tests passed: 173 API unit tests, 33 HTTP lifecycle/quota/erasure tests,
  10 Postgres security tests (including independent processes), and 18 web logic tests.
- API and web typechecks passed; API and shared-package/client builds passed. Changed-file
  API/web lint returned no errors; existing exporter/Google navigation warnings remain.
- The full server OpenAPI export succeeded and both auth schemas match the generated client
  input. An unrelated pre-existing mentorship brief-history contract difference was preserved.
- All 18 browser scenarios load successfully. Browser execution was not performed locally
  because the isolated environment has no browser runtime; CI builds with a dummy Turnstile
  site key and executes the provider-stubbed security scenarios separately.
- Full workspace CI, dependency/secret scans and actual Cloudflare/Render evidence remain
  release gates. This checkout has not been committed, pushed or deployed.

## Implementation rulings

- Use the existing feature checkout. Preserve the pre-existing locale edits and concurrent
  forum/community work. No commits, branch changes or deployment.
- One implementer owns identity. Shared/platform files have a separate owner; no concurrent
  edits to the same files. Reuse existing services and dependencies.
- Execute target code only in a network-isolated, resource-limited container with dummy
  environment values and scratch writes. Real Cloudflare/Render checks remain a release gate.
- Changes to production configuration are source changes only. Cloudflare must overwrite the
  origin-secret header and require MFA for the admin Access application before release.
