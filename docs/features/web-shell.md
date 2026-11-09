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
  - **`(app)` (Student Authenticated Shell):** `/panel`, `/plan`, `/seans`, `/defter`, `/analiz`, `/bilgi`, `/koc/sohbet`, `/topluluk`, `/kocum`, `/hedef`, `/profil`, `/abonelik`.
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
