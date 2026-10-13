# Web browser security package

## Implemented design

One enforced nonce-based script policy covers all localized web documents, including public
pages because the shared AuthProvider refreshes sessions there. The root layout reads the
trusted request nonce and renders dynamically with root revalidate=0. Obsolete legal-page
static parameter generation is removed; sitemap publication retains the FINAL placeholder
build guard. Public HTML loses static/CDN cache benefits;
data fetch caches and static asset caching remain independent. Measure TTFB and Render load
before release. No public/private navigation wrappers or new dependencies were added.

The proxy generates 128-bit random nonces, overwrites visitor nonce/CSP headers, and passes
those headers through the real next-intl rewrite. Next uses the request CSP to authorize its
framework scripts. Theme/sidebar bootstraps, structured data, consent-gated Analytics and
Turnstile/GPT loaders receive nonces. Dynamic loaders use the current document nonce rather
than the nonce on a later RSC response. Prefetch requests remain covered; dotted page slugs
are protected and only explicit static/infrastructure namespaces bypass the proxy.

Production script policy has neither unsafe-inline nor JavaScript unsafe-eval. A separate
wasm-unsafe-eval permission preserves existing DotLottie animations; only the LottieFiles
package namespaces on its two existing WASM CDN sources are permitted for fetch. Development permits
unsafe-eval for the Next development runtime. Inline script attributes, plugins, foreign form
submissions, framing and base-tag overrides are denied. Existing React/provider inline CSS
is deliberately retained; this is script hardening, not strict CSS isolation. GPT is forced
into SafeFrame. Vendor resource families are restricted to existing integrations, never a
blanket HTTPS connect-src. There is no new reporting service or report-uri containing tokens.

## Configuration and headers

- NEXT_PUBLIC_API_URL is mandatory in production. Its parsed origin permits HTTPS, or an
  explicitly configured HTTP loopback for CI. Development alone defaults to localhost:3001.
- WEB_CSP_STORAGE_ORIGINS is a runtime, comma-separated exact origin list for the public
  media CDN and signed R2 PUT/GET endpoints. Include the jurisdiction-specific endpoint
  (e.g. https://ACCOUNT.eu.r2.cloudflarestorage.com), plus the public custom domain. No
  credentials, paths, queries, fragments, wildcard origins or header separators. Empty
  allows only same-origin/API media. Do not paste presigned URLs or credentials here.
- HTML uses private/no-store plus generic and Cloudflare CDN no-store headers. Never apply
  an edge Cache Everything override to these documents. Every full load needs a fresh nonce.
- Global DENY framing, nosniff, restricted device permissions, production host-only HSTS and
  disabled X-Powered-By remain. Token-bearing and localized reset/verification documents
  use no-referrer. Other responses use strict-origin-when-cross-origin for existing services.
- Referrer controls do not sanitize Analytics payloads. Existing GA automatic URL collection
  must be checked for sensitive query values separately; do not claim token privacy from CSP.

## Verification

Targeted policy/proxy tests cover nonce spoofing, real locale rewrite request overrides,
randomness/renewal, prefetch, dotted routes, invalid storage/API configuration, production vs
local eval and mandatory deployment settings. Browser scenarios exercise TR/EN hydration,
nonce renewal, parser-injected scripts/handlers/frames, blocked exfiltration, theme bootstrap,
SPA navigation, token referrer policy, static headers and the real Turnstile loader with a
synthetic provider. Account security regressions remain part of the dedicated CI build.

All target execution uses a bounded Docker container with no network, read-only safe source
and local dependencies, scratch-only writes and an empty dummy environment. No .env files,
production secrets or live provider calls are available. 19 unit checks, 112 distinct browser cases, targeted
quality checks and the isolated webpack production build passed; see the QA record. Full CI and real Cloudflare/Render/provider acceptance
remain release gates. Maps and GPT documentation include eval in their examples; absence of
production unsafe-eval here is intentional, but provider compatibility is not proven by mocks.

Related: apps/web/src/proxy.ts, src/lib/content-security-policy.ts, [locale]/layout.tsx,
src/lib/analytics-consent.tsx, src/lib/turnstile.ts, src/lib/google-publisher-tag.ts,
e2e/browser-security.spec.ts, .env.example, render.yaml, .github/workflows/ci.yml.

References: [Next.js CSP](https://nextjs.org/docs/app/guides/content-security-policy),
[Turnstile CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/),
[Maps CSP](https://developers.google.com/maps/documentation/javascript/content-security-policy),
[GPT CSP](https://developers.google.com/publisher-tag/guides/content-security-policy).


QA record: [Web browser security QA](./2026-10-08-web-browser-security-qa.md).
