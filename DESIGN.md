# DESIGN.md — Exam Coaching Platform · Design System

> Status: Living design record · Updated: 2026-09-21  
> Product decisions: [`sinav-kocluk-roadmap.md`](./sinav-kocluk-roadmap.md) · Product register: [`PRODUCT.md`](./PRODUCT.md)  
> **Visual foundation:** **Nuton — Online Learning Mobile App** Figma UI template, **evolved** into Mentor’s own system (companionship platform).  
> Source of truth for base values: Figma file `8lc7t0P5kibfQ7GMzLSl3l` (Dev Mode MCP). Evolve layers (surfaces, visual language, motion) are Mentor-owned and documented here.

---

## 1. Overview

Nuton’s language remains the base: **monochrome-forward** — near-black text on a **white background**, softened by **blurred pastel gradient blobs**, **translucent white cards**, a **blue-tinted soft shadow family**, and **10 px rounded corners** on cards/fields. **CTAs are the play ledge** (`@mentor/ui` `Button`): fill `#55ACEE`, ink `#0F2233`, 4px `#3B8FD0` edge the press sinks into, 16px radius. Mentor uses **Nunito** (variable, 200–1000) for headings and body (Turkish-complete, rounded and warm at small sizes).

**The panel is the reference screen (2026-09-21).** `/panel` ("Bugün") is where this system is
fully expressed, and **every screen converges to it** as it is touched: white blob canvas, solid
cards, one play-ledge action, progress drawn rather than tabulated, Puhu speaking in a bubble,
identity chrome for premium and coach. When an older screen and the panel disagree, the panel is
right and the older screen is the one to change. Reference code:
`apps/web/src/app/[locale]/(app)/dashboard/_components/`, with the parts other screens reuse in
`apps/web/src/components/panel/`; component specs in §6.1.

Seven rules the panel is built on, and every screen follows:

1. **One primary action per screen** — the play ledge. Everything else is a text link, a card
   action or a menu item. Two filled ledges on one screen is a design bug.
2. **Each number appears once.** The old panel showed today's plan as four different counts;
   a count lives in the one place that owns it.
3. **Progress is drawn, not tabulated** — a path, a bar, a week band. No rows of metric tiles.
4. **Puhu speaks in a bubble**, in the first person, one short line. An AI-written line carries
   its provenance label ("Koçundan bugün" + Sparkles); a rule-based line does not pretend to be AI.
5. **One commercial ask at a time.** A member sees what they already have, never an upsell.
6. **Identity is chrome, not decoration:** premium is the clasp (PREMIUM badge, §7), anything a
   human coach did is ink blue (`--coach-accent*`).
7. **Sections load on their own.** The layout paints at once and each section shows its own
   skeleton; nothing waits behind a page-level gate (§10).

**Evolve (2026-07-12):** We keep Nuton hex/type/radius. We add surface hierarchy, hover elevation, a documented visual language (Puhu + `visuals/`), rich motion with reduced-motion guardrails, and empty/loading rules. Premium feel comes from craft and companionship — not EdTech purple, cream paper backgrounds, or hero-metric grids.

**Weekly recap celebration palette (2026-07-28):** The full-screen “Haftanın Hikâyesi” is an
intentional celebration exception with feature-scoped tokens: coral `#FF5B49`, deep purple
`#400073`, lavender `#AFB1FF`, mint `#16D0A6`, and ink `#000000`. These saturated colors and the
committed Figma exports under `public/visuals/weekly-recap-2023/` must not leak into ordinary app
surfaces. Static typography remains the product face (Nunito); decorative shapes are exported assets, not
recreated CSS/React artwork.

Base canvas: **375 px** wide. Content column **335 px** → **20 px** side gutters. Desktop: gutters **20–32 px**; page max-widths below.

---

## 2. Color System

### 2.1 Text & core (Figma variables — exact)

| Token                  | Hex       | Usage                                                    |
| ---------------------- | --------- | -------------------------------------------------------- |
| `main`                 | `#111111` | Headings, titles, primary text, active nav               |
| `body-text`            | `#333333` | Body copy, input values                                  |
| `secondary-text`       | `#666666` | Captions, meta, labels, inactive nav                     |
| `btn`                  | `#000000` | Nav pill / compact chrome fill (not `@mentor/ui` Button) |
| `btn-label`            | `#FFFFFF` | Label on `btn` (inverts in dark — §2.5)                  |
| `label-dark-secondary` | `#EBEBF5` | Secondary label on dark                                  |

Body text must stay ≥4.5:1 on backgrounds. Do not use colors lighter than `secondary` for readable copy.

### 2.2 Surface hierarchy

| Token                 | Value                                                   | Usage                                                 |
| --------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| `bg`                  | `#FFFFFF`                                               | Screen base fill (blobs sit behind)                   |
| `surface`             | `#FFFFFF`                                               | Solid cards                                           |
| `surface-elevated`    | `#FFFFFF` + `shadow-card` / hover → `shadow-card-hover` | Floating / interactive cards                          |
| `surface-container`   | `#F0EDEC`                                               | Sidebar rail wells, tab tracks, skeleton shimmer base |
| `surface-translucent` | `rgba(255,255,255,0.5)` + `1px solid #FFFFFF`           | Fields / soft cards (Nuton `field` 2:722)             |
| `overlay-dark`        | `#111111` @ 10%                                         | Image overlays (15:1233)                              |

**Decorative background blobs** (large, `blur ~150`, low opacity — node 17:3036):

- `#FF2DAB` (pink) @ 0.4 · `#9BC1FB` (blue) @ 0.6 · `#BDEBFF` (cyan) @ 0.6

Blobs carry atmosphere. Do not introduce cream/sand body backgrounds (PRODUCT anti-reference).

### 2.3 Accents & semantic (exact, per-node)

| Token                            | Hex                | Usage / source                                                                                                                                 |
| -------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `chip` (violet)                  | `#BEA1FE` @ 30% bg | Tag/chip fill (`tag` 141:1736)                                                                                                                 |
| `chip-text`                      | `#7C6F97`          | Tag/chip label                                                                                                                                 |
| `progress` (blue)                | `#55ACEE`          | Progress fill (15:1164)                                                                                                                        |
| `accent`                         | `#55ACEE`          | Alias of progress — fills, icons, focus of attention. **Not for text:** ~2.4:1 on white; text links use `--play-selected-ink` `#1A5FA3` (§6.1) |
| `progress-track` / `accent-soft` | `#C3D9FD`          | Progress track; soft accent wells                                                                                                              |
| `thumb-violet`                   | `#DDACE5`          | Thumbnail placeholder (15:1162)                                                                                                                |
| `thumb-periwinkle`               | `#D6DBFD`          | Thumbnail placeholder (10:890)                                                                                                                 |
| `star` (amber)                   | `#FFC700`          | Rating star                                                                                                                                    |
| `streak` (flame coral)           | `#F3705A`          | Streak ring/label — matches `flame.png` outer tip; **not** `danger`                                                                            |
| `streak-core` (flame yellow)     | `#FFD15C`          | Soft highlight from `flame.png` core                                                                                                           |
| `streak-soft`                    | `#FFE8E2`          | Soft wells behind streak day slots                                                                                                             |
| `like-inactive`                  | `#666666`          | Heart outline, default                                                                                                                         |
| `like-active` (pink)             | `#FF2DAB` family   | Wishlist when liked                                                                                                                            |

> Emphasis = play-ledge CTA (`#55ACEE`) + black/`#111` for text and nav chrome + soft pastel accents.

### 2.4 Semantic state tokens

| Token             | Hex       | Usage                                                                                |
| ----------------- | --------- | ------------------------------------------------------------------------------------ |
| `danger`          | `#b42318` | Error/destructive — ≥4.5:1 on white                                                  |
| `success`         | `#2e7d54` | Positive/upward — ≥4.5:1 on white. Downward analytics use `secondary`, **never** red |
| `focus-ring`      | `#1d6fbf` | Keyboard focus — ≥3:1 for UI indicators                                              |
| `error-container` | `#ffdad6` | Error icon circle background                                                         |

Errors use `danger` — not `like-active`. Countdown is calm (not alarm-red).

### 2.5 Light / dark theme

**Default is light.** Cookie `mentor-theme=light|dark` (no cookie → light). Do not follow `prefers-color-scheme` unless a later product decision adds a `system` value.

**Light canvas:** `#FFFFFF` + the decorative blobs in §2.2. That _is_ the login-page atmosphere (`BackgroundBlobs` in the locale layout). Do not add a page-level backdrop-filter / glass wash.

**Dark canvas:** soft charcoal, not terminal black (`#000`).

| Token                            | Dark                     | Usage                                     |
| -------------------------------- | ------------------------ | ----------------------------------------- |
| `bg`                             | `#12141A`                | Screen base (blobs sit behind, dimmed)    |
| `surface`                        | `#1A1D24`                | Cards / sidebar mix                       |
| `surface-container`              | `#242833`                | Wells, rails, skeleton base               |
| `surface-translucent`            | `rgba(26,29,36,0.62)`    | Soft fields                               |
| `border`                         | `rgba(255,255,255,0.10)` | Chrome hairline                           |
| `main`                           | `#F4F4F5`                | Headings, active nav                      |
| `body-text`                      | `#D4D4D8`                | Body — ≥4.5:1 on `bg`                     |
| `secondary-text`                 | `#A1A1AA`                | Meta / inactive                           |
| `btn`                            | `#F4F4F5`                | Nav pill / compact chrome fill (inverted) |
| `btn-label`                      | `#12141A`                | Label on `btn`                            |
| `chip-text`                      | `#C4B8E0`                | Chip label on dark                        |
| `progress-track` / `accent-soft` | `#2C3D56`                | Soft accent wells                         |
| `streak-soft`                    | `#3A2A28`                | Streak day wells                          |
| `danger`                         | `#F28B82`                | Error — ≥4.5:1 on `bg`                    |
| `success`                        | `#6BC49A`                | Positive — ≥4.5:1 on `bg`                 |
| `focus-ring`                     | `#7EB6E8`                | Keyboard focus                            |
| `error-container`                | `#3D2422`                | Error icon well                           |

Blob hues stay (`#FF2DAB` / `#9BC1FB` / `#BDEBFF`). Dark opacities: pink 0.14 · blue 0.20 · cyan 0.18.

**The toggle itself.** In the desktop sidebar footer the switch is a pendant lamp with Puhu
reaching for its pull cord (`ThemeLamp`). **Dark is the lit state** — the warm cone only paints on
the charcoal canvas; light mode leaves the shade matte. Its palette is a scoped `--lamp-*` family
(`shade`, `shade-rim`, `glow`, `cord`) declared on `.mentor-theme-lamp` in `globals.css`, because
lamp hardware is not a product surface and must never leak into the token set above. Every other
toggle slot keeps the plain Sun/Moon icon button.

**Runtime:** `html.dark` overrides the same `--color-*` CSS variables. New UI must use those tokens — never `bg-white`, `#fff`, or `dark:bg-black`. Tailwind `dark:` is an escape hatch only when a value cannot be a token.

**Does not follow theme:** `--notebook-*` (physical paper), `.weekly-recap-theme` (celebration palette), vision-board canvas (user collage), `.premium-paywall-theme` (scoped dark paywall moment — charcoal tokens from this table so the sheet does not flip with the cookie; blob opacities use the light-canvas values in §2.2 so the top glow reads; plan tiles use `--paywall-plan-radius: 24px`), `.session-focus-theme` (immersive focus/break overlay — charcoal tokens so `html.dark` does not invert the atmosphere art; blobs use light-canvas opacities; optional `/visuals/session-focus-bg.webp`).

**Play CTA (global, 2026-09-18):** `@mentor/ui` `Button` is the play ledge on every surface (welcome, onboarding, auth, `(app)`, `(coach)`). Tokens on `html`: `--play-cta` `#55ACEE`, `--play-cta-ink` `#ffffff` (6.6:1; white would be 2.4:1), `--play-cta-edge` `#3B8FD0` 4px, `--play-radius` 16px. `primary`/`accent` = filled ledge; `secondary`/`soft`/`ghost` = outline ledge (`--play-line` + `--play-selected-ink`). `--color-btn` is not this CTA.

**Play wells + selected fill (global, 2026-09-20):** `--play-selected` and `--play-well-{blue,peri,violet,coral,pink}` moved from `.onboarding-play-theme` to `html` (dark values on `html.dark`). The panel's quest rows and path nodes speak the same language as the onboarding choice cards, and a token that two surfaces share does not belong to one of them.

**Premium identity (global, 2026-09-20):** `--premium-ring-from` `#2F55D4` → `--premium-ring-to` `#F2B544` (the cape-blue → clasp-gold avatar ring), `--premium-badge-bg` `#1E2A5A` with `--premium-badge-ink` `#FFD76A` (gold on night blue, ~9:1, so the 11px label holds). Dark lifts the ring's blue end to `#7E9BFF`. See §7 for how they are used.

**Coach accent (global, 2026-09-21):** `--coach-accent` `#26377F`, `--coach-accent-soft` `#E6E9F7`, `--coach-accent-ink` `#1F2C66` on `html` in `@mentor/ui` `theme.css` (dark: `#8FA2EE` / `#252B40` / `#C3CCF5`). Ink blue means "a human coach did this", on both sides: the coach's workspace chrome (role badge, avatar, row actions, program progress) and, on the student panel, the coach mark on assigned path nodes, the coach's avatar and the coach's note (§6.1). It started scoped to `.coach-workspace` (2026-09-20) and moved to `html` because a student surface could not reach it. On ink blue, labels use `--color-bg` (white in light, charcoal in dark — the lifted dark accent needs the dark label). The primary CTA stays the play ledge, so "the blue button starts work" holds in both roles. The navigation stays role-neutral (2026-09-26): the same active tab and sidebar tone for a coach as for a student (§6 Tab bar); the role badge carries the coach's identity.

**Welcome + onboarding play surface (`.onboarding-play-theme`, 2026-09-16):** choice cards, 800-weight questions, artwork chrome on `/` and `/onboarding`. Remaining `--play-*` (shine, frost, scrim, lamp window, `--play-sheet-radius` 28px) stay scoped here. Surfaces still follow `html.dark`; chrome that sits on artwork keeps one look.

**Coach workspace (`(coach)` / `/kocluk`):** same tokens, type scale and panel language as `/panel` (Nunito, play-ledge `Button`, blob canvas, §6.1 cards, rows and frame), plus the coach accent above. What the coach's screens add: the `.coach-signals` hues (the four flag dots) and the side panels' inset groups in `coach-ui.tsx`. The old `.coach-large-title`…`.coach-caption` scale is gone (2026-09-25). Not a second brand.

**Activity ramp (2026-09-24):** `--chart-activity-1/2/3` (light `#55ACEE` / `#3B8FD0` / `#1A5FA3`, dark `#2F6FAE` / `#3F95D8` / `#94C6F4`), an ordinal ramp for a day's focus minutes: 1–29, 30–89, 90+ minutes; zero is `--play-track`, a day still to come is a dashed `--play-line` frame. Checked with the dataviz validator on both surfaces. Colour is never alone: every drawing carries its numbers in a sentence for screen readers and a key beside it.

---

## 3. Typography

- **Headings / Body / UI:** **Nunito** with `latin-ext` (ç ğ ı İ ş ö ü) — the **variable** face (200–1000),
  loaded without a weight list. Plus Jakarta Sans shipped as four static weights (400–700), so every
  800/900 in the codebase silently rendered at 700; the play ledge and the panel's numbers need those
  weights to be real. Rounded terminals also carry the companion tone at small sizes (2026-09-20).
- **Numerals are uniform width by default** in Nunito (measured: "111" and "000" match at 400/800/900),
  so counters and countdowns do not jitter; `tabular-nums` stays on numeric data as intent, not as a fix.
- Product register: fixed px/rem scale (not fluid clamp display). One family is correct.

**The panel scale (2026-09-21, app-wide).** It replaces the Nuton H1–H5 table (32/700, 20/600,
16/500 …), which rendered a thinner, looser product than the one the panel established. Steps that
Tailwind does not ship are `@theme` tokens in `@mentor/ui` `theme.css`, so they are utilities
(`text-caption`), never arbitrary values (`text-[13px]`).

| Role       | Class                   | Size    | Weight                                   | Where (panel reference)                                |
| ---------- | ----------------------- | ------- | ---------------------------------------- | ------------------------------------------------------ |
| Display    | `text-display`          | 28      | 800, `tracking-[-0.01em]`                | Page title — "Günaydın, Selin"                         |
| Title      | `text-xl sm:text-title` | 20 → 22 | 800                                      | Hero heading — "Bugün 4 adım var. Sıradaki 25 dakika." |
| Card title | `text-base`             | 16      | 800                                      | Card headers — "Günlük görevler", "Yolculuğun"         |
| Button     | `text-base sm:text-lg`  | 16 → 18 | 800                                      | Play ledge (16 on phones so a task title fits)         |
| Body       | `text-body-sm`          | 15      | 600 (800 for list titles and text links) | Companion bubble, community rows, "Planı düzenle"      |
| Row title  | `text-sm`               | 14      | 800                                      | Quest / perk rows, mood prompt                         |
| Caption    | `text-caption`          | 13      | 600–800                                  | Meta lines, path node labels (800), card-side counts   |
| Small      | `text-xs`               | 12      | 600–800                                  | Node meta, reward labels (+5 XP)                       |
| Micro      | `text-micro`            | 11      | 800 · 900                                | Weekday labels · PREMIUM badge (`tracking-[0.06em]`)   |

Token line-heights: display 1.2 · title 1.3 · body-sm 1.55 · caption 1.45 · micro 1.2; titles may
tighten further with `leading-snug`/`leading-tight`.

- **Weights:** 600 reading text, 700 emphasis in meta, 800 titles/labels/buttons, 900 numbers that
  carry a moment (streak count, countdown) and badges. Nothing below 400; Nunito thins out fast.
- **Upper case is written, never styled.** CSS `uppercase` under `lang="tr"` turns I into İ, so
  "PREMIUM" is upper case in the messages file. (The mobile tab bar is icons only; it has no labels.)
- **Desktop sidebar nav** 16 / 400 → 700 active, sentence case.

Text colors: headings `#111`, body/value `#333`, meta/secondary `#666`.

**Numeric data** (XP, net, rights, countdown digits): use `font-variant-numeric: tabular-nums`.

Long Turkish copy: `text-wrap: pretty`. Multi-line H1 only: `text-wrap: balance`.

---

## 4. Spacing & Layout

- **Grid base:** 4 px. Steps: 4 · 8 · 12 · 16 · 20 · 24 · 32.
- **Screen gutter:** 20 px mobile; **20–32 px** at `lg` (≥1024).
- **Fixed bars:** Status Bar 44 h · Top Nav 64 h (avatar + greeting) · Floating tab pill ~60 h (+ small Koç overhang; content `pb` ≈ 80 + safe-area) · Home Indicator 34 h.
- **Field / Primary button:** 335×60 · **List item:** 335×56.

**Page max-width contract (desktop):**

| Surface                      | Max width               |
| ---------------------------- | ----------------------- |
| Hub / panel / plan / analiz  | `max-w-5xl`–`max-w-6xl` |
| Form / profile / chat column | `max-w-2xl`–`max-w-3xl` |

**Page frame (the panel's, app-wide — `PANEL_MAIN_CLASS` / `PANEL_GRID_CLASS`):**

- `max-w-6xl`, gutters **20 / 32 / 40 px** (`px-5 sm:px-8 lg:px-10`), top/bottom 16 px (32 at `lg`).
- Sections stack with **20 px** gaps (`gap-5`); card padding **20 px** (`p-5`), hero 20 / 28 px.
- **≥1280 px: main column + 340 px right rail.** Main holds the page's story (greeting, hero,
  what happened, people); the rail holds status and upkeep (level, membership, quests, countdown,
  goal).
- **<1280 px: one column in reading order** — the order a phone user needs, which is not "main,
  then rail". The panel's is: mood → hero → daily quests → membership → countdown → last week →
  coach → community → goal → journey.
- The switch is made in JS (`matchMedia("(min-width: 1280px)")`) rather than CSS `order`, so every
  card mounts once and **DOM order always equals visual order** (keyboard and screen-reader order
  follow what is on screen).

---

## 5. Radius & Elevation

- **Radius: three values, nothing else.**
  - `--radius-card` **10 px** — cards, fields, chips, thumbs, icon wells, inline rows (chest row,
    coach note), menus, close buttons.
  - `--play-radius` **16 px** — play ledges (filled and outline), the companion bubble, the mood row.
  - **Full round** — path nodes, avatars, dots, badges, progress bars.
- **Cards are solid:** `--color-surface` + `--color-border` hairline + `shadow-card` (`PANEL_CARD`).
  `surface-translucent` is for fields and chrome that sits over art, not for content cards.
- **Shadow family** (same tint `#254996` @ 10% — not multi-layer soft-UI stacks):

| Token               | Value                                  | Usage                                  |
| ------------------- | -------------------------------------- | -------------------------------------- |
| `shadow-card`       | `0px 4px 10px rgba(37, 73, 150, 0.10)` | Default cards, fields, floating chrome |
| `shadow-card-hover` | `0px 6px 14px rgba(37, 73, 150, 0.10)` | Hover / elevated interactive cards     |

---

## 6. Components (Nuton specs + Mentor primitives)

**Primary button** (`@mentor/ui` `Button`): play ledge. Fill `--play-cta`, ink `--play-cta-ink`, 4px `--play-cta-edge`, radius 16, ExtraBold 18 (16 on phones when it carries a title). Press `translateY(4px)` into the ledge. Secondary = outline on `--play-line`. Disabled = `--play-track`. `--color-btn` is nav/compact chrome only. A ledge that navigates is a `Link` with the same classes (panel `LEDGE` in `today-path-card.tsx`), never a button wrapped in a link.

**Text field** (`field` 2:722): translucent surface + white border + `shadow-card`.

**Tab bar** (mobile): floating pill, icons only; active = bold `#111`. The role's home sits in the center as an elevated black FAB: **Koç** for a student, **Öğrencilerim** for a human coach; every other item and the active look are the same for both roles. Desktop sidebar: sentence-case labels, one active tone for every role (a coach is told by the "Koç" badge under their name, never by the navigation's colour); Koç is a floating bottom-right Puhu coach FAB (not in the sidebar). A page's floating add button above the pill uses the same black (`--color-btn`) in both roles.

**Tag / chip** (`tag` 141:1736): violet @30%, chip-text `#7C6F97`.

**Card discipline:** Cards group interaction or meaningful clusters. **Nested cards are forbidden** (a tinted row inside a card — chest row, coach note — is a row, not a card: no shadow, no border). Content cards are solid (§5); `@mentor/ui` `Card` with `solid` is the same surface as `PANEL_CARD` (it pads 24 px, the panel 20 px — use 20 on new work).

**EmptyState** (web): optional `/visuals/...` image + optional Puhu + title + one CTA. Missing asset → pastel blob placeholder (layout stable).

**PuhuImage** (web): size tokens `sm` / `md` / `lg` → 40 / 72 / 120 px (numeric override allowed for special layouts).

Other Nuton library symbols (course cards, list items, FAQ, etc.) remain reference for density and padding — map to product content per §9.

### 6.1 Panel patterns (reference components, 2026-09-21)

The building blocks every screen reuses. Specs are the panel's. Shared code lives in
`apps/web/src/components/panel/` (classes, `CompanionBubble`, `ProgressLine`, `useWideLayout`); the rest
stays in `apps/web/src/app/[locale]/(app)/dashboard/_components/`. `/analiz` is the second screen built
from them (2026-09-22).

| Pattern                 | Spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Panel code                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Card + header**       | `PANEL_CARD` (§5). Header row: title 16/800 left; count (caption, `tabular-nums`) or text link right.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `components/panel/panel-styles.ts`                        |
| **Text link**           | 14–15/800, `--play-selected-ink`, underline on hover only, trailing 16 px chevron. The only secondary action style next to a ledge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `PANEL_TEXT_LINK`                                         |
| **Icon well**           | 40 px square, `--radius-card`, 20 px icon. Fill by what the row is about: plan → `--play-well-peri`, focus → `--play-well-blue`, mood → `--play-well-coral`, other → `--play-well-violet`; done → `--color-success` at 16 % on surface with success ink.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `daily-quests-card.tsx`                                   |
| **Progress bar**        | 8 px, full round, track `--play-track`, fill `--play-cta`, complete `--color-success`. Always `role="progressbar"` with a label. Count ("20/25") sits on the title line, not on the bar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `components/panel/progress-line.tsx`                      |
| **Path (Bugünün yolu)** | The day as nodes on a 4 px connector (`--play-cta` up to the current node, `--play-track` after). Done 48/56 px (phone/desktop) filled ledge + check; **current** 64/72 px with an 8 px `--play-selected` halo, a filled play icon and a "Sıradaki" tip above; upcoming 48/56 on `--play-track`. Labels under nodes: title 13/800 (two lines max), meta 12/600 (duration, subject, "koçundan"). Up to 5 task nodes; earlier done tasks fold into one "✓ N" node, the rest into "+N" (→ plan). Ends with the weekly **chest** (streak-core tints; glows when opened). Empty day: one dashed "İlk adım" node. **A node opens a menu** (start a session / mark done / undo); it never acts on the tap. Phones scroll the row sideways. | `today-path.tsx`, `today-path-model.ts`                   |
| **Coach mark**          | 24 px `--coach-accent` disc with a graduation cap, top-right of a node or avatar, 2 px surface ring. Means "your human coach assigned this".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `today-path.tsx`                                          |
| **Week band**           | Monday → Sunday from `streak.week` (server-derived, never computed on the client). Dot 24/30 px: active = flame on `--color-streak-soft`, frozen = snowflake on `--color-progress` 18 %, missed = `--play-track`, not-yet = dashed `--play-line`; today = 2 px `--color-streak` ring. Right: "N gün seri" 16/900 + today's focus vs goal 12/700; wraps under the days on phones. Sits as the hero's bottom band on a `--play-track` 35 % tint.                                                                                                                                                                                                                                                                                      | `week-band.tsx`                                           |
| **Companion bubble**    | Puhu 72 px + bubble (`--play-selected`, `--play-radius`, 16/12 padding), one line at 15/600. AI variant: `--premium-ring-from` 10 % fill and a "Koçundan bugün" label with Sparkles; long notes fold to three lines, only when at least two would hide (the toggle is taller than one line). A free user's nudge sits inside the bubble (lock nudge below).                                                                                                                                                                                                                                                                                                                                                                         | `components/panel/companion-bubble.tsx`                   |
| **Hero**                | Bubble → title (20→22/800) → path → one ledge + one text link → an ambient line (13/700 with a `--play-cta` dot: "Şu an 128 kişi seninle çalışıyor") → week band. The screen's single primary action lives here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `today-path-card.tsx`                                     |
| **Mood row**            | "Bugün nasılsın?" + five faces (40/44 px buttons, `aria-pressed`). One tap saves; the selected face gets `--play-selected` + a 2 px inset `--play-cta` ring, the others dim to 60 %. Never an auto-opening modal. On desktop it shares the row with the page title; on phones it is a bordered strip under the top bar.                                                                                                                                                                                                                                                                                                                                                                                                             | `greeting-row.tsx`                                        |
| **Announcement card**   | Several announcements in one card, **stacked in one grid cell** so the card is as tall as its tallest slide and rotation never moves the cards below. Slide: art (an 80 px tile beside the text below 1280 px, a 112 px band above it in the rail; art is static — no looping SVGs in a card) + optional title (16/800) + message + small ledge. Rotates every 5 s, pauses on hover/focus, dots are buttons, each slide closes on its own for the tab session. Order: a campaign (it ends) → the daily coin offer (it resets) → the trial (always there). The free user's only commercial slot.                                                                                                                                     | `components/top-banner.tsx`, `membership-card.tsx`        |
| **Perks card**          | What a member has, as rows (well + title + caption + chevron) under a title with the PREMIUM badge; "Aboneliğini yönet" as the text link. Replaces the announcement card for members.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `membership-card.tsx`                                     |
| **Coach card**          | `--coach-accent` initials avatar, "Koçun" caption over the name, "Programı gör" link; the coach's standing note in a `--coach-accent-soft` block with `--coach-accent-ink` text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `my-coach-card.tsx`                                       |
| **List rows**           | Well + title (15/800, two lines) + meta (13, `--color-secondary`: room · replies · time), hairline between rows, the whole row is the link.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `community-topics-card.tsx`                               |
| **Level card**          | "Yolculuğun": `JourneyLevelCompact` (level, XP to next, bar) + the freeze allowance line in `--play-selected-ink` with a snowflake.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `journey-card.tsx`                                        |
| **PREMIUM badge**       | 22 px pill, `--premium-badge-bg` / `--premium-badge-ink`, 11/900, 0.06 em tracking, upper case written in the copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `components/premium/premium-badge.tsx`                    |
| **Lock nudge**          | The feature's own words (14/800, `--play-selected-ink`) › chevron › PREMIUM badge; the chevron stays with the label's last word and the badge wraps to its own line. Never a padlock, blur or fake preview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `components/premium/premium-lock-nudge.tsx`               |
| **Skeletons**           | A page skeleton only while auth settles (`dashboard-content-skeleton.tsx`); after that each section shows its own placeholder in place.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `dashboard-content-skeleton.tsx`                          |
| **Reading column**      | Long-form text (blog posts, legal documents): `max-w-2xl`, no card around the body. Body 16 → 18 / 600 in `--color-body` (leading 1.75), h2 20 → 22 / 800, h3 18 / 800, links `--play-selected-ink` 800 underlined, quotes a `--play-selected` block (never a side stripe), list markers `--color-secondary`. Markdown and sanitized HTML share it.                                                                                                                                                                                                                                                                                                                                                                                 | `components/article-markdown.tsx`, `.mentor-article-body` |
| **Trust row**           | Provenance under a post's title (guardrail §4 #1): ShieldCheck on `--color-success` 16 % over surface, "Doğrulanmış içerik", then source ↗ · last verified · updated (13/700) and one line on how updates happen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `knowledge/[slug]/_components/article-trust-row.tsx`      |
| **Category well**       | A post without a cover shows its category's well + a Lucide icon instead of an empty box: Başvuru `--play-well-blue` + ClipboardList, Sınav süreci `--play-well-peri` + CalendarClock, Genel `--play-well-violet` + BookOpen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `knowledge/_components/article-cover.tsx`                 |
| **Koçun turu**          | The coach home's hero: the path's anatomy for people. Students the coach saw today (ink `--coach-accent` ✓ nodes), then the ones waiting in the server's order, the next one big with the "Sıradaki" tip; past five fold into "+N", the end node says "Tur tamam". One ledge opens the next student ("Zeynep'e bak"); a node opens a menu (open, İlgilendim, undo). The finish plays once a day. The order goes to `sessionStorage` so the student page can say "Sıradaki".                                                                                                                                                                                                                                                         | `(coach)/students/_components/coach-round-*.tsx`          |
| **Activity strip**      | A student's last 14 days as 12 px cells on the activity ramp (§2.5), oldest first, today last, one sentence for screen readers; the key sits once above the rows. Roster rows only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `(coach)/_components/activity-strip.tsx`                  |
| **Week filmstrip**      | The student page's hero: Monday → Sunday as seven columns. Each has the minutes (a bar, full at two hours, in `--chart-activity-2`; a track stub on an empty day; a dashed frame on a day to come), the coach's tasks as 20 px ink marks (done filled with a check, waiting a ring, future dashed) and the student's own as 10 px dots, max three marks then "+N". Today is a `--play-selected` column. Every day is one sentence for screen readers.                                                                                                                                                                                                                                                                             | `(coach)/students/[studentId]/_components/week-filmstrip.tsx` |
| **Rhythm grid**         | Four calendar weeks (Monday-first rows under weekday heads) of 30 px cells on the activity ramp, days to come as frames; beside it the drawn days' total (display) with active days, and the streak in a flame well. Totals cover only the drawn cells.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `(coach)/students/[studentId]/_components/rhythm-card.tsx` |

---

## 7. Iconography

- Thin line icons (Lucide / Feather-style): ~24–28 px nav box.
- Active `#111`, inactive `#666`. Like/heart pink when active; star amber.
- **No emoji as UI icons.** Soft-3D visuals are not substitutes for icons in chrome.
- **Premium identity (revised 2026-09-21):** the **PREMIUM badge** (§6.1) is the mark — the cape's
  clasp, gold on night blue. It replaces the crown on every "unlock" affordance (lock nudges) and
  heads the member's perks card; Faz 3 adds it beside "Mentor" in the sidebar with the
  cape-blue → clasp-gold avatar ring (`--premium-ring-*`). Until then Lucide `Crown` in
  `--color-star` stays next to the display name. Do not overlay the avatar with icons, do not use a
  blue verification tick (that is email verified), no prize ribbons or saturated-gradient medals.
  Feed and comment avatars stay unmarked — membership is identity chrome, not a ranking stamp.
- **Coach mark:** Lucide `GraduationCap` in a 24 px `--coach-accent` disc (§6.1). Only for work a
  human coach assigned; AI suggestions are never marked as coach work.
- **Custom glyphs** only where Lucide has no fit, drawn at the same 2 px stroke (e.g. the weekly
  chest, `ChestIcon` — a gift box reads as a present, not a reward you earned).

---

## 8. Visual language (Puhu + visuals)

### 8.1 Two asset families, one camera

| Family              | Role                           | Path                                                          |
| ------------------- | ------------------------------ | ------------------------------------------------------------- |
| **Puhu**            | Companion / emotion            | `apps/web/public/mascot/puhu/`                                |
| **Subject soft-3D** | Task / empty / category scenes | `apps/web/public/visuals/` (flat files, no domain subfolders) |

Same light: pastel matte, rounded forms, soft shadow, light ground. Final art is **supplied by design** (not generated in-repo by agents). Agents wire paths and placeholders only.

### 8.2 Puhu size scale

| Token | px  | Typical use                            |
| ----- | --- | -------------------------------------- |
| `sm`  | 40  | Inline companion, greetings, quest row |
| `md`  | 72  | Coach bubble, dialogs, toasts          |
| `lg`  | 120 | Empty / nudge hero                     |

### 8.3 Usage patterns (max density)

1. **Inline companion** — small Puhu in chrome.
2. **Empty / nudge** — `visuals/*` and/or Puhu + one sentence + one CTA.
3. **Moment hero** — rare (Koç hub, milestones); full-bleed poster OK.
4. **Subject thumb** — optional small scene beside chips/knowledge cards.

**At most one banner-class visual per page viewport.** Do not put art on every card.

### 8.4 Banner types

| Type                | When                                      | Content                                                                                                                               |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `CompanionBubble`   | A screen's hero line                      | Puhu + one first-person line (§6.1); AI lines carry their label                                                                       |
| `AnnouncementCard`  | Free user's commercial + offer slot       | Rotating stacked slides (§6.1): campaign **or** trial, plus the daily coin offer. One per screen, never beside another commercial ask |
| `WeeklyRecapBanner` | Last week's story is ready                | The coral recap banner with its exported shapes (feature palette, §1) — kept as is                                                    |
| `CompanionEmpty`    | Empty list/chart                          | `visuals/` and/or Puhu + copy + CTA                                                                                                   |
| `MomentHero`        | Koç hub / milestone                       | Full-bleed Puhu poster                                                                                                                |
| `PromoSoft`         | _Legacy_ — coach home community card only | Pastel surface + short copy; migrate to a plain §6.1 card when that screen is touched                                                 |

**Retired 2026-09-21:** `QuestBanner` (the panel's quests are a card, "Günlük görevler"),
`CampaignPromo` (its trial copy is now a slide of the `AnnouncementCard`; the cyan→slate
`.premium-campaign-banner` wash is deleted) and the one-line top strip (moved into the card).

### 8.5 `visuals/` naming

Flat files under `public/visuals/`, WebP preferred, e.g. `plan-empty.webp`, `analiz-empty.webp`. See `apps/web/public/visuals/README.md`.

### 8.6 Bans

- Stock photography
- Illustration on every card
- Coin / economy in the AI chat zone
- Alarm / shame banners
- Tiny uppercase eyebrows on every section
- Gradient text, glassmorphism-as-default, side-stripe accent borders
- Rows of metric tiles restating numbers the screen already shows (§1 rule 2)
- Modals that open themselves on every visit (the auto mood wheel was removed for this); one-shot
  moments — a new campaign's single announcement, a level-up — open once each, never stacked
- A second filled ledge, or a second commercial ask, on the same screen
- Looping animated art inside a card (static art; motion belongs to moments, §9.1)

---

## 9. Motion scale (rich, guarded)

| Layer       | Examples                                                                          | Duration                                 |
| ----------- | --------------------------------------------------------------------------------- | ---------------------------------------- |
| **Micro**   | Hover → `shadow-card-hover`, press ~0.98 scale, focus ring, toggle, progress fill | 150–250 ms                               |
| **Chrome**  | Tab/segment, drawer, sheet, toast                                                 | 150–250 ms                               |
| **Content** | List/card stagger, chart draw-in                                                  | Stagger short; no long page choreography |
| **Ambient** | Optional slow blob drift (`transform` / `opacity` only)                           | Very slow; off under reduced-motion      |
| **Moment**  | Session done, streak milestone, Puhu bounce                                       | ≤600 ms                                  |

**Rules:**

- Convey state or feedback — not decoration for its own sake.
- Prefer `transform` / `opacity`. Do not animate layout width/height.
- Ease-out (quart/quint/expo). No elastic/bounce easing.
- **`prefers-reduced-motion: reduce`:** crossfade or instant; never gate content visibility on entrance animation.
- No orchestrated full-page load “shows.”
- **Checkout success** shares the achievement confetti lottie (`/lottie/confetti.lottie`, play once) plus `/animation/success.svg`. Reduced-motion skips both and uses a static `--color-success` check.
- **Press:** ledges sink 4 px into their edge, path nodes 2 px (120 ms, shadow collapses with it).
- **Rotation** (announcement card): 5 s per slide, 300 ms crossfade with a 12 px slide, paused
  while hovered or focused; reduced motion swaps instantly. Only content that is truly several
  things may rotate — never to fit more into a slot.
- **Menus** open in 160 ms (fade + slight vertical scale) from their trigger.

Shared helpers: `apps/web/src/lib/stagger-motion.ts`. Overlay enter/exit lives in web `globals.css`.
Shared transitions.dev recipes + tokens: `packages/ui/src/transitions/` (imported via `theme.css`); React primitives from `@mentor/ui` — see [`docs/features/motion.md`](./docs/features/motion.md).

### 9.1 Motion personality (2026-07-26)

Mentor is a **learning app**, not a productivity tool. Effort deserves to be felt, so motion is not
uniformly restrained — it is loud where progress happens and quiet where work happens.

> **"Calm" in this document is never a motion rule.** It appears only in the anxiety guardrails
> (§2.4 countdown not alarm-red, §11 error copy) and describes _tone toward an exam student_, not
> animation budget. Do not cite it to argue against an animation.

| Layer           | Surfaces                                                                                                                                                                     | Expression                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Celebration** | Streak milestone (`streak-celebration.tsx`), quest / XP reward (`economy-quests-card.tsx`), session done (`session-done-state.tsx`), coin earn, weekly recap, Puhu reactions | Expressive and playful: scale pops, travel, staggered reveals, confetti-class one-shots, mascot motion. Owns the `Moment` row (≤600 ms) |
| **Progress**    | Progress bars, streak ring, level/XP fills, quest check-off                                                                                                                  | Animate the fill; a completed fill may pop once                                                                                         |
| **Measured**    | Forms, lists, calendar shell, settings, tables, navigation                                                                                                                   | Micro/Chrome only — these are work surfaces; motion states change, it does not perform                                                  |

**Rules (in addition to §9):**

- Celebration is **event-driven and one-shot**. Never loop it, never gate content behind it.
- One celebration at a time — do not stack a streak toast onto a quest reward.
- Expressiveness comes from scale, travel, stagger and colour. The **no elastic/bounce easing** rule
  in §9 still stands; revisit it as its own decision if a moment truly needs overshoot.
- `prefers-reduced-motion: reduce` still wins everywhere, celebration included: keep the reward
  (copy, colour, badge), drop the movement.

Existing exception: `.mentor-puhu-bounce` (globals.css) loops a 2 s idle bob for the mascot — a
deliberate presence cue, disabled under reduced motion.

**The coach's screens (2026-09-26, Durak F).** `/kocluk` is a Measured work surface with two
Progress moments of its own. Classes live in `(coach)/_components/coach-theme.css`; framer defaults
come from `CoachMotionConfig` (`reducedMotion="user"`); constants in `components/mentorship/coach-motion.ts`.

| Where | Motion | Budget |
| --- | --- | --- |
| Round progress (marking a student) | ✓ draws on the node (`CoachCheck`), the connector fills (`PathItem animateReach`), the next node grows from its centre (`.coach-node-grow`), the one "Sıradaki" tip glides (`layoutId`), the count pops (`CountPop`) | ≤400 ms |
| Charts | Draw once when their section arrives: week bars rise, rhythm cells wave diagonally, mood and subject bars grow, progress fills from zero (`.coach-draw-*`); the 14-day row strips stay still | ≤400 ms |
| Sections | Skeleton → content fade (`.coach-reveal`), bubble lines rise in when they replace another (`CompanionBubble reveal`) | 250 ms |
| Success | ✓ on the button or tag (`useSuccessMoment`), then the panel closes or the tag turns; the toast still shows | ≈350 ms |
| Panels | Day tint slides between chips, weeks slide 12 px the way the arrow points, drafts enter and leave, sections open by height | 150–250 ms |
| Pages | `CoachPageTransition`: `nav-forward` (into a student, "Sıradaki") slides left, `nav-back` ("‹ Öğrencilerim") right, 48 px; the chrome stays still; untyped navigation does not slide | 300 ms |

Nothing waits on these: under reduced motion the check shows at once, panels close at once and pages
swap without a slide.

---

## 10. Empty & loading

- **Loading:** page-specific `*-content-skeleton.tsx` using `@mentor/ui` `Skeleton` / `SkeletonGroup` + global shimmer classes — **only while auth settles**. After that the layout paints at once and each section fills in on its own (its own placeholder, or nothing until it has something true to say); no `if (!data) return` gate over a whole page. Data a screen needs goes out in one parallel wave (panel: `use-panel-data.ts`).
- **Empty:** teach the next action (`EmptyState`) — not “nothing here.” The panel's empty day is
  the pattern: one dashed "İlk adım" node, one ledge ("Planına görev ekle"), Puhu saying the first
  step can be small.
- **Error:** calm copy; `danger` for form validity only; soft companion tone for recoverable failures.

---

## 11. Mobile → Desktop Adaptation

- Bottom Tab Bar → **left sidebar** at `lg` (1024px); active `#111`.
  Desktop rail is 240px with sentence-case labels. A top-right `PanelLeft` control
  collapses it to a 52px icon strip (same width as the history rail on seans and vizyon panosu).
  Hover/focus on a rail icon reveals the link name. Preference persists via the
  `mentor-sidebar` cookie (no expanded flash on reload). `/hedef/pano` and
  community keep this collapsed rail visible (do not hide AppNav).
- Single-column → multi-column (main + right rail) at **1280 px** (§4 page frame); between 1024 and
  1279 the sidebar is there and content stays one column.
- **Greeting lives once:** on desktop it is the page title ("Günaydın, {ad}" + date); on phones the
  top bar greets and the page keeps the heading for screen readers only. The sidebar never greets.
- Hover: `shadow-card-hover` on interactive elevated cards; focus: `focus-ring`.

---

## 12. Mapping to Our Product

- Course/product cards → plan items, deneme entries, knowledge articles.
- Ongoing + progress → today’s session / streak / plan progress.
- Comment → AI coach / community (Phase 2).
- Nav → Anasayfa · Plan · Koç · Analiz · Blog · Topluluk · Profil. (Blog was "Bilgi" until 2026-09-23;
  it is a public section — `/blog`, no app shell — reached from the app nav.)
  (Desktop: Koç via floating Puhu FAB, not sidebar; mobile: elevated center tab.)
- Guardrails: calm countdown, no result-ranking shame, encouraging Turkish tone (PRODUCT.md).

### 12.1 Topluluk Discovery V2 record (2026-07-31)

- Tek kullanıcı ürünü **Topluluk**; forum/community teknik sınırı navigasyonda görünmez.
- Hub düzeni: featured discussion + devam/yeni karışımı; ardından Emek Panosu, trend etiketler,
  sırasız destek verenler ve oda önerileri. Upcoming Event yoktur.
- Global feed referansı kart yoğunluğu, sekmeler ve bağlamsal rail için kullanılır; oda içi CHAT
  mevcut düz kanal ritmini korur. Slack/Discord referansından yalnız grup başlıkları, breadcrumb ve
  katkı verenler deseni alınır; presence/typing/realtime kanal davranışı alınmaz.
- Kartlar açık yüzey, `main/body-text/secondary-text`, `chip`, `btn`, 10px radius ve Nunito
  tokenlarını kullanır. Referans görsellerin font/renk sistemi kopyalanmaz; negatif oy yoktur.
- Mobilde sol oda drawer'ı ve native modal focus trap; desktopta global feed/oda/detay için
  bağlamsal rail. Etkileşim hedefleri en az 44px, focus ring görünür, motion yalnız ölçülü
  Micro/Chrome katmanındadır ve reduced-motion kurallarına uyar.

---

## 13. Open Items / asset backlog

- [x] Turkish glyph coverage — Nunito `latin-ext` (Plus Jakarta Sans until 2026-09-20).
- [x] Desktop breakpoints — `lg` sidebar switch.
- [x] Surface hierarchy + hover shadow + visual/motion language (2026-07-12 evolve).
- [x] Motion personality — celebration vs measured surfaces (§9.1, 2026-07-26).
- [x] Panel as the reference screen — "Bugün" hub, §6.1 patterns, type-step tokens (2026-09-21).
- [x] Analiz converged (2026-09-22): panel frame with past exams in the right column, two views
      (Gelişim · Yanlışlarım) + "Deneme ekle" as a form mode, the improvement loop drawn as a path with
      one ledge, the coach's narration in the bubble for premium, the saved moment in place of toasts.
- [x] Blog converged (2026-09-23): "Bilgi" became the public **Blog** (`/blog`, `/blog/[slug]`, 308 from
      `/bilgi`), one `PublicChrome` for everyone, panel frame, list rows with category wells, the exam card in
      the rail, provenance on top of a post, one ledge said by Puhu, shared reading type (§6.1).
- [x] Coach workspace converged (2026-09-25): `/kocluk` leads with "Koçun turu" and one card of
      student rows with the 14-day strip; the student page with the week filmstrip, the rhythm grid,
      mocks in `/analiz`'s language and a rail for the note, follow-ups and the weekly report; the side
      panels on the panel's scale with one filled button each; the coach type scale retired.
- [ ] **Converge every screen to the panel** as it is touched: plan, topluluk,
      seans, defterlerim, profil/ayarlar, and the coach profile (`/kocluk/profil`). Checklist per
      screen: §1 rules, §3 scale (no arbitrary `text-[Npx]`), §5 radius set, §6.1 patterns.
- [x] §6.1 primitives shared once a second screen needed them: `apps/web/src/components/panel/`, not
      `@mentor/ui`, because the bubble needs `PuhuImage` / `next/image` (2026-09-22).
- [ ] Move the web-independent parts (classes, `ProgressLine`) into `@mentor/ui` when a screen outside
      `apps/web` needs them.
- [ ] Faz 3 identity: sidebar PREMIUM badge, avatar ring, caped Puhu (`puhu-premium` transparent
      export pending).
- [ ] Weekly chest art (soft-3D, closed/open) to replace the line glyph.
- [ ] Map remaining Nuton library screens ↔ Mentor screens (Figma pass).
- [ ] Puhu P0: `thinking` (AI loading), `gentle-error` (soft error toast).
- [ ] P0 visuals (designer upload): `plan-empty.webp`, `analiz-empty.webp`.

---

## 14. Implementation

Tokens + shared React primitives: **`@mentor/ui`** — `theme.css` · `tokens.ts` · `Button` / `TextField` / `Card` / `Chip` / `ProgressBar` / `BackgroundBlobs` / skeletons / overlays.

Web-specific visuals: `PuhuImage`, `EmptyState`, `apps/web/public/mascot/puhu/`, `apps/web/public/visuals/`.

App shell: `apps/web/src/components/app-nav.tsx`.

Reference screen: `apps/web/src/app/[locale]/(app)/dashboard/_components/` — `today-path*.tsx`
(hero, path, model), `week-band.tsx`, `greeting-row.tsx`, `daily-quests-card.tsx`, `membership-card.tsx`

- `components/top-banner.tsx` (announcement card), `components/premium/premium-badge.tsx`,
  `premium-lock-nudge.tsx`. Shared panel parts: `apps/web/src/components/panel/` — `panel-styles.ts`
  (page frame, grid, card, hero, text link, ledge), `companion-bubble.tsx`, `progress-line.tsx`,
  `use-wide-layout.ts`. Second screen on them: `apps/web/src/app/[locale]/(app)/analysis/_components/`.

**Rule:** screens compose tokens/primitives — no magic numbers ([`docs/standards/frontend.md`](./docs/standards/frontend.md)).
