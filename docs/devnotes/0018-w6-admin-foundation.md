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

## Admin shell hardening (follow-up in same slice)
- **Auth core:** `contentApi/authProvider.jsx` (loads `GET /v1/users/me`, requires ADMIN role else
  → `/login`) + `components/shared/AdminShell.jsx` (AuthProvider + loading gate + Header/Nav). Both
  shells — the `(general)` group layout and the root `/` page (`duplicateLayout.js`) — now route
  through `AdminShell`, so every authenticated page is guarded. `lib/auth.js` holds the token.
- **Header:** stripped Duralux demo (search / languages / notifications / timesheets / mega-menu);
  kept nav toggles + fullscreen + theme. New `header/AdminProfile.jsx` shows the signed-in admin
  (name/email/roles) + **logout** (`clearToken` → `/login`).
- **De-Duralux:** sidebar brand → "Mentor" (text, no logo asset), removed "Downloading Center" promo;
  root `/` → real admin home (cards → Kullanıcılar / Audit Log) instead of the CRM demo dashboard;
  ThemeCustomizer "Download" link removed. Off-menu CRM demo pages still build (use the default,
  unauthenticated AuthContext) as UX reference.
- **Verified:** `pnpm --filter @mentor/admin build` green; live — `/users/me` returns ADMIN, `/`
  SSR shows Mentor brand + cards with no Duralux leftovers, `/login` renders. (Interactive
  click-through of guard/logout pending a browser MCP session.)

## TypeScript (hybrid, follow-up in same slice)
- **Our code is now TypeScript**, the Duralux template stays JS — a deliberate hybrid (Next `allowJs`).
  Converted to `.ts/.tsx`: `lib/{apiClient,auth,types}`, `contentApi/authProvider`, `AdminShell`,
  `header/AdminProfile`, the 4 pages (`/`, `/login`, `/users`, `/audit-log`), the two shells
  (`(general)/layout`, `duplicateLayout`), `utils/fackData/menuList`. Edited Duralux files
  (Header/Nav/Menus/ThemeCustomizer/PageHeader) remain `.jsx`.
- **Types:** shared identity types from `@mentor/types` (`AuthUser`, `UserRole` — type-only import,
  no runtime coupling); admin API shapes in `src/lib/types.ts` (`AdminUserView`, `AuditEntry`).
- **Config:** `tsconfig.json` (`strict` + `allowJs` + `checkJs:false`), `@types/{react,react-dom,node}@18`,
  `@mentor/types` dep. `pnpm typecheck` → `tsc -p tsconfig.typecheck.json` (scoped to `.ts/.tsx` only,
  so the JS template + demo pages aren't checked). `next build` sets `typescript.ignoreBuildErrors:true`
  because off-menu Duralux demo pages fail Next's generated route types — `pnpm typecheck` is the gate.
- **Verified:** `pnpm --filter @mentor/admin typecheck` + `build` green; live (Claude_Preview) — guard
  redirect, login, home (Mentor brand, no Duralux), `/me`-driven profile, and logout all pass.

## User management deepening (follow-up in same slice)
- **Endpoints** (admin module, `@Roles(ADMIN)` + audited): `GET /admin/users/:id` (detail, secret-free) ·
  `PATCH /admin/users/:id/status` `{ACTIVE|SUSPENDED|BANNED}` (`user.status`) · `GET …/export` (KVKK
  identity-data JSON, no passwordHash — `user.kvkk-export`) · `POST …/anonymize` (KVKK erasure —
  `user.kvkk-anonymize`).
- **KVKK = anonymization (soft), not hard-delete:** scrub PII (email→`deleted+<id>@anonymized.local`,
  name→"Silinmiş Kullanıcı", clear examType/Date) + status BANNED, keep the row → FK/audit/ledger
  intact. Repo does it in one `FOR UPDATE` SERVICE tx returning before/after.
- **Self-lockout guard:** an admin can't change their own status / anonymize self →
  `ADMIN_CANNOT_MODIFY_SELF` (403). `userStatusSchema` in `@mentor/validation`.
- **Detail/export scope = identity data only** this slice; subscription/coaching/ai data is cross-module
  → later slice.
- **Frontend (TS):** `users/[id]/page.tsx` (detail + status buttons + KVKK export[Blob download]/anonymize,
  SweetAlert2) + "Detay" link & status badge on the list. `AdminUserDetail` in `src/lib/types.ts`.
- **Verified:** unit 10/10 + e2e 11/11 (status/self-403/invalid-400/export/anonymize) green; admin
  typecheck + build green; live (Claude_Preview) — detail, suspend+audit, export (no passwordHash),
  reactivate all pass.
- **Code-review fixes (this slice):** (F1, KVKK) the anonymize audit records `{anonymized:true,
  scrubbedFields:[…]}` — NOT the erased email/name — so the append-only trail doesn't defeat erasure
  (e2e asserts the old email is absent from the audit row). (F2) audit interceptor uses `req.user!.id`
  (guard-guaranteed) instead of a `?? ""` fallback that would hit the FK. (F4) dropped a redundant
  `examDate` re-assignment in `exportData`. Backlog: LIKE-wildcard escaping in user search, admin
  table pagination UI, GET-with-audit-side-effect on export.

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
- **`apps/admin` is JS + Bootstrap — an accepted deviation** from the Tailwind/`@mentor/ui`/TS norm
  (internal team tool; see `apps/admin/AGENTS.md`). **Deps are pnpm-managed** (normal workspace
  member) — the deviation is about code/design, not the package manager. The Duralux template was
  originally npm-installed; moving it in left a `package-lock.json` + npm `node_modules` that made
  `pnpm dev` fail (pnpm moved them to `.ignored` and then `ERR_PNPM_IGNORED_BUILDS: core-js`). Fix:
  removed `apps/admin/package-lock.json` and set an explicit build decision `core-js: false` in
  `pnpm-workspace.yaml` (`allowBuilds`; its postinstall is only a funding message). Lesson: don't run
  `npm install` inside a pnpm workspace app — use `pnpm --filter @mentor/admin add`.
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
