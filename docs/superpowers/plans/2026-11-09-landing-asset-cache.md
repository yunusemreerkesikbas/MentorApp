# Landing asset cache implementation plan

> Execute inline in the current session; the user approved package A and continuing implementation. Preserve unrelated working-tree changes. Work on `feat/landing-asset-cache`.

**Goal:** Reduce tab-icon transfer and repeated city-image origin validation without changing the landing experience.

**Spec:** `docs/plans/2026-11-09-landing-asset-cache-design.md`.

**Architecture:** Existing Next.js metadata and narrowly scoped response headers; native browser caching, no new dependencies. All localized documents keep request-scoped CSP and no-store.

## Tasks

- [x] Add focused browser regressions to `apps/web/e2e/landing-performance.spec.ts`: selected 64x64 PNG icon <=10 KiB, fourteen city-image cache responses, missing/unrelated asset exclusions and TR/EN document no-store. Observe failures before the corresponding implementation.
- [x] Generate the same artwork as a compact PNG, update `[locale]/layout.tsx` metadata, and measure the body-size reduction and rendered icon equivalence.
- [x] Add four-hour browser/shared-cache headers for the existing city assets in `apps/web/next.config.ts`. Verify production response behavior, then remeasure repeated browser fetches.
- [x] Correct stale static-rendering guidance in `docs/standards/frontend.md` and `docs/features/i18n.md`; append feature timeline entries and measurement results to `docs/features/web-shell.md` and this plan.
- [x] Run relevant browser/security checks, targeted lint and web typecheck; inspect the complete scoped diff. Record pre-existing failures separately. Do not deploy or claim production cache HIT verification.

## Review focus

Check favicon dimensions and rendered art, facade-mobile/missing filenames, WebP fallback, locale rewrites/RSC no-store, and stale-art replacement. No security policy changes and no broad asset-cache pattern.

## Validation, 2026-11-10

- RED: city cache test received `public, max-age=0`; favicon metadata test found `32x32`. Existing TR/EN HTML no-store check passed. GREEN: all six new viewport cases passed, including the final RSC no-store assertion.
- Isolated webpack production build passed with an HTTPS public site origin. Web `tsc --noEmit --incremental false` and targeted ESLint passed. An initial test-only HTTP site origin correctly failed the production HTTPS guard; configuration was corrected without weakening the guard.
- Production browser run of `landing-performance.spec.ts` and `landing.spec.ts`: 39 passed, three existing intentional device skips. Security/proxy unit checks: 28 passed. Node budget tests: five passed, including actual favicon bytes/dimensions.
- Independent scoped review found no actionable issues. No source logic changed after review; subsequent edits added RSC/asset regression assertions and validation notes.
- Existing budget CLI still rejects webpack's client-reference manifest schema, as already documented by the previous landing performance work. The CI Turbopack profile remains the route-JS budget gate; no whole-workspace or hosted-CI green claim is made. The new icon budget passed independently in Node/browser checks.
- Restored only the temporary QA type include paths that Next added; preserved pre-existing working-tree edits. No deployment or Cloudflare dashboard change.

## Experiment ledger

| Experiment | Baseline to result | Verdict |
| --- | --- | --- |
| Same-art 64px tab icon | Raw body 133816 to 8251 bytes (-93.8%); transferred bytes 101123 to 8551 (-91.5%). Three isolated requests per asset on identical production server/browser/network/CPU settings: median duration 689 to 203.4 ms; baseline range 669.1–691.5, result 202.3–207.2 ms. | Kept; gain exceeds observed variation. Resource timing only, not page LCP. |
| City freshness | Origin header max-age=0 to explicit max-age/s-maxage=14400. Second same-URL browser fetch: zero network bytes; untouched room-image control still validated (300 bytes). | Kept; native browser reuse verified. Live Cloudflare HIT remains post-deployment acceptance. |

Evidence: `docs/qa/evidence/2026-11-10-landing-asset-cache.json`. No neutral or regressing optimization was retained.
