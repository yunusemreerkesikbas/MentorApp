# Frontend Standards (Next.js 16 · React 19 · Tailwind v4)

> Canonical context: [`../../AGENTS.md`](../../AGENTS.md) · Design: [`../../DESIGN.md`](../../DESIGN.md).
> Performance constitution: the **`vercel-react-best-practices`** skill (priority order below).
> **Scope:** `apps/web` (B2C). **`apps/admin`** is a deliberate exception — see [`apps/admin/AGENTS.md`](../../apps/admin/AGENTS.md) (Bootstrap, axios, Next 14).

## Rendering & data
- [ ] **Server Component by default**; `"use client"` only when interaction/browser API is needed.
- [ ] Data from the **single API** (NestJS `/v1`). Authenticated flows → `@mentor/api-client`. Public/SEO
  fetch may live in centralized `src/lib/*` helpers (with `revalidate`) — not scattered in page components.
- [ ] **No business logic/calculations on the client** (§principles): the backend returns computed,
  ready-to-render data; FE only shapes/displays it. Never recompute net/score/coin/pricing on FE.
- [ ] **User-facing dynamic/validation messages come localized from the backend** (`message` + `code`) and are
  displayed directly. FE owns only static chrome copy (labels/buttons) — see **i18n** below.
- [ ] Prefer fetching in RSC on the server. Client mutations via `@mentor/api-client`. (SWR/React Query not
  in use yet — don't add without an explicit decision.)
- [ ] **No waterfalls:** independent requests via `Promise.all`; stream with Suspense. (vercel: `async-*`
  rules — highest priority.)

## Performance priority order (vercel-react-best-practices)
1. **Eliminating waterfalls** (`async-*`) — critical
2. **Bundle size** (`bundle-*`) — critical: avoid barrel imports, heavy components via `next/dynamic`, defer 3rd-party
3. **Server perf** (`server-*`) — `cache()`, hoist static I/O, minimize serialization
4. **Client fetch** (`client-*`) → 5. **Re-render** (`rerender-*`) → 6. **Rendering** → 7. **JS**

## Design & accessibility
- [ ] UI values **only from DESIGN.md tokens** (`@mentor/ui` / CSS variables). **No magic numbers.**
- [ ] Uniform radius (10px token), single shadow token, 4px grid spacing — DESIGN.md §4-5.
- [ ] Semantic HTML + WCAG AA (contrast, keyboard, focus ring, touch ≥44px). Turkish glyphs (League Spartan/Lato fallback).
- [ ] **Tone (§0):** encouraging, anti-shaming. Calm countdown (not alarm-red), no result ranking.
- [ ] Every screen: loading / empty / error states.

## Forms & state
- [ ] Form validation with **shared Zod** (`@mentor/validation`) — same schema as BE.
- [ ] Minimal state: **derive during render** what's derivable (don't store via effects). No needless `useEffect`.
- [ ] Images via `next/image` (R2 source); SEO pages static/free (no LLM — §1).

## SEO (wedge)
- [ ] Knowledge-center pages static + `metadata` + structured data; reading is free (grounded AI is premium).

## Internationalization (i18n) — TR/EN
> Setup & gotchas: [`../devnotes/0050-web-i18n-next-intl.md`](../devnotes/0050-web-i18n-next-intl.md). `apps/web` is URL-based TR/EN via **next-intl** (`tr` default, no prefix; `en` → `/en/…`).
- [ ] **No hardcoded user-facing strings.** All static chrome copy goes through `useTranslations` (client) /
  `getTranslations` (server/RSC). Backend-localized dynamic messages still display directly (above).
- [ ] **Every new/changed key updates BOTH** `messages/tr.json` **and** `messages/en.json` (keys must stay at parity).
- [ ] **Internal navigation uses `@/i18n/navigation`** (`Link`, `useRouter`, `usePathname`, `redirect`) — never
  `next/link` or `next/navigation` for in-app links (those drop the locale prefix). `useSearchParams` + `notFound`
  stay on `next/navigation`.
- [ ] **Locale-aware formatting:** dates/numbers via the active `locale` (`useLocale()` / `getLocale()`), not a hardcoded `"tr-TR"`.
- [ ] **Static rendering on** (pages `●`/ISR). Every server page/layout calls `setRequestLocale(locale)` (from awaited
  `params`); `[locale]/layout.tsx` owns `<html>`/`<body>` + has `generateStaticParams`. Client `(app)` pages → call it
  in the page; `(auth)` → in the layout. Public pages (landing, `bilgi/[slug]`) use ISR (`export const revalidate = 3600`).
  Unknown locale → `notFound()`. Turbopack needs `turbopack.resolveAlias` for `next-intl/config` in `next.config.ts`
  (next-intl 3.x writes it to the wrong key) — see [devnote 0050](../devnotes/0050-web-i18n-next-intl.md).

## Don't
- ❌ off-DESIGN magic numbers/colors · ❌ needless client components · ❌ barrel imports · ❌ derived state in
  effects · ❌ bypassing api-client with direct `fetch` · ❌ hardcoded TR strings · ❌ `next/link`·`next/navigation`
  for in-app navigation (use `@/i18n/navigation`).
