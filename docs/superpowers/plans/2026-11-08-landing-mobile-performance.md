# Landing mobile performance implementation plan

**Goal:** Reduce mobile cold-load work without changing the landing composition or signup policy.

**Approved approach:** Defer below-fold media and provide smaller mobile city backgrounds. Preserve the detailed facade for camera close-ups, existing desktop images, no-JavaScript first paint, reduced motion, and AVIF/WebP support. Do not change availability/security caching or hosting plans.

**Architecture:** Native picture sources select 1024px background variants below 768px. The existing motion viewport hook gates the coin player; native lazy loading gates below-fold stills. No new dependencies.

**Verification:** Browser request assertions cover mobile/desktop source selection, absent below-fold requests on entry, animation activation on approach, reduced motion and no-JavaScript artwork. Existing landing camera tests guard geometry. Run web lint/typecheck/build and relevant browser tests before preparing a PR.

- [x] Add browser regression checks and observe failure on current code (eager chest, coin JSON and player WASM requests).
- [x] Generate reproducible mobile background variants using the installed sharp package; add media sources and viewport-gated coin rendering.
- [x] Verify browser behavior and compare transferred city bytes; review screenshots at the opening and zoomed window.
- [x] Document results and limitations in web-shell feature timeline; prepare an independent PR.

Validation: production webpack build passed; web TypeScript and targeted ESLint passed; 1,149 Vitest and 8 Node tests passed. Production browser checks: 15 passed, 1 intentional skip (desktop-only doorbell on mobile). Six performance cases passed on both development and production outputs. Independent review found no actionable issues. Mobile AVIF city transfer drops 15.5%; request capture confirms no opening coin player/chest download.

Local build uses webpack because existing workspace dependency junctions point outside Turbopack's root. The existing bundle-budget script rejects webpack's client manifest schema, so the standard Turbopack budget remains a hosted-CI check. An initial development-mode full landing run hit route compilation/hydration timeouts; the affected camera/first-paint interactions were rerun successfully against production. No live speed claim or deployment is made from local tests.

Render Free can sleep after 15 idle minutes, with roughly one minute startup. Repository configuration keeps web/API paid, but the current pilot service plan is unverified. Warm live measurements showed city download contention, so hosting cold starts and this fix are separate issues.
