# 0017 — W1 · Knowledge center (Slice 2)

> Date: 2026-06-11 · Scope: api (`modules/content`), web (`bilgi`, public `/bilgi/[slug]`), packages (`types`, `validation`, `api-client`) · Related: roadmap §4 guardrail #1/#6, design plan W1-b

## What was done
- New `info_articles` table with nullable `embedding vector(1536)` (pgvector content-only; W3 fills later).
- **Endpoints (`/v1`, public read, published only):** `GET /v1/content/info-articles?family=`, `GET /v1/content/info-articles/:slug`.
- **Domain event:** `ArticlePublished` (`content.article.published`) emitted on first publish — W3 embedding seam, no OpenAI in W1.
- **Seed:** `articles.seed.json` — 3 KPSS editorial markdown articles with full trust metadata.
- **Web:** Authenticated `(app)/bilgi` hub lists family-filtered articles (newest first); public SSR `/bilgi/[slug]` with `generateMetadata`, OpenGraph, JSON-LD, `react-markdown`, trust footer.
- **Validation:** slug param (`infoArticleSlugParamSchema`), category enum on `upsertArticle`; hub/API errors fail loud (no silent fetch fallbacks).
- **Public UX:** back nav → `/bilgi` when authenticated, `/` when anonymous; markdown links limited to `http(s):`.
- Migration `drizzle/0006_info_articles.sql` + RLS (published public read; SERVICE/ADMIN drafts + write).

## How to use (usage)
```bash
pnpm --filter @mentor/api db:migrate
pnpm --filter @mentor/api dev
pnpm dev   # web :3000

# Public articles (no auth)
curl "http://localhost:3001/v1/content/info-articles?family=KPSS"
curl http://localhost:3001/v1/content/info-articles/kpss-basvuru-sureci

# Public SEO page
open http://localhost:3000/bilgi/kpss-basvuru-sureci

pnpm --filter @mentor/api openapi:export
pnpm --filter @mentor/api-client generate
```
- Articles require `family` (KPSS|YKS|LGS); hub filters by `users.examType`.
- `publishArticle(slug)` is idempotent — emits event only on first publish.
- Route seam: `(app)/bilgi` = auth hub index; `app/bilgi/[slug]` = public article (outside `(app)` group).

## Gotchas
- **Never generate official/process copy via LLM** — editorial seed/admin only (guardrail §4 #1).
- `upsertArticle` on conflict does **not** overwrite `publishedAt` — use `publishArticle` for first publish + event.
- `embedding` is never returned from API; column stays null until W3 job runs.
- Invalid `family` query → 400 (`VALIDATION_ERROR` via Zod on list endpoint). Missing `family` → 400.
- Invalid or oversize slug → 400 (`VALIDATION_ERROR`); unpublished draft → 404 (`CONTENT_ARTICLE_NOT_FOUND`).
- Invalid `category` on upsert → 400 (`CONTENT_INVALID_ARTICLE_CATEGORY`).
- `info_articles` has no `org_id` yet — global editorial only; add nullable `org_id` in Phase 2 if org-scoped articles are needed (`exams.org_id` pattern).
- E2E requires migration `0006` applied to `mentor_test`; article seed runs on module init.

## Related files & decisions
- `apps/api/src/database/schema.ts` — `info_articles`
- `apps/api/src/modules/content/domain/content.events.ts` — `ArticlePublished`
- `apps/api/src/modules/content/infrastructure/info-article.repository.ts`
- `apps/api/src/modules/content/seed/articles.seed.json`
- `apps/web/src/app/bilgi/[slug]/page.tsx` — public SEO article
- `apps/web/src/app/bilgi/[slug]/_components/article-back-nav.tsx` — auth-aware back link
- `apps/web/src/app/bilgi/[slug]/_components/article-trust-footer.tsx`
- `apps/web/src/app/(app)/bilgi/_components/bilgi-shell.tsx` — hub list
- `packages/types/src/content.ts` — `InfoArticleDto`, `InfoArticleSummaryDto`
