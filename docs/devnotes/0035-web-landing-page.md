# 0035 — Web landing page (`apps/web` /)

> Date: 2026-06-16 · Scope: web (apps/web) · Related: DESIGN.md, README positioning,
> Sprint 1–3 UI patterns. Public marketing shell; no API change.

## What was done
- Replaced skeleton [`page.tsx`](../../apps/web/src/app/page.tsx) with full **marketing landing**:
  header (Giriş / Kayıt), hero, three-pillar features, CTA band, footer trust line.
- **Components** under `apps/web/src/app/_components/landing/`: `landing-page` (client motion),
  `landing-header`, `landing-hero`, `landing-features`, `landing-cta`.
- **Nuton tokens** — `Chip`, `Card`, `SectionHeading`; thumb pastels on feature icons; no magic hex
  outside DESIGN thumb accents.
- **Motion** — shared `stagger-motion.ts` stagger on hero / features / CTA (`useReducedMotion`).
- **SEO** — page-level `metadata` + basic `openGraph` on home.

## How to use (usage)
```bash
pnpm --filter @mentor/web dev   # http://localhost:3000/
```

## Gotchas
- Secondary hero CTA → `/giris` (not `/bilgi` — app bilgi hub is auth-gated).
- Public SEO articles remain at `/bilgi/[slug]`; landing does not link there until a stable slug list exists.
- Root `layout.tsx` metadata still applies to other routes; home overrides via `page.tsx` export.

## Related files & decisions
- `apps/web/src/app/{page.tsx,_components/landing/*}`
- Decisions: companionship copy from README; three pillars (Koç / Ritüel / Bilgi); Link-as-button CTAs.
