# Web browser security QA (2026-10-08)

## Verified result

Focused source hardening, not a full security audit. On the final isolated production build:

| Check | Result |
| --- | --- |
| Policy/proxy/header/registry unit checks | 19 passed (13 CSP, 3 headers, 3 legal) |
| CSP browser scenarios | 12 passed (6 scenarios x mobile/desktop) |
| Account security regression | 78 passed (39 scenarios x mobile/desktop) |
| Analytics consent | 4 passed (2 scenarios x mobile/desktop) |
| Limited/rewarded ad flows | 18 passed (9 scenarios x mobile/desktop) |
| Total distinct browser cases | 112 passed |
| Targeted ESLint / TypeScript | Passed |
| Entire web production build and its TypeScript stage | Passed with Next 16.3.8 webpack |

The final browser-security tests were strengthened and rerun after adding an actual
same-origin Referer probe and a parser-inserted same-origin script. Counts above are distinct
cases, not cumulative reruns. No tests were skipped in these final scoped browser runs.
Full workspace CI, default Turbopack build and production performance budgets were not run.

## Abuse and regression cases

- Forged incoming x-nonce/CSP headers cannot choose the framework/script nonce. Locale rewrite
  request overrides retain trusted headers; full reload generates a new 128-bit nonce.
- Production Chromium rejects inline script, a same-origin script without a nonce, an external
  script, inline onclick, string-to-code Function execution, a foreign iframe and fetch to
  https://attacker.invalid/exfiltrate. Interceptors receive no blocked attacker requests.
- A nonced bootstrap can compile a minimal WASM module while JavaScript eval stays blocked.
- TR/EN pages hydrate, theme bootstrap reads a synthetic preference, SPA navigation retains the
  document nonce, and the real Turnstile loader executes a stub provider script with that nonce.
- On /en/reset-password?token=qa-dummy-token, an actual same-origin fetch sends no Referer.
  This does not prove GA payload privacy: automatic Analytics URL collection remains a release check.
- HTML has private/no-store and CDN no-store headers; static /sw.js keeps base protections.
- Existing missing/expired/failed CAPTCHA, retry, quotas, invalid email, generic recovery,
  recent-login explanations, email mutation/tab invalidation, delete cancellation and safe
  Google return-target browser cases remain green with fake API responses.
- Existing consent and ad eligibility/retry/no-fill/timeouts remain green using synthetic providers.

## Regression fixed during QA

Legal routes retained generateStaticParams after the locale root became request-scoped.
Production legal-page loads returned 500/DYNAMIC_SERVER_USAGE. Removing obsolete static
parameter generation from public/settings legal routes fixed the browser reproduction.
Root revalidate=0 explicitly keeps HTML dynamic while allowing positive explicit data-fetch
caching. The FINAL-document placeholder guard now also executes in sitemap publication at
build time, independently of HTML prerendering. Its new unit test failed against the prior
publication function, then passed with the guard. The legal copy itself was not edited.

## Reproduction scope and isolation

Unit commands: vitest run src/lib/content-security-policy.spec.ts
src/lib/security-headers.spec.ts src/lib/legal.spec.ts --pool=forks --maxWorkers=1 --minWorkers=1.
Browser commands: playwright test browser-security.spec.ts analytics-consent.spec.ts;
playwright test account-security.spec.ts account-security-regression.spec.ts;
playwright test ads.spec.ts. Each used --workers=1, the existing two Chromium viewport projects
(375x812 and 1280x800), and the final production output on http://localhost:3101.

- Official local image mcr.microsoft.com/playwright:v1.61.1-noble, Node 24.17 / Chromium 149.
- Docker network none, read-only root/source/dependencies/runner; scratch-only writable tmpfs.
- 2 CPUs, 6 GiB memory, 256 PIDs, 256 MiB maximum single file, 3 GiB scratch. Scratch permits
  executable native compiler binaries but has nosuid; no privileged mode or added capabilities.
- 1200-second build bound, 180/300/600-second scoped test bounds, 7200-second container lifetime.
- Empty environment with only PATH, scratch HOME/TMPDIR, CI, NODE_ENV, telemetry disable flag,
  NEXT_PUBLIC_API_URL=http://localhost:3001/v1, NEXT_PUBLIC_SITE_URL=https://mentor.example,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY=qa-csp-placeholder-key, NEXT_PUBLIC_GA_MEASUREMENT_ID=G-QA0000000,
  NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/runner/font-mock.cjs, PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
  and PLAYWRIGHT_BASE_URL=http://localhost:3101 as needed for each process.
- Local installed dependencies were repackaged for Linux path/permission compatibility. No
  dependency installation, external provider access, developer env file, host home or real
  credentials were available. The font fetch was replaced with a cached local font; build
  worker count was bounded in the disposable config only. Type checks were not disabled.
- Webpack cache packs exceeded the per-file sandbox cap and emitted EFBIG warnings; compilation,
  type checking and final output still completed. This is not a production cache verification.
- Target-generated traces/screenshots/builds and copied dependencies are discarded with the
  task-owned scratch/container. This summary and authored test definitions are retained.

## Design hook review

Three pre-existing globals.css findings were assessed as contextual false positives: the
mascot's two-second idle bob is an explicit DESIGN.md exception (not bounce/elastic easing),
and the bounded desktop sidebar width/padding transitions intentionally preserve document
flow during collapse. All honor reduced motion. No CSS changed or hook ignore persisted.

## Pending release evidence

See docs/core/security-release-checklist.md: exact CDN/R2 origins, real Cloudflare/Render
headers/cache/bind behavior, real Maps/Street View and GPT compatibility without global JS
eval, actual Turnstile/Analytics/payment/OAuth acceptance, sensitive GA query privacy,
public SSR capacity/TTFB and full CI. Synthetic browser runs do not establish these facts.
