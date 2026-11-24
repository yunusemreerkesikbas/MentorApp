# Web Shell, Landing & B2C UI (`apps/web`)

> The `apps/web` marketing surface (`/` "Işıklı şehir", `/hosgeldin`, `/koclar`) and the
> authenticated application shell (`(app)/layout`, `AppNav`, shared modals, and cross-cutting UI).
> Design tokens & visual rules: [`DESIGN.md`](../../DESIGN.md). Voice: [`docs/copy/voice.md`](../copy/voice.md).

---

## 1. Overview & Architecture

`apps/web` runs on **Next.js 16 (App Router) + React 19 + Tailwind v4 + `next-intl` v4**, consuming
`@mentor/ui` primitives and `@mentor/api-client`.

- **Route Groups under `src/app/[locale]/`:**
  - **Public / Marketing:** `/` ("Işıklı şehir" landing), `/hosgeldin` (4-slide Puhu intro), `/koclar` (human coach landing), `/bilgi/[slug]` (SEO articles), `/davet/[code]` (friend invite landing), `/masaya-katil` (study room invite), `/bekleme-listesi` (invite-only waitlist).
  - **`(auth)`:** `/giris`, `/kayit`, `/sifremi-unuttum`, `/sifre-yenile`, `/eposta-dogrula`.
  - **`(app)` (Student Authenticated Shell):** `/panel`, `/plan`, `/seans`, `/defter`, `/analiz`, `/bilgi`, `/koc/sohbet`, `/topluluk/uyeler/panel`, `/kocum`, `/hedef`, `/profil`, `/abonelik`.
  - **`(coach)` (Human Coach Shell):** `/koc-paneli` roster, student reports, weekly reports, templates, and follow-ups (`--coach-accent` teal theme).
- **Server-First Availability (`GET /v1/app/availability`):** `landingAvailability` reads feature switches once per render (`aiCoach`, `economy`, `social`, `forum`, `studyRooms`, `humanCoaching`, `studentPurchases`, `studentSignup`, `invitations`) and hides disabled sections cleanly without client flicker.

---

## 2. Public Landing (`/` — "Işıklı Şehir")

The landing page combines atmospheric night-to-dawn art with **energetic, Duolingo-like Puhu copy**:

1. **Hero & Night City Stage (`#sehir`):**
   - Eyebrow lists all 5 supported exams: **`KPSS · YKS · LGS · ALES · DGS`**.
   - Hero headline: **`"Işığın yanıyorsa, yalnız değilsin."`** + live 24h study pulse (`/v1/coaching/public/pulse`) + sky-blue play-ledge CTA (`"Ücretsiz başla"`).
   - 3-layer parallax city (`city-far/mid/front.webp`) with interactive lit windows (`Career`, `Masa`, `Sabah`, `Plan` playing `puhu-hero-magic-loop.mp4`, `Topluluk`) and taped Caveat paper notes that bend in the breeze via `paper-flutter.ts` (`feDisplacementMap` SVG filter).
2. **Sabah Masası (`#sabah`):** Daylight desk walkthrough showing the daily plan, countdown data card, and Puhu's note.
3. **Odak Odası (`#odak`):** Interactive `/seans` room preview (`LIBRARY` / `CAFE` / `HOME` switcher, Pomodoro dial, shared `MASA-` study table, and ambient audio).
4. **Gece Yolculuğu (`#yolculuk`, shown when `economy` is on):** Quests card (`Ritüel` / `Haftalık` / `Hedefler`), 2-tab `journey-panel.tsx` (`Seviye` 12 lights `Kıvılcım`→`Zirve` + `Coin` wallet with spinning Lottie coin and unlock costs), and the interactive **Night Desk Weekly Chest** (`LandingChest` with 5 sequential `ChestLamps`).
5. **Premium Sheet (`#premium`, shown when `aiCoach && studentPurchases` are on):** Night skyline with flying masked Puhu (`puhu-premium-flight-loop.mp4`), 7 clear student benefits, and lamp-yellow `"7 gün ücretsiz dene"` ledge CTA.
6. **Human Coach Band & FAQ:** Direct link to `/koclar` and structured FAQ (`FAQPage` JSON-LD).
7. **Taped Paper Cookie Card:** Compact bottom-right paper note with play-ledge `Kabul et` / outline `Reddet` (gates Google Analytics consent).

---

## 3. Authenticated Shell & Identity Marks

- **Navigation (`AppNav`):**
  - Desktop (`>=1024px`): Left sidebar (`240px`) with `Logo` (`PuhuKoç`), Solar Linear → Solar Bold nav items (`nav.coach` = **"Puhu"**), `ThemeLamp` pull-cord theme switcher, notification bell (SSE), and user identity footer.
  - Mobile (`<1024px`): Fixed `63px + safe-area` bottom tab bar (`MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS`).
  - Prefix-safe active matching via `lib/nav-active.ts` (`isNavActive`).
- **Puhu Hero Mask (`PremiumIdentityMark` & `PuhuImage variant="premium"`):**
  - Premium users wear Puhu's starless night-blue domino mask (`#1E2A5A` / dark `#7E9BFF`, gold eye-rims at `>=20px`) next to their name in nav, profile, and community headers.
  - Whenever **Premium AI** speaks (weekly recap AI note, session-end AI reflection, Premium desktop coach FAB, `/koc/sohbet` empty landing, panel mood cloud via `public/mascot/puhu/motion/premium/`), Puhu wears the hero mask (`puhu-premium-hero.png`), overriding career outfits.
- **TopBanner (`/panel`):** Single-slot 3D cube-flipping banner coordinating active promotions (highest priority), daily quest nudges, and system announcements with per-item dismiss persistence.

---

## 4. Gotchas & Invariants

1. **AI Coach = "Puhu", Human Coach = "koç":** Never label the AI coach `"AI koç"` or plain `"koç"` in Turkish UI strings. Write **`Puhu`** and **`yapay zekâ`** (`"Puhu, yapay zekâ koçun"`, `"Puhu’yla planla"`). English keeps `"AI"`.
2. **Video & Lottie Hydration Safety:** Landing videos (`PlanMagicVideo`, `PremiumFlightVideo`, `LandingChest`) use `preload="none"`, play only when intersecting the viewport (`IntersectionObserver`), and check `prefers-reduced-motion` inside `useEffect` so SSR and initial client hydration always match.
3. **Never use `next/link` for internal routes:** Always import `Link`, `useRouter`, and `usePathname` from `@/i18n/navigation` so locale prefixes (`/en/...`) and localized pathnames (`i18n/routing.ts`) stay intact.
4. **Landing JS Budget:** Keep `/` client bundle under `400 KiB` (lazy-load Lottie players via `next/dynamic`).

---

## 5. Geliştirmeler (Condensed Milestone Timeline)

- **2026-11-21 SEO sayfaları · Landing'in odası.** The six public SEO pages (`/pomodoro-sayac`, `/yks-calisma-programi`, `/tyt-calisma-programi`, `/lgs-calisma-programi`, `/yanlis-defteri-uygulamasi`, `/ders-calisma-uygulamasi`) now share one shell (`components/seo-lp/seo-lp-shell.tsx`) and one day paper kit (`seo-paper.tsx` + `seo-paper.css`: paper notes, tape, stickers, `SeoSignupCta`), each with the landing's scene as its hero: the pomodoro page's live room (`PublicPomodoroWidget` inside `seo-desk-scene.tsx`), the YKS/TYT/LGS plan room (`study-program-lp-template.tsx`, `plan-demo.css`), the mistake-notebook morning desk and the study-app dawn facade with clickable tags (`facade-tags.tsx`, `seo-facade.css`). No night palette. H1 and lead paint without images or JS; only the hero scene image is `priority`/`fetchPriority=high` (the study-app far city is lazy, low priority); the pomodoro room `sizes` matches the hero column (`768px 528px, 100vw`). Guards: `scripts/check-web-performance-budgets.mjs` gained a `seoLp` route (pomodoro-timer, route JS <= 400 KiB), `landing-performance.spec.ts` checks mobile LCP < 2.5 s on `/pomodoro-sayac` and `/ders-calisma-uygulamasi`, and `seo-lp.spec.ts` has an `en` pass over the six EN routes (H1 visible, no raw keys, no `MISSING_MESSAGE`). Spec: `docs/superpowers/specs/2026-11-21-seo-lp-landing-rooms-design.md`.

- **2026-11-19 Sprint 7 live QA fixes, pilot waitlist copy alignment, GA4 conversion separation & mobile LCP assets.** Fixed `useSessionAmbientSound` so selecting `Sessiz` (`"off"`) sets `hasOwnPreference: true`, persists across room transitions (`LIBRARY`/`CAFE`/`HOME`), timer start/pause/reset, and page reloads without snapping back to `suggestedTrackId: "scene"`, and skips idle `.mp3` preloading until an active session or explicit 5s idle preview starts. Updated all six product-led SEO landing pages (`/pomodoro-sayac`, `/yks-calisma-programi`, `/tyt-calisma-programi`, `/lgs-calisma-programi`, `/yanlis-defteri-uygulamasi`, `/ders-calisma-uygulamasi`) so visitors see invite-only pilot status and `"Bekleme listesine katıl"` CTAs upfront while keeping the guest Pomodoro timer and visible `"Pilot hesabım var · Giriş yap"` (`<Link href="/login">`) paths; removed the unverified `"Bu planı kaydet"` transfer claim and LGS `"veli ritmi görür"` claim, retitled YKS/TYT/LGS sample tables and demo previews to `"Örnek çalışma blokları"` without daily total-hour claims, added `WebApplication` JSON-LD to `/yanlis-defteri-uygulamasi` and `/ders-calisma-uygulamasi`, added page-specific descriptions/OG descriptions to `/yasal/[slug]` (including `/yasal/kvkk-aydinlatma`) plus a permanent 308 redirect from `/yasal/kvkk` → `/yasal/kvkk-aydinlatma`. Separated GA4 waitlist CTA clicks (`waitlist_cta_click`) from server-verified waitlist joins (`waitlist_signup` with session FNV-1a fingerprint deduplication in `claimWaitlistSignupConversion`, zero PII) and real invited account creation (`sign_up`). Re-encoded the four above-the-fold mobile/facade landing AVIF layers (`city-far-mobile.avif`, `city-mid-mobile.avif`, `city-front-mobile.avif`, `city-facade.avif`) via `scripts/build-landing-mobile-images.mjs` (`quality: 50, effort: 6`), cutting cold-load mobile city AVIF payload from 289,348 to 203,802 bytes (−29.6%), and lowered initial fetch priority on the `room-puhu` interior sprite. Related: `apps/web/src/app/[locale]/(app)/study-session/_components/use-session-ambient-sound{,.spec}.ts`, `apps/web/src/app/[locale]/pomodoro-timer/*`, `apps/web/src/app/[locale]/mistake-notebook/page.tsx`, `apps/web/src/app/[locale]/study-app/page.tsx`, `apps/web/src/app/[locale]/legal/[slug]/page.tsx`, `apps/web/src/lib/{analytics,lp-attribution,legal}{,.spec}.ts`, `apps/web/src/components/{waitlist,seo-lp}/*`, `apps/web/messages/{tr,en}.json`, `apps/web/next.config.ts`, `apps/web/scripts/build-landing-mobile-images.mjs`.

- **2026-11-18 Product-led SEO landing pages (`/pomodoro-sayac`, `/yks-calisma-programi`, `/tyt-calisma-programi`, `/lgs-calisma-programi`, `/yanlis-defteri-uygulamasi`, `/ders-calisma-uygulamasi`), `/llms.txt`, and SEO/analytics/bundle hardening.** Added six public SSR product-led landing pages (TR canonical + indexed, EN courtesy `noindex, follow`): `/pomodoro-sayac` with a login-free interactive Pomodoro/stopwatch widget (`25/5`, `50/10`, custom duration, `LIBRARY`/`CAFE`/`HOME` rooms, and client ambient audio via `useSessionAmbientSound`), a shared config-driven `<StudyProgramLpTemplate variant="yks" | "tyt" | "lgs" />` + `<PlanDemoWidget />` with crawlable sample schedule tables, parent guidance (`#veli` on LGS), and a 308 redirect from `/8-sinif-ders-calisma-programi` to `/lgs-calisma-programi`, `/yanlis-defteri-uygulamasi` (distinct from the authenticated `/yanlis-defteri` app route) with an interactive PII-free sample review card (`<NotebookDemoWidget />`), and the category pillar `/ders-calisma-uygulamasi`. Added `WebApplication` + `FAQPage` JSON-LD, `/llms.txt` AI discovery route (excluded from locale middleware in `proxy.ts`), sitemap entries, landing internal links (`#sabah`, `#odak`, Plan note, `LandingFooter`), explicit OpenGraph/Twitter metadata on `/blog`, `/koclar`, and `/yasal/[slug]`, `React.cache()` deduplication on `fetchPublicQuestion`, consent banner path coverage for all public SEO LPs (`consent-banner-path.ts`), and consent-gated GA4 funnel/LP events (`pomodoro_start`, `pomodoro_complete`, `signup_from_*_lp`, `plan_demo_view`, `plan_cta_click`, `notebook_demo_view`, `notebook_cta_click`, `category_cta_click`, `purchase`, plus `sessionStorage` `lp_source` attribution on `sign_up` and `generate_lead`). Upgraded `@mentor/web` to Next.js `16.4.6` (`eslint-config-next` `16.4.6`, `experimental.agentUpgrade: "security"`), enabled `optimizePackageImports` for workspace barrels, and marked `@mentor/core` + `@mentor/validation` `"sideEffects": false`. Related: `apps/web/src/i18n/routing.ts`, `apps/web/next.config.ts`, `apps/web/src/proxy.ts`, `apps/web/src/app/sitemap.ts`, `apps/web/src/app/llms.txt/route.ts`, `apps/web/src/app/[locale]/pomodoro-timer/*`, `apps/web/src/app/[locale]/{yks,tyt,lgs}-study-program/page.tsx`, `apps/web/src/app/[locale]/mistake-notebook/*`, `apps/web/src/app/[locale]/study-app/page.tsx`, `apps/web/src/components/seo-lp/*`, `apps/web/src/lib/{analytics,lp-attribution,consent-banner-path,structured-data,forum-public}.ts`, `apps/web/package.json`, `packages/{core,validation}/package.json`.

- **2026-11-18 Google tag command compatibility and marketing verification.** Consent initialization and event tracking now share Google's `Arguments` command format; plain arrays were ignored by the live tag. Consent remains required, existing event payloads are unchanged, and the browser test checks the provider format. Search Console's domain property was verified with a Cloudflare TXT record; the existing URL property, sitemap and GA4 association were checked. Enrich Labs received owner-approved read-only Search Console access with the URL property selected. Keep the verification TXT and HTML meta tag. The GA4 code fix still requires deployment and a live hit check; do not treat tag detection alone as working collection. Related: `apps/web/src/lib/analytics.ts`, `apps/web/src/lib/analytics-consent.tsx`, `apps/web/src/lib/analytics.spec.ts`, `apps/web/src/lib/analysis-analytics.spec.ts`, `apps/web/e2e/analytics-consent.spec.ts`, `docs/qa/2026-11-18-marketing-integrations.md`.

- **2026-11-12 Deferred weekly-story art.** The morning desk phone and its weekly recap note use the existing lazy AVIF/WebP picture for the nebula backdrop. The initial viewport can skip the artwork and the same crop loads as the visitor approaches the desk. Use the landing performance test to check both request timings. Related files include `morning-story.tsx`, `landing-morning.css`, and `landing-performance.spec.ts`.

- **2026-11-12 Landing stability and discovery.** The mobile analytics consent card opens below the navigation without moving the hero sheet. The city gives the stars image early request priority. The Turkish homepage identifies PuhuKoç with linked `Organization` and `WebSite` JSON-LD and links to the public community preview. Verify the card on a fresh anonymous mobile visit with analytics enabled, then repeat the production PageSpeed run after deployment. Related files include `city-stage.css`, `city-stage.tsx`, `cookie-consent-banner.tsx`, `[locale]/page.tsx`, and `structured-data.ts`.

- **2026-11-10 — Lightweight web probes and shared availability snapshot:** Added infrastructure-only
  `/healthz` (204, empty body, no-store) outside locale/document rendering. Web health probes must target
  this path, not `/` or `/tr`; the Blueprint and deployment guard now require it. Existing Render services
  need the path changed after deployment and an external 204 check. The API/database readiness probe
  remains separate. Root layout and landing sections now share React's request-scoped availability
  reader while each new document still fetches fresh flags and fails closed on errors. No TTL or UI
  change. Related: `src/app/healthz/route{,.spec}.ts`, `src/proxy{,.spec}.ts`,
  `src/lib/app-availability-server.ts`, `landing-availability.ts`, `render.yaml`, `scripts/check-deployment.mts`,
  `docs/plans/2026-11-10-web-healthcheck-design.md`.

- **2026-11-10 — Landing asset performance, package A:** Tab metadata now selects a 64x64 PNG of the
  same favicon artwork (8,251 bytes instead of the 133,816-byte raster-backed SVG). The existing ICO
  fallback and Apple icon remain. CI guards the selected PNG at 10 KiB; browser checks also verify its
  actual dimensions. The fourteen existing city AVIF/WebP files now declare four-hour browser/shared
  caching, preserving the browser lifetime observed on production while allowing fresh edge reuse.
  HTML/RSC, feature availability, other media and missing city filenames keep their policies. When
  replacing art, use a new URL for immediate updates; an edge purge cannot clear existing browser
  caches. Original brand files remain as source artwork; reproduce the favicon with
  `sharp("public/img/brand/puhukoc-icon.svg").resize(64, 64).png({compressionLevel: 9})` from `apps/web`.
  Three matched mobile-throttled resource fetches reduced median icon transfer from 101,123 to 8,551
  bytes and duration from 689 to 203.4 ms; these are icon-only lab measurements, not page LCP gains.
  A repeated city fetch transferred zero network bytes. Production browser validation: 39 passed,
  three intentional device skips; build, web typecheck, targeted lint and 33 focused unit/Node checks passed.
  Production Cloudflare HIT verification remains a post-deployment check. Related: `next.config.ts`,
  `[locale]/layout.tsx`, `public/img/brand/puhukoc-favicon-64.png`, `scripts/check-web-performance-budgets.mjs`,
  `e2e/landing-performance.spec.ts`, `docs/plans/2026-11-09-landing-asset-cache-design.md`,
  `docs/qa/evidence/2026-11-10-landing-asset-cache.json`.

- **2026-11-08 — Mobile landing cold-load media:** Phones below 768px now select 1024px AVIF/WebP city background variants; desktop art and the detailed facade remain unchanged. The four AVIF city layers drop from 342,600 to 289,348 bytes on mobile (15.5%). Coin player/WASM loads only near its section and never for reduced motion; coin and closed-chest stills use native lazy loading. Rebuild variants with `node apps/web/scripts/build-landing-mobile-images.mjs`. Browser request tests use the standard enabled API fixture and cover both viewports, activation and reduced motion. Hosting wake-up time and request-scoped availability/security behavior are unaffected. Related files: `city-art.tsx`, `scene-img.tsx`, `journey-coin.tsx`, `landing-chest.tsx`, `e2e/landing-performance.spec.ts`.
- **2026-11-08 — Wordmark accessible name:** Restored the shared SVG logo's accessible name to `PuhuKoç` while retaining the lowercase outlined artwork. Links containing only the logo remain recognizable to assistive technology and existing public-header navigation checks. Related files: `packages/ui/src/components/logo.tsx`, `apps/web/e2e/knowledge.spec.ts`.
- **2026-11-08 — Landing mobile parity and first paint:** Removed the obsolete secondary hero sign-in/tour-skip row from every viewport; navigation sign-in and the desktop primary action remain. The four existing city images now use the opening camera's CSS positions before hydration, then hand over to the scroll camera without waiting for JavaScript or a fade-in. No additional images or backend calls are introduced. No-JavaScript mobile/desktop browser coverage guards both fixes. Free hosting wake-up latency is a separate operational limitation. Related files: `city-art.tsx`, `city-stage.{tsx,css}`, `city-panels.tsx`, `e2e/landing.spec.ts`.

- **2026-11-04 — AI Coach Named "Puhu" & 5 Exams Everywhere (`APP-132–APP-136`):** Renamed the AI coach to **Puhu** across ~80 TR/EN strings (`nav.coach`, `Puhu’yla planla`, paywall, panel, analysis, chat); standardized `"yapay zekâ"` (never `"AI"` in TR); added `ALES` and `DGS` to landing hero eyebrow (`KPSS · YKS · LGS · ALES · DGS`), meta tags, and FAQ.
- **2026-11-02..03 — Premium Hero Mask, `#premium` Flight Sheet & Interactive Chest:** Shipped `puhu-premium-hero.png` + masked speaking frames (`public/mascot/puhu/motion/premium/`), `PremiumIdentityMark` domino mask, `#premium` landing section with `puhu-premium-flight-loop.mp4`, 2-tab XP+Coin `journey-panel.tsx`, and interactive `LandingChest` + `PlanMagicVideo`.
- **2026-10-27..31 — "Işıklı Şehir" Landing, Odak Odası, Gece Yolculuğu & Paper Flutter:** Replaced the old landing with the 3-layer night city stage, `paper-flutter.ts` SVG displacement breeze, `#sabah` desk, `#odak` room switcher, `#yolculuk` quests/lights, taped paper cookie card, and energetic Duolingo-like Puhu copy.
- **2026-08-22..09-02 — `ThemeLamp` Dark Mode, `TopBanner` Cube Flip & Solid Overlays:** Added pull-cord light/dark switch (`html.dark`), `TopBanner` multi-item rotation, and enforced 100% opaque modal/sheet surfaces.
- **2026-07-15..08-15 — B2C Shell, Nunito Typography & TR/EN i18n (`0027–0042`):** Built `(app)`/`(auth)` layouts, `AppNav`, `next-intl` localized routing, and Nunito + Play-ledge token system.
