# DESIGN.md — Exam Coaching Platform · Design System

> Status: Living design record · Updated: 2026-07-12  
> Product decisions: [`sinav-kocluk-roadmap.md`](./sinav-kocluk-roadmap.md) · Product register: [`PRODUCT.md`](./PRODUCT.md)  
> **Visual foundation:** **Nuton — Online Learning Mobile App** Figma UI template, **evolved** into Mentor’s own system (companionship platform).  
> Source of truth for base values: Figma file `8lc7t0P5kibfQ7GMzLSl3l` (Dev Mode MCP). Evolve layers (surfaces, visual language, motion) are Mentor-owned and documented here.

---

## 1. Overview

Nuton’s language remains the base: **monochrome-forward** — near-black text and **black primary buttons** on a **white background**, softened by **blurred pastel gradient blobs**, **translucent white cards**, a **blue-tinted soft shadow family**, and **10 px rounded corners everywhere**. Accents are soft pastels (violet chips, blue progress), not a single saturated brand color. Mentor uses **Nunito Sans** for headings and body (Turkish-complete, warm at small sizes).

**Evolve (2026-07-12):** We keep Nuton hex/type/radius. We add surface hierarchy, hover elevation, a documented visual language (Puhu + `visuals/`), rich motion with reduced-motion guardrails, and empty/loading rules. Premium feel comes from craft and companionship — not EdTech purple, cream paper backgrounds, or hero-metric grids.

Base canvas: **375 px** wide. Content column **335 px** → **20 px** side gutters. Desktop: gutters **20–32 px**; page max-widths below.

---

## 2. Color System

### 2.1 Text & core (Figma variables — exact)

| Token | Hex | Usage |
|---|---|---|
| `main` | `#111111` | Headings, titles, primary text, active nav |
| `body-text` | `#333333` | Body copy, input values |
| `secondary-text` | `#666666` | Captions, meta, labels, inactive nav |
| `btn` | `#000000` | Primary button fill |
| `label-dark-secondary` | `#EBEBF5` | Secondary label on dark |

Body text must stay ≥4.5:1 on backgrounds. Do not use colors lighter than `secondary` for readable copy.

### 2.2 Surface hierarchy

| Token | Value | Usage |
|---|---|---|
| `bg` | `#FFFFFF` | Screen base fill (blobs sit behind) |
| `surface` | `#FFFFFF` | Solid cards |
| `surface-elevated` | `#FFFFFF` + `shadow-card` / hover → `shadow-card-hover` | Floating / interactive cards |
| `surface-container` | `#F0EDEC` | Sidebar rail wells, tab tracks, skeleton shimmer base |
| `surface-translucent` | `rgba(255,255,255,0.5)` + `1px solid #FFFFFF` | Fields / soft cards (Nuton `field` 2:722) |
| `overlay-dark` | `#111111` @ 10% | Image overlays (15:1233) |

**Decorative background blobs** (large, `blur ~150`, low opacity — node 17:3036):
- `#FF2DAB` (pink) @ 0.4 · `#9BC1FB` (blue) @ 0.6 · `#BDEBFF` (cyan) @ 0.6  

Blobs carry atmosphere. Do not introduce cream/sand body backgrounds (PRODUCT anti-reference).

### 2.3 Accents & semantic (exact, per-node)

| Token | Hex | Usage / source |
|---|---|---|
| `chip` (violet) | `#BEA1FE` @ 30% bg | Tag/chip fill (`tag` 141:1736) |
| `chip-text` | `#7C6F97` | Tag/chip label |
| `progress` (blue) | `#55ACEE` | Progress fill (15:1164) |
| `accent` | `#55ACEE` | Alias of progress — links, secondary CTAs |
| `progress-track` / `accent-soft` | `#C3D9FD` | Progress track; soft accent wells |
| `thumb-violet` | `#DDACE5` | Thumbnail placeholder (15:1162) |
| `thumb-periwinkle` | `#D6DBFD` | Thumbnail placeholder (10:890) |
| `star` (amber) | `#FFC700` | Rating star |
| `streak` (flame coral) | `#F3705A` | Streak ring/label — matches `flame.png` outer tip; **not** `danger` |
| `streak-core` (flame yellow) | `#FFD15C` | Soft highlight from `flame.png` core |
| `streak-soft` | `#FFE8E2` | Soft wells behind streak day slots |
| `like-inactive` | `#666666` | Heart outline, default |
| `like-active` (pink) | `#FF2DAB` family | Wishlist when liked |

> **No single saturated primary brand color.** Emphasis = black/`#111` (buttons, active) + soft pastel accents.

### 2.4 Semantic state tokens

| Token | Hex | Usage |
|---|---|---|
| `danger` | `#b42318` | Error/destructive — ≥4.5:1 on white |
| `success` | `#2e7d54` | Positive/upward — ≥4.5:1 on white. Downward analytics use `secondary`, **never** red |
| `focus-ring` | `#1d6fbf` | Keyboard focus — ≥3:1 for UI indicators |
| `error-container` | `#ffdad6` | Error icon circle background |

Errors use `danger` — not `like-active`. Countdown is calm (not alarm-red).

---

## 3. Typography

- **Headings / Body / UI:** **Nunito Sans** with `latin-ext` (ç ğ ı İ ş ö ü).
- Product register: fixed rem scale (not fluid clamp display). One family is correct.

| Style | Font | Size | Weight | Line-height |
|---|---|---|---|---|
| H1 | Nunito Sans | 32 | 700 Bold | 1.2 |
| H2 | Nunito Sans | 20 | 600 SemiBold | 1.4 |
| H3 | Nunito Sans | 16 | 500 Medium | 1.7 |
| H4 | Nunito Sans | 18 | 700 Bold | 1.5 |
| H5 | Nunito Sans | 16 | 700 Bold | 1.5 |
| Body | Nunito Sans | 16 | 400 Regular | 1.7 |
| Caption/meta | Nunito Sans | 14 | 400 Regular | 1.7 |
| Small label | Nunito Sans | 12 | 400 Regular | 1.7 |
| Tab label (mobile bottom bar only) | Nunito Sans | 8 | 600 SemiBold | normal · **UPPERCASE** |
| Desktop sidebar nav | Nunito Sans | 14 | 600 SemiBold | 1.4 · **sentence case** |
| Button | Nunito Sans | 18 | 700 Bold | 1.7 · capitalize |

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

| Surface | Max width |
|---|---|
| Hub / panel / plan / analiz | `max-w-5xl`–`max-w-6xl` |
| Form / profile / chat column | `max-w-2xl`–`max-w-3xl` |

---

## 5. Radius & Elevation

- **Radius: `10px`** uniform (buttons, fields, cards, chips, thumbs).
- **Shadow family** (same tint `#254996` @ 10% — not multi-layer soft-UI stacks):

| Token | Value | Usage |
|---|---|---|
| `shadow-card` | `0px 4px 10px rgba(37, 73, 150, 0.10)` | Default cards, fields, floating chrome |
| `shadow-card-hover` | `0px 6px 14px rgba(37, 73, 150, 0.10)` | Hover / elevated interactive cards |

---

## 6. Components (Nuton specs + Mentor primitives)

**Primary button** (`btn` 2:770): bg `#000`, radius 10, label Nunito Sans Bold 18 `#FFF` capitalize.

**Text field** (`field` 2:722): translucent surface + white border + `shadow-card`.

**Tab bar** (mobile): floating pill, icons only; active = bold `#111`. Center **Koç** elevated black FAB. Desktop sidebar: sentence-case labels; Koç is a normal item (no special CTA treatment).

**Tag / chip** (`tag` 141:1736): violet @30%, chip-text `#7C6F97`.

**Card discipline:** Cards group interaction or meaningful clusters. **Nested cards are forbidden.** Inline panel tiles and `@mentor/ui` `Card` share the same radius/shadow tokens.

**EmptyState** (web): optional `/visuals/...` image + optional Puhu + title + one CTA. Missing asset → pastel blob placeholder (layout stable).

**PuhuImage** (web): size tokens `sm` / `md` / `lg` → 40 / 72 / 120 px (numeric override allowed for special layouts).

Other Nuton library symbols (course cards, list items, FAQ, etc.) remain reference for density and padding — map to product content per §9.

---

## 7. Iconography

- Thin line icons (Lucide / Feather-style): ~24–28 px nav box.
- Active `#111`, inactive `#666`. Like/heart pink when active; star amber.
- **No emoji as UI icons.** Soft-3D visuals are not substitutes for icons in chrome.

---

## 8. Visual language (Puhu + visuals)

### 8.1 Two asset families, one camera

| Family | Role | Path |
|---|---|---|
| **Puhu** | Companion / emotion | `apps/web/public/mascot/puhu/` |
| **Subject soft-3D** | Task / empty / category scenes | `apps/web/public/visuals/` (flat files, no domain subfolders) |

Same light: pastel matte, rounded forms, soft shadow, light ground. Final art is **supplied by design** (not generated in-repo by agents). Agents wire paths and placeholders only.

### 8.2 Puhu size scale

| Token | px | Typical use |
|---|---|---|
| `sm` | 40 | Inline companion, greetings, quest row |
| `md` | 72 | Coach bubble, dialogs, toasts |
| `lg` | 120 | Empty / nudge hero |

### 8.3 Usage patterns (max density)

1. **Inline companion** — small Puhu in chrome.  
2. **Empty / nudge** — `visuals/*` and/or Puhu + one sentence + one CTA.  
3. **Moment hero** — rare (Koç hub, milestones); full-bleed poster OK.  
4. **Subject thumb** — optional small scene beside chips/knowledge cards.

**At most one banner-class visual per page viewport.** Do not put art on every card.

### 8.4 Banner types

| Type | When | Content |
|---|---|---|
| `QuestBanner` | Panel active quest | Text + progress; Puhu optional (`sm`) |
| `CompanionEmpty` | Empty list/chart | `visuals/` and/or Puhu + copy + CTA |
| `MomentHero` | Koç hub / milestone | Full-bleed Puhu poster |
| `PromoSoft` | Earned premium taste | Pastel surface + short copy — no guilt |

### 8.5 `visuals/` naming

Flat files under `public/visuals/`, WebP preferred, e.g. `plan-empty.webp`, `analiz-empty.webp`. See `apps/web/public/visuals/README.md`.

### 8.6 Bans

- Stock photography  
- Illustration on every card  
- Coin / economy in the AI chat zone  
- Alarm / shame banners  
- Tiny uppercase eyebrows on every section  
- Gradient text, glassmorphism-as-default, side-stripe accent borders  

---

## 9. Motion scale (rich, guarded)

| Layer | Examples | Duration |
|---|---|---|
| **Micro** | Hover → `shadow-card-hover`, press ~0.98 scale, focus ring, toggle, progress fill | 150–250 ms |
| **Chrome** | Tab/segment, drawer, sheet, toast | 150–250 ms |
| **Content** | List/card stagger, chart draw-in | Stagger short; no long page choreography |
| **Ambient** | Optional slow blob drift (`transform` / `opacity` only) | Very slow; off under reduced-motion |
| **Moment** | Session done, streak milestone, Puhu bounce | ≤600 ms |

**Rules:**
- Convey state or feedback — not decoration for its own sake.
- Prefer `transform` / `opacity`. Do not animate layout width/height.
- Ease-out (quart/quint/expo). No elastic/bounce easing.
- **`prefers-reduced-motion: reduce`:** crossfade or instant; never gate content visibility on entrance animation.
- No orchestrated full-page load “shows.”

Shared helpers: `apps/web/src/lib/stagger-motion.ts`. Overlay enter/exit lives in web `globals.css`.

---

## 10. Empty & loading

- **Loading:** page-specific `*-content-skeleton.tsx` using `@mentor/ui` `Skeleton` / `SkeletonGroup` + global shimmer classes.
- **Empty:** teach the next action (`EmptyState`) — not “nothing here.”
- **Error:** calm copy; `danger` for form validity only; soft companion tone for recoverable failures.

---

## 11. Mobile → Desktop Adaptation

- Bottom Tab Bar → **left sidebar** at `lg` (1024px); active `#111`.
- Single-column → multi-column (main + right rail) where product needs it.
- Hover: `shadow-card-hover` on interactive elevated cards; focus: `focus-ring`.

---

## 12. Mapping to Our Product

- Course/product cards → plan items, deneme entries, knowledge articles.  
- Ongoing + progress → today’s session / streak / plan progress.  
- Comment → AI coach / community (Phase 2).  
- Nav → Anasayfa · Plan · Koç · Analiz · Bilgi · Topluluk · Profil.  
- Guardrails: calm countdown, no result-ranking shame, encouraging Turkish tone (PRODUCT.md).

---

## 13. Open Items / asset backlog

- [x] Turkish glyph coverage — Nunito Sans `latin-ext`.
- [x] Desktop breakpoints — `lg` sidebar switch.
- [x] Surface hierarchy + hover shadow + visual/motion language (2026-07-12 evolve).
- [ ] Map remaining Nuton library screens ↔ Mentor screens (Figma pass).
- [ ] Puhu P0: `thinking` (AI loading), `gentle-error` (soft error toast).
- [ ] P0 visuals (designer upload): `plan-empty.webp`, `analiz-empty.webp`.

---

## 14. Implementation

Tokens + shared React primitives: **`@mentor/ui`** — `theme.css` · `tokens.ts` · `Button` / `TextField` / `Card` / `Chip` / `ProgressBar` / `BackgroundBlobs` / skeletons / overlays.

Web-specific visuals: `PuhuImage`, `EmptyState`, `apps/web/public/mascot/puhu/`, `apps/web/public/visuals/`.

App shell: `apps/web/src/components/app-nav.tsx`.

**Rule:** screens compose tokens/primitives — no magic numbers ([`docs/standards/frontend.md`](./docs/standards/frontend.md)).
