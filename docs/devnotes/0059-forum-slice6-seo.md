# 0059 — Forum Slice 6: SEO (public QA pages, JSON-LD, sitemap)

> Status: ✅ · Scope: `apps/api` (public `@Public` forum reads) + `apps/web` (public SSR page, sitemap, robots) · Flag: `forum.enabled`
> Prior: backend [0052](./0052-forum-slice1-zones.md)–[0056](./0056-forum-slice5-moderation.md) · web [0057](./0057-web-forum-core-ui.md)/[0058](./0058-web-forum-moderation-ui.md)

## What shipped

Indexable QA questions are now public, server-rendered, and discoverable — the forum's acquisition
channel (design §8). Mirrors the `/bilgi/[slug]` public pattern (`@Public` API + raw `fetch` + ISR +
JSON-LD).

## Backend — public read path

- **`@Public` `GET /v1/forum/public/questions/:id`** → `PublicQuestionView` (404 when not indexable); **`GET /v1/forum/public/questions?limit=`** → `PublicQuestionRef[]` (sitemap).
- **Indexable filter** (the gate, since forum tables are RLS-forced and reads run in **service context**): zone `type=QA` + `visibility=PUBLIC` + `is_archived=false`, thread `deleted_at IS NULL`, **`EXISTS` ≥1 non-deleted answer** (thin-content gate). `forum-thread.repository`: `findPublicQuestion` / `listPublicQuestionRefs` (shared `indexableWhere()`); `forum-post.repository`: `listPublicAnswers`.
- `ForumPublicService` gates on `forum.enabled` and returns **slim shapes with no `authorId`/PII**. New `ForumPublicController` reuses the `@Public` decorator (bypasses the global JWT guard, like `content.controller`).

## Web — public SSR

- `lib/forum-public.ts`: `fetchPublicQuestion(id)` / `fetchPublicQuestionRefs()` (raw `fetch`, ISR `revalidate:3600`) + `siteUrl()`/`questionUrl(id)` helpers.
- `/[locale]/forum/soru/[id]/page.tsx` (outside `(app)`, `revalidate=3600`): `generateMetadata` (title/description, **`robots:{index: locale==='tr'}`**, `alternates.canonical → TR`); `notFound()` when not indexable; renders question + answers (accepted highlighted, read-only) + **`QAPage` JSON-LD** (`mainEntity` Question with `acceptedAnswer`/`suggestedAnswer`); minimal public chrome (Mentor + giriş).
- `app/sitemap.ts`: landing (`/tr`) + every indexable question (TR URL, `lastModified`); best-effort try/catch if the API is unreachable.
- `app/robots.ts`: allow `/`; disallow the authed app paths (`/*/panel`, …, `/*/topluluk`); points to `/sitemap.xml`.

## Decisions / gotchas (locked this session)

- **id-based URL** `/forum/soru/[id]` — no thread slug (the `<title>`/H1/JSON-LD carry the SEO).
- **TR-only index; EN noindex + canonical→TR** (content is Turkish → avoids duplicate-content).
- **Public reads run in service context** (not RLS-by-user) — the repo `indexableWhere()` is the security boundary; only indexable QA is ever returned, so anonymous service-context reads are safe.
- `NEXT_PUBLIC_SITE_URL` drives canonical/sitemap/robots (falls back to `http://localhost:3000`); set it per environment.
- api-client **not** regenerated — public endpoints have no response schema and web uses raw `fetch` (`@mentor/types`), so the spec is unaffected.

## Verification

- **Static gate (green):** repo `pnpm typecheck` 13/13; `pnpm --filter @mentor/web lint && build` (`/forum/soru/[id]` dynamic, `/robots.txt` + `/sitemap.xml` static); lint 0 errors (lone pre-existing `seans-shell` warning).
- **Backend suite (green):** `pnpm --filter @mentor/api exec vitest run src/modules/forum test/forum.e2e-spec.ts` → **51 passing**, incl. the new public e2e: indexable QA (≥1 answer) → 200 with **no `authorId`**; answerless / CHAT thread → 404; list returns only indexable; (flag-off → 404 by service guard).
- **Manual (stack up):** `/tr/forum/soru/<id>` SSR renders + view-source shows `QAPage` JSON-LD; `/en/...` → `robots noindex` + canonical→TR; `/sitemap.xml` lists the question; `/robots.txt` disallows `/*/panel` + links the sitemap.

## Next

Forum MVP is feature-complete (zones · feed · QA+XP+search · moderation · web A/B · SEO). Phase 2:
verification tiers / coin / C-layer / mahalle / live rooms / Tier-1 auto-moderation.
