# 0023 — W6 · Admin Content Editor (Knowledge-Center Articles, Slice 1)

> Date: 2026-06-13 · Scope: api (admin + content) + admin UI · Related: roadmap §9, AGENTS §4 #1, workstreams W6/W1

## What was done
- **Admin content editor for `info_articles`** — list (incl. drafts) · create/edit · publish/unpublish.
  Most write logic already lived in W1 `ContentService` (`upsertArticle`, `publishArticle`); this slice
  wires it to an **admin-guarded, audited** surface + adds the missing admin reads.
- **content module (W1, additive):** `ContentService` gained `listArticlesForAdmin` (drafts incl.),
  `getArticleForAdmin` (draft-incl. detail), `unpublishArticle` (publishedAt→null). `InfoArticleRepository`
  gained `listAll` + `setPublishedAt(Date|null)`. ContentModule already exported `ContentService`.
- **admin module (W6):** `AdminContentController` (`@Roles(ADMIN, EDITOR)` + `AdminAuditInterceptor`),
  `imports: [ContentModule]`:
  - `GET /admin/content/articles?family=&page=` (list) · `GET …/:slug` (detail) ·
  - `POST /admin/content/articles` (upsert) — `@Audit('content.article.upsert')` ·
  - `POST …/:slug/{publish,unpublish}` — `@Audit('content.article.{publish,unpublish}')`.
- **Validation** (`@mentor/validation/content.ts`): `upsertArticleSchema` (trust metadata **required** —
  source/sourceUrl/verifiedBy/verifiedAt; §4 #1) + `adminListArticlesQuerySchema` (family optional).
- **Admin UI (TS):** `İçerik` menu (role-gated), `/content/articles` (list, draft/published badge,
  publish/unpublish), `/content/articles/new` + `/[slug]` (shared `ArticleForm`, **markdown** body
  textarea — matches apps/web react-markdown). Auth guard now admits **ADMIN or EDITOR**; the sidebar
  `Menus` filters items by the user's roles (EDITOR sees only İçerik).

## How to use (usage)
```bash
# EDITOR or ADMIN: /content/articles → + Yeni makale (trust metadata required) → Yayınla.
# Published article becomes public at GET /v1/content/info-articles/:slug; unpublish hides it.
```

## Gotchas
- **§4 #1 guardrail:** trust metadata is REQUIRED by the Zod schema; the editor enters editorial content
  with a verifiable source — the LLM never generates official info. Body is **markdown** (no HTML/jodit →
  no sanitization surface; web renders via react-markdown).
- **RLS + admin reads (important):** admin list/detail MUST run in **SERVICE context** — the
  `info_articles_public_read` policy only exposes published rows to pool/anon reads, so a plain `this.db`
  read would hide drafts under enforced RLS (prod/Neon). `listArticlesForAdmin`/`getArticleForAdmin` use
  `withServiceContext`. (Local `mentor` is superuser → RLS bypassed, which masks this — caught in review.)
- **EDITOR in the panel:** the admin app guard now allows EDITOR; the menu is role-filtered so EDITOR
  only sees İçerik. EDITOR hitting an ADMIN-only API still 403s (defense in depth).
- **Dev DB drift:** `info_articles` was missing in the local dev DB (a 0006 migration skipped by the
  multi-track journal `when`-ordering corruption — same class as 0008/0013). Applied 0006 SQL directly for
  the live demo. **Team action:** reconcile the dev migration journal (snapshots + real timestamps per track).
- No schema change/migration in this slice (info_articles already exists).

## Related files & decisions
- `apps/api/src/modules/admin/presentation/admin-content.controller.ts` · `admin.constants.ts` ·
  `content/application/content.service.ts` · `content/infrastructure/info-article.repository.ts`
- `packages/validation/src/content.ts` (`upsertArticleSchema`)
- `apps/admin/src/app/(general)/content/articles/{page,new/page,[slug]/page,ArticleForm}.tsx` ·
  `contentApi/authProvider.tsx` (ADMIN|EDITOR) · `components/shared/navigationMenu/Menus.jsx` (role filter) ·
  `utils/fackData/menuList.ts` (İçerik + roles) · `lib/types.ts` (AdminArticle)
- **Verified:** e2e 4 (403 non-editor, 400 missing trust metadata, draft created+listed+not-public,
  publish→public→unpublish→hidden); admin typecheck+build, api lint green; live (Claude_Preview) — list
  renders (role-gated İçerik menu), create→draft, publish→public 200, unpublish→404.
- Decisions: scope = articles only (exam calendar = next); ADMIN+EDITOR; markdown body. Cross-track: small
  additive ContentService methods (W1 already exposed the service "for future W6 admin").

## Code-review fixes / backlog (4-lens review)
- **(during impl) RLS context:** admin list/detail moved to `withServiceContext` so drafts are visible
  under enforced RLS (prod) — local superuser had masked it.
- **(F2, fixed) Upsert audit:** records `before {existed,isPublished}` + `after {existed,isPublished,
  family,category}` → create vs update is now distinguishable in the audit trail.
- **(F3, fixed) Home cards role-gated:** `HomeCards` (client) filters by the signed-in roles, mirroring
  the sidebar — an EDITOR no longer sees Users/Audit links it can't use.
- **(F1, backlog) Unpublish event:** `publish` emits `ArticlePublished` (W3 embedding seam); `unpublish`
  emits nothing — when W3 embeddings land, unpublish should signal removal.
- **(F4, backlog) Admin list pagination UI** (pageSize 50 fixed; same as other admin tables).
- **(F5, note) `info_articles` has no org_id** (global editorial content by W1 design); per-org = Phase 2.
