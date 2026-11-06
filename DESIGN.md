# DESIGN.md — PuhuKoç Design System

> **Canonical visual, typography, layout, iconography, and motion specification** for `apps/web` and
> `@mentor/ui` (ported to React Native in Phase 2).
> Grounded in [`sinav-kocluk-roadmap.md`](./sinav-kocluk-roadmap.md) and [`docs/copy/voice.md`](./docs/copy/voice.md).
> Note: `apps/admin` uses its own Duralux Bootstrap 5 + SCSS stack (`apps/admin/AGENTS.md`).

---

## 1. Design Philosophy & Reference Screen

**PuhuKoç** is an exam-prep companionship platform. The visual language balances **warm, tactile
study spaces** (daylight paper desk, cozy evening lamp, quiet night city) with **playful, energetic
Duolingo-like momentum** (play-ledge CTAs, Puhu mascot animations, rewarding ceremonies).

### The Reference Screen: `/panel`

`/panel` is the visual benchmark for the entire authenticated app. Every screen in `(app)` follows
the **7 Panel Rules**:

1. **One canvas + solid cards:** Warm cream background (`--color-bg`) with crisp white cards (`--color-surface`) and subtle `1px` borders (`--color-border`). Never stack translucent glass cards on the main canvas.
2. **Tactile primary action (Play-ledge):** One clear primary action per screen or card, using the sky-blue play-ledge button (`--cta-play-bg`, `4px` bottom ledge).
3. **3-radius hierarchy:** `20px` (`--radius-card`) for cards, `14px` (`--radius-inner`) for nested wells/inputs, `9999px` (`--radius-pill`) for pills/chips.
4. **3-tier ink hierarchy:** Primary ink (`--color-main`), secondary body (`--color-secondary`), muted metadata (`--color-muted`).
5. **Bare iconography:** Solar icons (Linear at rest, Bold when active/accented) rendered without heavy nested tile boxes unless part of a compact semantic status badge.
6. **Calm progress, energetic celebration:** Countdowns and exam metrics never use alarm-red or shame rankings; completed blocks, levels, achievements, and weekly chests celebrate with rich motion and warm gold/sky accents.
7. **Dual-register voice ([`docs/copy/voice.md`](./docs/copy/voice.md)):** Chrome, quests, community, and ceremonies speak in **energetic Puhu**; low mood, AI coach chat, errors, and payments speak in **calm Companion**.

---

## 2. Color System & Themes

All tokens live in [`packages/ui/src/theme.css`](./packages/ui/src/theme.css). Never hardcode hex values in components.

### 2.1 Core Light & Dark (`html.dark`) Canvas

Toggled via the top-right pull-cord `ThemeLamp` (`mentor:theme` in `localStorage` + `mentor_theme` cookie for SSR zero-flash).

| Token | Light (Default) | Dark (`html.dark`) | Usage |
|---|---|---|---|
| `--color-bg` | `#FAF6F0` | `#0F141C` | Page canvas |
| `--color-surface` | `#FFFFFF` | `#171F2C` | Cards, dialogs, sheets, popovers |
| `--color-surface-alt` | `#F3EDE3` | `#1E2838` | Nested wells, inactive tabs, code/note boxes |
| `--color-surface-hover` | `#EFE7DA` | `#253145` | Interactive row/card hover |
| `--color-border` | `#E6DEC8` | `#2A364B` | Default card & divider border (`1px`) |
| `--color-main` | `#111827` | `#F3F6FA` | Headings, primary copy, active nav |
| `--color-secondary` | `#4B5563` | `#A6B3C6` | Body text, descriptions |
| `--color-muted` | `#6B7280` | `#7A889E` | Timestamps, helper captions, placeholders |

### 2.2 Play-Ledge CTA & Brand Accents

| Token | Value | Usage |
|---|---|---|
| `--cta-play-bg` | `#55ACEE` | Primary `Button` fill (sky blue) |
| `--cta-play-edge` | `#3B8FD0` | `4px` tactile bottom ledge on primary buttons |
| `--cta-play-hover` | `#66B8F4` | Hover fill |
| `--cta-play-ink` | `#0F2233` | Deep navy button label (high contrast on sky blue in both themes) |
| `--color-accent` | `#F59E0B` | Warm amber lamp highlight, streak flame, active lamps |
| `--color-star` | `#FBBF24` | Gold stars, chest ready badge, celebration accents |

### 2.3 Semantic Status & Activity Ramp

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-success` / `-bg` | `#15803D` / `#DCFCE7` | `#4ADE80` / `#132E21` | Completed tasks, verified badges |
| `--color-warning` / `-bg` | `#B45309` / `#FEF3C7` | `#FBBF24` / `#332611` | Approaching limits, gentle nudges |
| `--color-danger` / `-bg` | `#B91C1C` / `#FEE2E2` | `#F87171` / `#36181B` | Destructive actions, form validation errors (never used for exam countdowns) |
| `--activity-0..4` | `#EFECE6` → `#F59E0B` | `#1E2838` → `#FBBF24` | 5-step study heatmap & consistency ramp |

### 2.4 Premium & Coach Identity Tokens

- **Premium Identity (`--premium-*`):**
  - `--premium-mark`: `#1E2A5A` (light) / `#7E9BFF` (dark) — Puhu's night-blue hero domino mask (`PremiumIdentityMark`).
  - `--premium-ring-from` / `--premium-ring-to`: `#FDE68A` → `#F59E0B` — gold eye-rims on the mask (`>=20px`) and avatar ring.
- **Human Coach Identity (`--coach-accent*`):**
  - `--coach-accent`: `#0D9488` (teal) — distinguishes human coach surfaces (`/kocum`, `"Koçundan"` task badges, `GraduationCap` mark) from Puhu AI (`#55ACEE` / `--premium-mark`).

### 2.5 Scoped Scene Themes (Ignore `html.dark`)

Atmospheric stages lock their own palette regardless of the user's light/dark toggle:

| Scope class | Surface | Palette |
|---|---|---|
| `.landing-city-theme` | `/` ("Işıklı şehir" landing) | Night sky (`#07122A` → `#162B5B`), warm lit windows (`#FFE082`), paper notes (`#FFFDF8`) |
| `.room-stage[data-room-theme]` | `/seans` & `/topluluk/oda/[id]` | Top-down illustrated rooms (`LIBRARY`, `CAFE`, `HOME`); `LIBRARY`/`CAFE` use light `--room-ink` on dim warm wood; `HOME` uses dark ink on frosted white |
| `.weekly-recap-theme` | Weekly Recap story overlay | Full-screen dark celebratory story deck with aurora washes |
| `.premium-paywall-theme` | `PremiumPaywallModal` | Deep night sheet with aurora pill, monochrome glass benefit tiles, and lamp-yellow accents |
| `.achievement-scene-theme` | Achievement unlock ("Işık Yandı") | Dark theatrical spotlight with warm amber/gold glow |
| `.plan-coach-night` | "Puhu’yla planla" waiting stage | Night skyline (`#08113A`), flying masked Puhu video, falling Caveat paper notes |
| `.weekly-chest-night` | Weekly Chest opening desk | Warm night desk with 5 sequential `ChestLamps` and soft-3D chest art |

---

## 3. Typography

- **Primary UI & Display Font:** **Nunito** (`--font-sans`, `latin-ext` variable weight `200–1000`, `font-display: swap`). Rounded terminals match Puhu's friendly, energetic character while keeping dense tables and numbers crisp (`tabular-nums` on timers, net scores, and prices).
- **Handwritten Accent Font:** **Caveat** (`--font-hand`, weights `600`, `700`). Used strictly on taped paper notes, notebook spine labels, and polaroid captions.
- **Brand Wordmark (`Logo` in `@mentor/ui`):** Typographic **`PuhuKoç`** in Nunito weight `1000` (`-0.03em` tracking), with Puhu's blinking eye embedded inside the letter `o`.
- **Turkish Casing Rule:** Never rely on bare CSS `uppercase` for dynamic Turkish strings containing `i` or `ı`. Use `toLocaleUpperCase('tr-TR')` or sentence case.

### Panel Type Scale

| Role | Size / Line-height | Weight | Token / Class |
|---|---|---|---|
| Display / Hero | `clamp(28px, 4vw, 40px)` / `1.15` | `800–900` | `font-extrabold tracking-tight` |
| Page Title (`h1`) | `22px–24px` / `1.25` | `800` | `text-xl sm:text-2xl font-extrabold` |
| Section Heading (`h2`) | `17px–18px` / `1.3` | `700` | `SectionHeading` (`text-[17px] font-bold`) |
| Card Title (`h3`) | `15px–16px` / `1.35` | `700` | `text-[15px] font-bold` |
| Body Default | `14px–15px` / `1.5` | `500` | `text-sm font-medium` |
| Caption / Chip / Meta | `12px–13px` / `1.4` | `600` | `text-xs font-semibold` |

---

## 4. Spacing, Layout & Responsive Grid

- **Base grid:** `4px` increments. Card internal padding: `16px` (`p-4`) on mobile, `20px–24px` (`p-5`/`p-6`) on desktop. Grid gap: `16px` (`gap-4`) mobile, `20px` (`gap-5`) desktop.
- **Authenticated Shell (`PANEL_MAIN_CLASS` / `PANEL_GRID_CLASS`):**
  - Desktop (`>=1024px` / `lg`): Left sidebar (`AppNav`, `240px`) + centered main content container (`max-w-[1200px]`).
  - Dual-column screens (`/panel`, `/topluluk`, `/profil`) split at `1280px` (`xl`) into a fluid primary column + `340px` right rail.
  - Mobile (`<1024px`): Single column with `63px + env(safe-area-inset-bottom)` fixed bottom tab bar (`MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS`).
- **Stage Exception (`/seans` & `/topluluk/oda/[id]`):** Full-bleed stage layout with collapsible side drawer so the top-down study table fills the viewport.

---

## 5. Radius, Borders & Elevation

- **3 Radii + Sheet:**
  - `--radius-card`: `20px` (`rounded-[20px]`) — primary cards, dialogs.
  - `--radius-inner`: `14px` (`rounded-[14px]`) — inputs, nested blocks, inner banners.
  - `--radius-button`: `16px` (`rounded-2xl`) — play-ledge and secondary buttons.
  - `--radius-pill`: `9999px` (`rounded-full`) — chips, tags, avatars.
  - `--radius-sheet`: `28px` top corners on mobile bottom sheets and `PremiumPaywallModal`.
- **Solid Overlays Rule:** Every modal, sheet, dropdown, and popover uses a **100% opaque surface** (`var(--color-surface)`). Never use semi-transparent backgrounds on floating layers (causes text bleed-through).
- **Elevation:** Prefer `1px solid var(--color-border)` and tactile bottom ledges (`border-b-4`) over heavy drop shadows. Reserve `--shadow-card` and `--shadow-modal` for floating overlays and hung boards.

---

## 6. Core Components & Patterns (`@mentor/ui`)

| Component | Pattern & Rules |
|---|---|
| `Button` | **Primary (`variant="primary"`):** Sky-blue play-ledge (`--cta-play-bg`, `4px` `--cta-play-edge`, depresses `2px` on `:active`). **Secondary (`outline` / `secondary`):** Surface fill with `1px` border + `2px–4px` bottom ledge. Minimum `44×44px` touch target. |
| `Card` | Solid `--color-surface`, `1px` `--color-border`, `20px` radius. Interactive cards lift `-2px` on hover. |
| `Chip` | Pill badge (`rounded-full`, `12px` semibold) for exam tags, topic categories, and statuses. |
| `Field` & `FormError` | Accessible label + input (`14px` radius, `44px` min height) + inline `Companion`-register error message. |
| `TopBanner` | Single-slot rotating top strip on `/panel` (3D cube-flip transition between active promotion, quest nudge, and system announcement; per-item dismiss). |
| `PremiumIdentityMark` | Inline `24×24` SVG hero domino mask next to Premium user names (`16px` monochrome on mobile bar; `20px–24px` with gold eye-rims on sidebar/profile). Never rendered on feed rows or coach accounts. |
| `PuhuBubble` | Speech bubble paired with `PuhuImage` or `PuhuSpeakingMascot` (4-frame spritesheet; uses masked frames in `public/mascot/puhu/motion/premium/` for Premium users). |

---

## 7. Iconography

- **Primary Icon Set:** **Solar** (24px grid, stroke `1.75px`).
  - **Navigation (`AppNav`) & surfaces:** **Solar Linear** at rest → **Solar Bold** when active or highlighted.
  - **Bare glyph rule:** Render icons directly in semantic ink (`--color-main`, `--color-secondary`, or feature hue) without wrapping every icon in a colored pastel square, except where a compact badge requires a pill container.
- **Custom & Domain Marks:**
  - `PremiumIdentityMark`: Puhu's starless night-blue domino mask with gold eye-rims.
  - `GraduationCap` (teal `--coach-accent`): Marks human coach surfaces (`/kocum`, `"Koçundan"` tasks).
  - `ChestArt` & `ChestLamps`: Soft-3D weekly chest and 5 desk lamps (`economy`).

---

## 8. Visual Language, Mascot & Signature Surfaces

- **Puhu Mascot (`public/mascot/puhu/`):**
  - Puhu is an expressive owl companion with specific poses (`encouraging`, `celebrating`, `sleeping`, `reading`, `thinking`, `premium` hero mask) and career outfits (`doctor`, `lawyer`, `engineer`, `teacher`, `public`, `finance`, `scholar`).
  - **Rule:** `variant="premium"` (night-blue domino mask + cape) always overrides career outfits and appears **only** when Premium AI is speaking or represented (`Puhu’nun yapay zekâ notu`, session AI reflection, Premium coach FAB, `/koc/sohbet` empty landing, landing `#premium` flight loop).
- **Visual Bans:**
  - Never use generic stock photos of stressed students or red alarm clocks.
  - Never invent fake strikethrough prices or fake social proof counters.
  - Never place Coin balances or upsell banners inside the `/koc/sohbet` conversation viewport.
- **Landing Page (`/` — "Işıklı şehir"):**
  1. **Night City Stage (`#sehir`):** Parallax 3-layer city (`city-far/mid/front.webp`) with interactive lit windows (Career, Masa, Sabah, Plan with `puhu-hero-magic-loop.mp4`, Topluluk) and taped Caveat paper notes that flutter in the breeze (`paper-flutter.ts` SVG displacement filter).
  2. **Sabah Masası (`#sabah`):** Daylight desk walkthrough of daily ritual & plan tasks.
  3. **Odak Odası (`#odak`):** Interactive preview of `/seans` with `LIBRARY` / `CAFE` / `HOME` room switcher, Pomodoro dial, shared table (`MASA-`), and ambient audio.
  4. **Gece Yolculuğu (`#yolculuk`):** Quests card + 12-level lights + Coin wallet tab + interactive Night Desk Weekly Chest (`LandingChest`).
  5. **Premium Sheet (`#premium`):** Night skyline with `puhu-premium-flight-loop.mp4`, 7 clear student benefits, and lamp-yellow trial CTA.
  6. **Coach Band & FAQ:** Human coach invite (`/koclar`) and structured FAQ.

---

## 9. Motion Scale & Scene Choreography

All motion respects `prefers-reduced-motion: reduce` (via `useReducedMotion()` or CSS media queries), collapsing transforms into instant or gentle opacity fades.

### 9.1 Motion Token Scale

| Tier | Duration | Easing | Usage |
|---|---|---|---|
| **Micro** | `120ms–160ms` | `cubic-bezier(0.22, 1, 0.36, 1)` | Button press, toggle, hover tint, chip select |
| **Chrome** | `180ms–260ms` | `cubic-bezier(0.22, 1, 0.36, 1)` | Modal/sheet open (`250ms`) & asymmetric faster close (`150ms–180ms`), tab indicator, accordion |
| **Content** | `240ms–360ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Page section stagger (`staggerListVariants`), card entrance |
| **Ambient** | `1.7s–4.0s` | Sine / rAF loop | Paper note flutter, lamp glow pulse, Puhu idle breathing |
| **Moment (Ceremony)** | `800ms–2400ms` | Sequenced stages | Level-up, Achievement "Işık Yandı", Weekly Chest opening, "Puhu’yla planla" stage, Session finish |

### 9.2 Signature Ceremonies & Scenes

- **"Puhu’yla planla" Waiting Stage (`.plan-coach-night`):** Full-bleed night skyline (`#08113A`) where masked Puhu flies (`puhu-magic-loop.mp4`) while backend evidence items drop onto the rooftops as taped Caveat paper notes (`3.6s` hold, max 6 notes). On completion (`"Haftan hazır."`), the stack bounces and slides into the new weekly plan.
- **Weekly Chest Opening (`.weekly-chest-night`):** 5 desk lamps (`ChestLamps`) light sequentially as active days accumulate; when ready, tapping the chest flows lamp light into the lock, plays the chest opening clip, and reveals earned XP/Coin.
- **Study Session Stage (`/seans` — "Işıklar kısılır"):** Starting a session dims surrounding chrome into the chosen room (`LIBRARY`/`CAFE`/`HOME`); finishing triggers the session reflection check-in and an optional downloadable **Polaroid share card**.
- **Notebook Desk ("Masa") & Review Fan ("Yelpaze"):** Study notebooks sit as tactile bound covers on a wooden shelf and fan out like flashcards during topic review.
- **Achievement Unlock ("Işık Yandı") & Level Spotlight:** Full-screen dark spotlight ceremony when a badge or Night Journey level (`Kıvılcım` → `Zirve`) is earned.
- **HungBoard Sway:** Empty/onboarding boards hang from top pins with a damped pendulum entrance.

---

## 10. Loading, Empty States & Skeletons

- **Zero-CLS Skeletons:** Every async card, list, or modal (`PaywallCheckoutSkeleton`, panel widgets, community feed) renders dimensionally matched skeleton placeholders (`animate-pulse` on `--color-surface-alt`) so layout height never jumps when data resolves.
- **Empty States:** Never show a blank box or a cold `"Veri bulunamadı"`. Pair a warm illustration or bare Solar icon with a 1-sentence **Puhu**-register invitation and a direct CTA (unless inside a search filter, which uses calm **Companion** `"Buna uyan bir sonuç yok."`).

---

## 11. Community, Forum & Mentorship Design Rules

- **Community Hub (`/topluluk`):** Unified around active study rooms (`Çalışma Odası`), exam-filtered forum threads, and the weekly XP `Lig`.
- **No Shame Leaderboards:** `Lig` shows top performers and the user's own neighborhood cohort; never highlight "bottom/failing" ranks.
- **Verified Answers:** Official or coach-verified forum answers carry a calm semantic emerald badge (`--color-success`), never a loud trophy.
- **Human Coach Surfaces (`/kocum`, `/koclar`):** Use `--coach-accent` teal and `GraduationCap` to stay visually distinct from Puhu AI. Coach dashboards prioritize scannable student readiness signals, task completion, and brief cards.

---

## 12. Implementation Pointers

- **Tokens & CSS:** [`packages/ui/src/theme.css`](./packages/ui/src/theme.css)
- **Shared UI Primitives:** [`packages/ui/src/`](./packages/ui/src/) (`Button`, `Card`, `Chip`, `Field`, `SectionHeading`, `Logo`, `FormError`)
- **Motion Helpers:** [`apps/web/src/lib/stagger-motion.ts`](./apps/web/src/lib/stagger-motion.ts), [`apps/web/src/components/landing/paper-flutter.ts`](./apps/web/src/components/landing/paper-flutter.ts)
- **Frontend Standards:** [`docs/standards/frontend.md`](./docs/standards/frontend.md)
- **Voice & Copy:** [`docs/copy/voice.md`](./docs/copy/voice.md)
