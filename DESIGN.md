# DESIGN.md — Exam Coaching Platform · Design System

> Status: Living design record · Updated: 2026-06-07
> Product decisions: [`sinav-kocluk-roadmap.md`](./sinav-kocluk-roadmap.md)
> **Visual foundation:** the **Nuton — Online Learning Mobile App** Figma UI template, adopted as our base design system and adapted to our exam-coaching product.
> Source of truth: Figma file `8lc7t0P5kibfQ7GMzLSl3l` (Dev Mode MCP). **All values below are extracted pixel-perfect from the Figma file** (variables + per-node Dev Mode inspection). Node ids are cited so any value can be re-verified.

---

## 1. Overview

Nuton's language is **monochrome-forward**: near-black text and **black primary buttons** on a **white background**, softened by **blurred pastel gradient blobs**, **translucent white cards**, a single **blue-tinted soft shadow**, and **10 px rounded corners everywhere**. Accents are soft pastels (violet chips, blue progress), not a single saturated brand color. Type pairs **League Spartan** (headings) with **Lato** (body).

Base canvas: **375 px** wide. Content column **335 px** → **20 px** side gutters.

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

### 2.2 Surface & background (exact, per-node)

| Token | Value | Source |
|---|---|---|
| `bg` | `#FFFFFF` | Screen base fill |
| `surface` | `#FFFFFF` | Solid cards |
| `surface-translucent` | `rgba(255,255,255,0.5)` + `1px solid #FFFFFF` border | Cards/fields (`field` 2:722, `product ongoing` 15:1173) |
| `overlay-dark` | `#111111` @ 10% | Image overlays (15:1233) |

**Decorative background blobs** (large, `blur ~150`, low opacity, layered over white — these create the soft tint seen on screens):
- `#FF2DAB` (pink) @ 0.4 · `#9BC1FB` (blue) @ 0.6 · `#BDEBFF` (cyan) @ 0.6 — node 17:3036.

### 2.3 Accents & semantic (exact, per-node)

| Token | Hex | Usage / source |
|---|---|---|
| `chip` (violet) | `#BEA1FE` @ 30% bg | Tag/chip fill (`tag` 141:1736) |
| `chip-text` | `#7C6F97` | Tag/chip label |
| `progress` (blue) | `#55ACEE` | Progress fill (15:1164) |
| `progress-track` | `#C3D9FD` | Progress track (15:1163) |
| `thumb-violet` | `#DDACE5` | Course thumbnail placeholder (15:1162) |
| `thumb-periwinkle` | `#D6DBFD` | Course thumbnail placeholder (10:890) |
| `star` (amber) | `#FFC700` | Rating star (exact, svg fill) |
| `like-inactive` | `#666666` | Heart outline, default (10:842) |
| `like-active` (pink) | `#FF2DAB` family | Wishlist when liked (pink variant) |

> Note: there is **no single saturated "primary brand" color**. Emphasis comes from **black/#111** (buttons, active states) plus **soft pastel accents**. Earlier assumptions of a violet primary were incorrect.

### 2.4 Semantic state tokens

Nuton has no error/focus colors; these complete the product state vocabulary (forms, validation, keyboard focus). Calm, not alarming (anti-shaming tone). Defined in `@mentor/ui` `theme.css`.

| Token | Hex | Usage |
|---|---|---|
| `danger` | `#b42318` | Error/destructive text + field borders (`FormError`, `TextField error`). Deep red, **≥4.5:1 on white** (accessible body text). |
| `success` | `#2e7d54` | Positive/upward signal — leaderboard rank ▲, gains. Calm green, **≥4.5:1 on white**. A downward move uses `secondary` gray, **never** red (anti-shaming). |
| `focus-ring` | `#1d6fbf` | Keyboard focus ring (`focus-visible:ring-2`) on buttons/fields/toggles. Darkened accent, **≥3:1** for UI indicators. |

> Errors use `danger` — **not** `like-active` (#ff2dab is the wishlist/like pink, not a state color).

---

## 3. Typography

- **Headings:** **League Spartan** ("Spartan"). **Body / UI:** **Lato**.
- Verify full Turkish glyph coverage (ç ğ ı İ ş ö ü); pick Turkish-complete weights/fallbacks before wiring.

| Style | Font | Size | Weight | Line-height |
|---|---|---|---|---|
| H1 | League Spartan | 32 | 700 Bold | 1.2 |
| H2 | League Spartan | 20 | 600 SemiBold | 1.4 |
| H3 | League Spartan | 16 | 500 Medium | 1.7 |
| H4 | Lato | 18 | 700 Bold | 1.5 |
| H5 | Lato | 16 | 700 Bold | 1.5 |
| Body | Lato | 16 | 400 Regular | 1.7 |
| Caption/meta | Lato | 14 | 400 Regular | 1.7 |
| Small label | Spartan | 12 | 400 Regular | 1.7 |
| Tab label | Spartan | 8 | 600 SemiBold | normal · **UPPERCASE** |
| Button | Lato | 18 | 700 Bold | 1.7 · capitalize |

Text colors: headings `#111`, body/value `#333`, meta/secondary `#666`.

---

## 4. Spacing & Layout

- **Grid base:** 4 px. Steps: 4 · 8 · 12 · 16 · 20 · 24 · 32.
- **Screen gutter:** 20 px (content = 335 px on 375 px frame).
- **Fixed bars:** Status Bar 44 h · Top Nav 42 h · Tab Bar 63 h · Home Indicator 34 h.
- **Field / Primary button:** 335×60 · **List item:** 335×56.
- Field inner padding: left 20, top 8, bottom 7. Button inner padding: ~15/14 vertical. Tag padding: 16 × 10.

---

## 5. Radius & Elevation (exact)

- **Radius: `10px`** for buttons, fields, cards, chips, thumbnails — **uniform across the system.** (Rating badge uses asymmetric `bottom-left 10 / top-right 10`.)
- **Shadow (single token):** `0px 4px 10px rgba(37, 73, 150, 0.10)` — color `#254996` @ 10%, offset y 4, blur 10, spread 0. Applied to translucent cards, fields, floating elements. No multi-layer shadows.

---

## 6. Components (exact specs)

**Primary button** (`btn` 2:770): bg `#000`, radius 10, width 335, label Lato Bold 18 `#FFF` centered capitalize. (Use for the main CTA — black, not accent.)

**Text field** (`field` 2:722): bg `rgba(255,255,255,.5)`, 1px `#FFF` border, radius 10, shadow token, padding L20/T8/B7. Floating label Spartan Regular 12 `#666`; value Lato Regular 16 `#333`; optional trailing check icon.

**Tab bar** (`Tab bar` 5:761): bg `#FFF`, height 63, 1px top divider. 4 items (Home · Search · My Courses · Profile), icon ~26–28 px + label Spartan SemiBold 8 UPPERCASE. **Active = `#111`, inactive = `#666`** (no accent fill).

**Tag / chip** (`tag` 141:1736): bg `#BEA1FE` @30%, radius 10, padding 16×10, label Lato Bold 14 `#7C6F97`, capitalize.

**Course card — horizontal** (`product item` 10:901, 335×90): thumb `#D6DBFD` radius 10; title Lato Bold 14 `#111`; meta clock + Lato Regular 14 `#666`; price Lato Regular 16 `#111` (right); pink heart top-right; rating badge = white pill (radius bl10/tr10) with amber star + "5.0" Lato Bold 10 `#333`.

**Course card — ongoing** (`product ongoing` 15:1173, 160×194): bg `rgba(255,255,255,.5)` + white border + shadow, radius 10; thumb `#DDACE5` with `#111`@10% overlay + play button; title Lato Regular 14 `#111`; progress track `#C3D9FD` / fill `#55ACEE` (h3, radius 3) + "56%" Lato Regular 12 `#666`.

**Other library symbols** (reuse as-is): Top Nav (375×42), Status Bar (375×44), Home Indicator (375×34), list item (335×56), product item 2/3 (230×170 / 230×300), lesson (335×50), video lesson (308×41), comment (335×191), checkbox, coupon item (335×85), wishlist item (335×110), FAQ item (335×56), support block (160×140).

---

## 7. Iconography

- Thin line icons (Feather-style): home, search, book-open, user, clock, heart, edit-3, check, star, chevron. Icon box ~24–28 px.
- Active nav icon `#111`, inactive `#666`. Like/heart pink when active; star amber.

---

## 8. Mobile → Desktop Adaptation

Template is mobile-only (375). For **desktop web** (MVP-primary), keep all tokens and scale up:
- Bottom Tab Bar → **left sidebar** (same items + our nav), active `#111`.
- Single-column card stack → **multi-column grid** (main + right rail) at ≥1024 px; keep 20–32 px gutters, radius 10, the single shadow token.
- Add hover/focus states (absent in the mobile template): e.g. card hover = slightly stronger shadow; focus ring on fields/buttons.

---

## 9. Mapping to Our Product (exam coaching)

Borrow Nuton's *visual* system; *content* follows the roadmap (companionship platform, KPSS-first, Turkish, anti-shaming):
- Course/product cards → **study-plan items, practice-test (deneme) entries, knowledge-center articles**.
- "Ongoing course + progress" → **today's study session / streak / plan progress**.
- Comment → **AI coach message / community post** (Phase 2).
- Tab/sidebar nav → Anasayfa · Plan · Analiz · Bilgi · Profil (+ central study action).
- Keep roadmap guardrails: countdown framed calmly (not alarming red), no result-ranking, encouraging Turkish tone.

---

## 10. Open Items
- [x] ~~Turkish glyph coverage~~ → **next/font League Spartan + Lato with `latin-ext` subsets** (covers ç ğ ı İ ş ö ü), self-hosted; CSS vars `--font-heading`/`--font-body` (web layout).
- [x] ~~Desktop breakpoints~~ → **Tailwind defaults; `lg` (1024px) = sidebar switch** (bottom tab bar < 1024 → left sidebar ≥ 1024). Hover: nav `hover:bg-white`, focus: `focus:ring-2` on fields; richer states per-screen.
- [ ] Map each Nuton screen to one of our screens (first live Figma MCP session).

## 11. Implementation
Tokens + React primitives live in **`@mentor/ui`**: `theme.css` (Tailwind v4 `@theme`) ·
`tokens.ts` · components `Button / TextField / Card / Chip / ProgressBar / BackgroundBlobs`
(each cites its Figma node). App shell: `apps/web/src/components/app-nav.tsx` (tab bar ↔ sidebar).
Rule: screens compose these primitives — no magic numbers (frontend standard).
