# Web probe isolation and request-scoped availability

Approved scope: stop web liveness checks from rendering the landing and deduplicate availability reads within one server render. Preserve the existing UI, dynamic CSP, fresh feature flags and fail-closed handling. No cross-request TTL, new dependency, API business endpoint, or change to API/database readiness.

- `/healthz` is an infrastructure-only HTTP 204 response with an empty body and no-store. Exclude exactly this path from the locale/document proxy. Other similarly named paths remain protected. It proves the web HTTP process responds; the NestJS readiness endpoint continues checking API/database health independently.
- Place React `cache()` on the shared availability reader, and re-export that exact function for landing sections. Preserve validation, timeout, no-store fetch and null on failure. Root layout and sections share one snapshot; the next document reads again.
- Configure the web Blueprint and deployment guard to use `/healthz`. Existing Render services must be updated separately, only after the new endpoint has been deployed and verified externally.
- Check zero API reads for repeated probes, one availability read per SSR document, and immediate observation of changed flags on the next document. Verify locale/CSP regressions and run the relevant tests/lint/types before release.

Operational baseline: Render web health path `/`; live API logs repeatedly show two availability reads and one coach-signup status read at roughly five-second intervals. This explains a recurring request mechanism, not all monthly bandwidth. API response-size attribution remains separate work; do not claim that this change eliminates the entire 3.89 GB.

## Implementation and verification

- [x] Add health-handler and exact proxy-exclusion regression tests; observe failure before implementation.
- [x] Implement infrastructure-only handler and share the existing validated reader without changing failure handling.
- [x] Update Blueprint, deployment guard and feature/runbook documentation.
- [x] Run 33 targeted unit checks, targeted ESLint and deployment configuration guard.
- [x] Compare the original and fixed readers on the same isolated Next SSR server: two availability fetches become one. Separate documents still fetch again; closing economy in the fixture immediately removes the next document's journey section.
- [x] Repeat 20 HTTP health probes against that server: zero API reads, empty 204/no-store responses.
- [x] Verify final production build and HTTP delivery regressions before release: webpack build passed; all 14 mobile/desktop health and landing delivery checks passed.

The local fixture uses no accounts, production data, or external providers. It counts actual SSR fetches rather than mocking React cache behavior. Retained the minimal changes because request-count reduction is deterministic; no whole-page LCP or monthly GB reduction is claimed. Existing Render settings must not point to an unavailable endpoint.
