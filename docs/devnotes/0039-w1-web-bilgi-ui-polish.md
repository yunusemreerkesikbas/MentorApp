# 0039 — W1 · Web Bilgi UI polish + landing editorial links

> Date: 2026-06-16 · Scope: web (apps/web) · Related: [0017](./0017-w1-knowledge-center.md),
> [0035](./0035-web-landing-page.md), [0038](./0038-w2-web-analiz-ui-polish.md). Frontend-only.

## What was done
- **`BilgiShell`** — header fade + stagger; `DataCard` / chip empty states; article list with category
  `Chip` + stagger; exam-type gate CTA → `/profil`; “Panele dön”; retry on error.
- **Public article** — `ArticleContent` client motion; trust footer in `Card` + chip badge; back nav
  and chrome links 44px + focus rings.
- **Landing** — server fetch of KPSS seed articles; `LandingEditorial` links to `/bilgi/[slug]`.
- **Shared** — `lib/content-labels.ts` for category Turkish labels.

## How to use (usage)
```bash
pnpm --filter @mentor/web dev
# Hub (auth): http://localhost:3000/bilgi
# Public SEO: http://localhost:3000/bilgi/kpss-basvuru-sureci
# Landing editorial block when API + seed are up
```

## Gotchas
- **Hub** `(app)/bilgi` requires auth + `examType`; **public** `/bilgi/[slug]` is SEO wedge (no auth).
- Landing fetches `family=KPSS` (first seed); section hidden if API down or empty (no fake links).
- **Official copy** still editorial-only — never LLM-generated (guardrail §4 #1).

## Related files & decisions
- `apps/web/src/app/(app)/bilgi/_components/bilgi-shell.tsx`
- `apps/web/src/app/bilgi/[slug]/_components/{article-content,article-back-nav,article-trust-footer}.tsx`
- `apps/web/src/app/_components/landing/landing-editorial.tsx`
- `apps/web/src/app/page.tsx` — server article prefetch for landing
- `apps/web/src/lib/content-labels.ts`
- Decisions: landing editorial closes 0035 backlog; motion matches Panel/Analiz patterns.
