# Admin

> Internal admin panel: user management, content editors, refunds, metrics, fine RBAC sub-roles,
> audit log. Modules: `modules/admin` (API) + `apps/admin` (Duralux UI). Workstream: W6.

## Overview

Admin is the internal team tool. It is a **consumer of every other module's public service**
(workstreams §3 — admin never queries other modules' tables directly). It owns the audited,
role-gated admin surface: user search/detail/status/KVKK export/anonymize, role assignment (STAFF +
fine sub-roles), content/exam-calendar editors, subscription view + refund/cancel, economy adjust,
metrics KPI snapshot, and config/flag editing. Every mutation is **audited** (append-only
`admin_audit_log`); admin acts cross-user so repositories run in **SERVICE context**. The UI is the
adopted-as-is **Duralux** Bootstrap 5 / Next 14 / **JavaScript** template (an accepted deviation —
see `apps/admin/AGENTS.md`); our code is TypeScript over it (hybrid, `allowJs`).

## Architecture (key decisions)

- **Bounded context** `apps/api/src/modules/admin/**` — canonical layering
  (domain/application/infrastructure/presentation). Endpoints under `/v1/admin`, all gated by
  `@Roles(...)` (global `JwtAuthGuard` + umbrella-aware `RolesGuard`).
- **Workstreams §3 (the seam rule):** admin consumes each module's **public stats/service** — it
  never queries other modules' tables. `imports: [ContentModule, PaymentsModule, EconomyModule,
  IdentityModule, ...]` and calls their exported services.
- **Audit log (§9) — table + interceptor:** `admin_audit_log` (append-only, never updated/deleted;
  RLS SERVICE/ADMIN-only). `@Audit('<action>')` marks a handler; `AdminAuditInterceptor` writes one
  row on success (actor/action/ip/ts always; target + before/after when the handler calls
  `setAuditContext`). Audit write is **post-commit, best-effort-but-loud** (a failed audit write is
  logged at error level, never fails the admin action).
- **SERVICE context everywhere** — admin acts cross-user → `withServiceContext` (RLS self-belt
  bypassed). Local `mentor` superuser bypasses RLS → verify on Neon/prod.
- **Fine RBAC sub-roles** (§9 least-privilege): `SUPPORT`, `FINANCE`, `MODERATOR`, `SUPER_ADMIN` on
  `users.roles` text[] (embedded in JWT — no migration; new values flow on next token refresh).
  `RolesGuard` bypasses any `@Roles` when the user holds a full-access role
  (`ADMIN_FULL_ACCESS_ROLES = [ADMIN, SUPER_ADMIN]`) → **existing admins keep full access, zero
  migration**. Method-level `@Roles` overrides class-level (NestJS handler-first).
- **KVKK = anonymization (soft), not hard-delete:** scrub PII (email → `deleted+<id>@anonymized.local`,
  name → "Silinmiş Kullanıcı", clear examType/Date) + status BANNED, keep the row → FK/audit/ledger
  intact. Repo does it in one `FOR UPDATE` SERVICE tx returning before/after. The anonymize audit
  records `{anonymized:true, scrubbedFields:[…]}` — NOT the erased email/name (so the append-only
  trail doesn't defeat erasure).
- **Self-lockout guard:** an admin can't change their own status / anonymize self →
  `ADMIN_CANNOT_MODIFY_SELF` (403).
- **`apps/admin` is JS + Bootstrap — an accepted deviation** from the Tailwind/`@mentor/ui`/TS norm
  (internal team tool). Deps are pnpm-managed. **Don't run `npm install` inside a pnpm workspace app**
  — use `pnpm --filter @mentor/admin add` (lesson from the original Duralux `package-lock.json` clash).

## Tutorials / Guides

```bash
pnpm --filter @mentor/api dev           # api :3001
pnpm --filter @mentor/admin dev         # admin :3002 (Bootstrap/Next14)

# Bootstrap an ADMIN (no self-service): grant via SERVICE-context SQL:
begin; select set_config('app.role','SERVICE',true);
update users set roles = array_append(roles,'SUPER_ADMIN') where id=...;
commit;
# Then admin /login → /users → Roller panel (SUPER_ADMIN/ADMIN) to grant/revoke sub-roles.
```

**Add a new audited admin endpoint:** `@Roles(...)` + `@UseInterceptors(AdminAuditInterceptor)` on
the controller, `@Audit('<action>')` on the handler, and `setAuditContext(req, { targetType,
targetId, before, after })` for rich diffs.

### Endpoint → role matrix (least-privilege)

| Area | Sub-role(s) |
|---|---|
| Content/exam editor | `EDITOR` |
| User read (search/detail) | `SUPPORT, FINANCE` |
| User status | `SUPPORT` |
| KVKK export/anonymize · audit-log · role/STAFF assignment | `SUPER_ADMIN` |
| Subscription/economy view | `SUPPORT, FINANCE` |
| Refund/cancel/economy adjust | `FINANCE` |
| Metrics | `SUPPORT, FINANCE` |
| Config/flags | `SUPER_ADMIN` |

(`ADMIN` and `SUPER_ADMIN` are full-access umbrellas — bypass every `@Roles`.)

## API

| Endpoint | Purpose |
|---|---|
| `GET /admin/users?q=&page=` · `GET /admin/users/:id` | User search / detail (secret-free) |
| `PATCH /admin/users/:id/status` | ACTIVE/SUSPENDED/BANNED (audited) |
| `GET /admin/users/:id/export` · `POST /admin/users/:id/anonymize` | KVKK export / erasure (audited) |
| `POST/DELETE /admin/users/:id/roles/:role` · `…/roles/staff` | Role assignment (SUPER_ADMIN, audited) |
| `GET /admin/audit-log` | Newest-first audit trail |
| `GET/POST /admin/content/articles` · `POST …/:slug/{publish,unpublish}` | Article editor (ADMIN/EDITOR) |
| `POST /admin/content/articles/images/upload-url` | Cover/body image presign (EDITOR+, JPEG/PNG/WebP, client cap 5 MB) |
| `GET/POST /admin/content/exams` · `POST …/:slug/events` · `DELETE …/:slug/events/:type` | Exam-calendar editor (ADMIN/EDITOR) |
| `GET /admin/users/:id/subscription` · `POST …/refund` · `POST …/cancel` | Subscription view / refund / cancel (FINANCE) |
| `GET /admin/metrics` | KPI snapshot (read-only, no audit) |
| `GET /admin/metrics/economy` | Coin/XP faucet + sink breakdown, float, faucet reach (read-only) |
| `GET /admin/config` · `PATCH /admin/config/:key` | Config/flag editor (SUPER_ADMIN) |

## Geliştirmeler (timeline)

- **Featured tartışma arama seçicisi (2026-07-31)** — Topluluk yönetimindeki ham Thread ID/UUID
  alanı kaldırıldı. EDITOR en az iki karakter yazar; mevcut `/v1/forum/search` çağrısı 250 ms gecikmeyle
  çalışır ve başlık, oda, tür, son aktivite gösterir. Loading, boş, hata/yeniden dene, seçim, değiştirme
  ve manuel seçimi kaldırma durumları tamamlandı. UUID yalnız seçilen `ForumThreadSummary.id` olarak
  dahili gönderilir; yedi günlük varsayılan süre ve server-side audit aynen korunur. Admin featured
  GET/PUT yanıtı additive `ForumFeaturedAdminView.thread` taşır. İlgili: admin `forum/page.tsx`,
  `admin-forum.controller.ts`, `packages/types/src/forum.ts`.
- **Economy metrics card (APP-031, 2026-07-31)** — `GET /v1/admin/metrics/economy` + a fourth
  dashboard block (`EconomyCards`, `AiCostCards` kalıbı). Ledger'ı okuyup coin'in nereden girip
  nereye çıktığını reason bazında, harcanmamış float'ı ve haftalık musluğun erişimini gösterir —
  kazanç oranlarının canlı veriden kalibre edilebilmesi için (roadmap §729). Admin adjust satırları
  organik dökümden ayrı tutulur. Detay + gotcha: [economy](./economy.md).

- **Seven-day coaching continuity KPI (2026-07-22)** — `GET /v1/admin/metrics` additively returns
  `coaching { activeUsers7d, repeatUsers7d, repeatRate7d }`. The metric uses distinct UTC dates from
  `daily_activity.has_session` in the inclusive today-minus-six through today window; the admin home
  shows active, repeat, and percentage cards. Aggregation remains behind coaching's public
  `SessionService` and runs in service context; admin does not query coaching tables. Related:
  `daily-activity.repository.ts`, `session.service.ts`, `admin-metrics.controller.ts`,
  `MetricsCards.tsx`.

- **Admin foundation (STAFF + audit log + UI shell)** — first W6 slice: `modules/admin` bounded
  context; `GET /admin/users` search + STAFF grant/revoke (idempotent) + `GET /admin/audit-log`;
  `admin_audit_log` table + `AdminAuditInterceptor` + `@Audit()`; Duralux template moved to
  `apps/admin` (Bootstrap/Next14/JS) + wired to real API + Mentor-branded + de-Duralux'd; TypeScript
  hybrid (`allowJs`, typecheck = gate). User management deepened: detail + status + KVKK export +
  anonymize (soft). Migration `0008`. *(0018.)*
- **Admin content editor (articles)** — list (drafts incl.) / create-edit / publish-unpublish for
  `info_articles`; wraps the W1 `ContentService` on an ADMIN/EDITOR-guarded, audited surface; trust
  metadata required by Zod; markdown body. Admin reads in SERVICE context (drafts visible under RLS). *(0023.)*
- **Rich article editor + cover/SEO fields (2026-07-18)** — the article form now lazy-loads the
  installed Jodit editor with a restricted H2/H3/emphasis/list/quote/link/table/image toolbar and
  updates form state on blur. Cover/body files upload directly through StoragePort presigns; cover
  has preview/remove/alt/dimensions, and optional author plus meta counters/search-social preview are
  available. Existing Markdown opens as sanitized editor HTML and becomes HTML on first save.
  Gotcha: source mode, iframe, inline style, SVG/GIF and files over 5 MB are intentionally excluded.
  Related: `ArticleForm.tsx`, admin content controller/DTO, content sanitizer.
- **Admin exam-calendar editor** — `exams` + `exam_events` CRUD (audited, ADMIN/EDITOR); event types
  extended (`APPLICATION_*`, `RESULT_DATE`); trust metadata required. Surfacing new event types on
  web = backlog. *(0024.)*
- **Admin refund + subscription view** — record-only refund + cancel on user-detail (audited,
  FINANCE); `SubscriptionsService.getAdminView` + `refundLastCharge` (atomic, `SELECT … FOR UPDATE`,
  capped). See [payments.md](./payments.md). *(0025.)*
- **Admin metrics dashboard** — read-only KPI snapshot on `/` (users · subscriptions/revenue ·
  economy). Aggregates each module's public stats service (no mutation → no audit; ADMIN-only).
  Cross-tenant aggregates in SERVICE context. No migration. *(0026.)*
- **Fine admin sub-roles** — split coarse `ADMIN` into `SUPPORT`/`FINANCE`/`MODERATOR`/`SUPER_ADMIN`;
  umbrella-aware `RolesGuard` (backward-compat, zero migration); generic role assignment endpoint
  (SUPER_ADMIN-only, allowlist excludes SUPER_ADMIN/ADMIN — no privilege escalation); UI role panels
  + menu/HomeCards gating. **Closes W6 functional scope.** *(0028.)*

## Gotchas / Known issues

- **Admin never queries other modules' tables** — only their exported services (workstreams §3).
- **Admin reads MUST run in SERVICE context** — the public-read RLS policy hides drafts under enforced
  RLS (prod/Neon). Local `mentor` superuser bypasses RLS, which masks this (caught in review).
- **KVKK anonymize is soft** — keeps the row (FK/audit/ledger intact); behavioral free-text
  (`mood_checkins.struggle_note`, `vision_boards.motivation`) is NOT scrubbed by the current
  anonymize (holistic erasure = W6/identity follow-up; tables are `onDelete: cascade`).
- **JWT staleness** — roles live in the access token → a newly assigned role takes effect on the
  **next refresh** (current token keeps old roles). Acceptable with short access TTL.
- **Self-escalation blocked** — the assignable allowlist excludes SUPER_ADMIN/ADMIN, so no SUPER_ADMIN
  can mint another via the API. STAFF is assigned only through its dedicated endpoint (kept for
  backward compat). Bootstrap the first super-admin via SQL.
- **STAFF entitlement unaffected** (payments checks STAFF separately); sub-roles grant no premium.
- **MODERATOR is reserved** (forum/community moderation, Phase 2) — assignable now but gates no
  endpoints yet.
- **Audit write is post-commit, best-effort-but-loud** — for stronger atomicity a future slice can
  move sensitive audits into the mutation tx.
- **Money minor-units** — API returns `*Minor` (kuruş); FE only formats — no FE calculation, no float.
- **`apps/admin` Duralux demo pages** still build (use the default unauthenticated AuthContext) as UX
  reference; `next build` sets `typescript.ignoreBuildErrors:true` because off-menu demo pages fail
  Next's generated route types — `pnpm typecheck` (scoped to `.ts/.tsx`) is the gate.
- **Admin CI lint** — `.eslintrc.json` + scoped `next lint --dir …` (Mentor-owned paths only; Duralux
  template excluded).

## Backlog

- MODERATOR endpoints (forum/community — Phase 2) · ADMIN→SUPER_ADMIN full migration/deprecation ·
  org-scoped roles (ORG_ADMIN/COACH — Phase 2/3) · assigning SUPER_ADMIN from the UI (currently
  SQL-only) · admin table pagination UI · coaching engagement metrics (needs a coaching stats
  service) · time-series trend charts.

## Related

- Seam: consumes [identity.md](./identity.md) (UsersService), [content.md](./content.md)
  (ContentService), [payments.md](./payments.md) (SubscriptionsService), [economy.md](./economy.md)
  (EconomyService/InviteService), [notifications.md](./notifications.md) (ConfigRegistryService)
- UI: `apps/admin` (Duralux) — see `apps/admin/AGENTS.md`
- Status: [core/mvp-status.md](../core/mvp-status.md) (W6)
