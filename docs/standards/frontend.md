# Frontend Standards (Next.js 16 · React 19 · Tailwind v4)

> Canonical context: [`../../AGENTS.md`](../../AGENTS.md) · Design: [`../../DESIGN.md`](../../DESIGN.md).
> Performance constitution: the **`vercel-react-best-practices`** skill (priority order below).

## Rendering & data
- [ ] **Server Component by default**; `"use client"` only when interaction/browser API is needed.
- [ ] Data from the **single API**: `@mentor/api-client` (NestJS `/v1`). No `fetch` scattered across pages,
  no separate backend logic.
- [ ] **No business logic/calculations on the client** (§principles): the backend returns computed,
  ready-to-render data; FE only shapes/displays it. Never recompute net/score/coin/pricing on FE.
- [ ] **User-facing dynamic/validation messages come localized from the backend** (`message` + `code`) and are
  displayed directly. FE owns only static chrome copy (labels/buttons), Turkish in MVP.
- [ ] Client-side data → SWR/React Query (dedup + cache). Prefer fetching in RSC on the server when possible.
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

## Don't
- ❌ off-DESIGN magic numbers/colors · ❌ needless client components · ❌ barrel imports · ❌ derived state in
  effects · ❌ bypassing api-client with direct `fetch`.
