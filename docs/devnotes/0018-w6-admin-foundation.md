# 0018 — W6 · Admin foundation (STAFF assignment + audit log + admin UI shell)

> Date: 2026-06-12 · Scope: api (admin module) + admin (Duralux app) + db · Related: roadmap §9/§3, workstreams W6

## What was done
- **`modules/admin` (NestJS):** first vertical slice of W6. Canonical layering
  (domain/application/infrastructure/presentation). Endpoints under `/v1/admin`, all gated by
  `@Roles(ADMIN)` (global `JwtAuthGuard` + `RolesGuard`); admin acts cross-user so repositories run
  in **SERVICE context** (`withServiceContext`, RLS self-belt bypassed).
  - `GET /admin/users?q=&page=&pageSize=` — search users (email/display name).
  - `POST` / `DELETE /admin/users/:userId/roles/staff` — grant/revoke STAFF (idempotent). Closes the
    devnote-0015 gap (STAFF was assigned by manual SQL). STAFF ⇒ always-premium without a sub row.
  - `GET /admin/audit-log` — newest-first audit trail.
- **Audit log (§9) — table + interceptor:** `admin_audit_log` (append-only, never updated/deleted;
  RLS SERVICE/ADMIN-only). `@Audit('staff.assign'|'staff.revoke')` marks a handler; the
  `AdminAuditInterceptor` writes one row on success (actor/action/ip/ts always; target + before/after
  roles when the handler calls `setAuditContext`). `AdminAuditService` is **exported** for reuse by
  later admin sub-features (content editor, refund, flags).
- **Admin UI = Duralux template, adopted as-is** (product decision): the `apps/duralux` Bootstrap 5 /
  Next 14 / **JavaScript** template was moved to **`apps/admin`** (replacing the old Next 16/Tailwind
  scaffold) and renamed `@mentor/admin` (port 3002). Menu trimmed to Panel · Kullanıcılar · Audit Log;
  CRM demo pages kept off-menu as UX reference. Wired to the real API: `src/lib/apiClient.js` (axios +
  bearer + 401→/login), `src/lib/auth.js` (token), `/login` (real `POST /v1/auth/login`),
  `/users` (search + STAFF toggle via SweetAlert2), `/audit-log`.
- **Migration `0008_w6_admin_audit_log.sql`** (admin_audit_log + RLS). Append-only: no UPDATE/DELETE
  policy ⇒ rows immutable. Error code `ADMIN_USER_NOT_FOUND` (+ TR/EN locales).
- **Tests:** `admin-users.service.spec.ts` (6, no DB — grant/revoke idempotency, NotFound, no
  passwordHash leak) + `test/admin.e2e-spec.ts` (5, real Postgres + RLS — 401/403 gating, STAFF
  grant+idempotent+audit row, revoke, 404). All green.

## How to use (usage)
```bash
pnpm --filter @mentor/api dev           # api :3001
pnpm --filter @mentor/admin dev         # admin :3002 (Bootstrap/Next14)
# Bootstrap an ADMIN (no self-service): grant ADMIN via SERVICE-context SQL (cf. devnote 0015):
#   begin; select set_config('app.role','SERVICE',true);
#   update users set roles = array_append(roles,'ADMIN') where lower(email)=lower('you@ex.com'); commit;
# Then admin /login → /users → STAFF toggle → /audit-log shows the entry.
```
- Add a new audited admin endpoint: `@Roles(ADMIN)` + `@UseInterceptors(AdminAuditInterceptor)` on the
  controller, `@Audit('<action>')` on the handler, and `setAuditContext(req, { targetType, targetId,
  before, after })` for rich diffs.

## Gotchas
- **`apps/admin` is JS + Bootstrap + npm — an accepted deviation** from the Tailwind/`@mentor/ui`/TS/
  pnpm norm (internal team tool; see `apps/admin/AGENTS.md`). It installs deps with **npm**
  (`package-lock.json`, local `node_modules`); a root `pnpm install` is not required to run it. Full
  pnpm-workspace integration / TS migration is a deliberate later follow-up — don't convert piecemeal.
- **Migration ordering:** W5's `0007_w5_notifications.sql` existed without a `0007_snapshot.json`, so
  `drizzle-kit generate` re-emitted the notification tables into 0008. Fixed by hand-trimming 0008 to
  **only** `admin_audit_log`; the generated `0008_snapshot.json` (full state) heals the baseline for
  the next track. Lesson: always commit the snapshot with your migration.
- Audit write is **post-commit, best-effort-but-loud** (interceptor runs after the tx): a failed audit
  write is logged at error level, never fails the admin action. For stronger atomicity a future slice
  can move sensitive audits into the mutation tx.
- STAFF toggle changes entitlement (devnote 0015) — sensitive, hence always audited.

## Related files & decisions
- `apps/api/src/modules/admin/**` · `database/schema.ts` (W6 block) · `drizzle/0008_*.sql`
- `apps/api/src/app.module.ts` (AdminModule, alphabetical) · `packages/validation/src/admin.ts`
- `apps/admin/**` (Duralux) · `apps/admin/src/lib/{apiClient,auth}.js` · `apps/admin/AGENTS.md`
- Decision: economy (coin/XP/invite/quest) is the **next** W6 slice — schema seam noted in `schema.ts`.
