# 0028 — W6 · Fine Admin Sub-Roles (MODERATOR/SUPPORT/FINANCE/SUPER_ADMIN)

> Date: 2026-06-16 · Scope: api (auth guard + every admin controller + role assignment) + admin UI +
> packages/types · Related: roadmap §9 (panel RBAC), AGENTS §4. **Closes W6's functional scope.**

## What was done
- Split coarse `ADMIN` into **scoped sub-roles** (§9 least-privilege). Added `SUPPORT`, `FINANCE`,
  `MODERATOR`, `SUPER_ADMIN` to `UserRole`. **No migration** (roles are `users.roles` text[], embedded in
  the JWT — new string values flow on next token refresh).
- **Guard umbrella:** `RolesGuard` now bypasses any `@Roles` when the user holds a full-access role
  (`ADMIN_FULL_ACCESS_ROLES = [ADMIN, SUPER_ADMIN]`). ADMIN stays the legacy umbrella → **existing admins keep
  full access, zero migration**. Each endpoint declares only its scoped sub-role; method-level `@Roles`
  overrides class-level (NestJS handler-first).
- **Endpoint matrix:** content/exam→`EDITOR`; user read (search/detail)→`SUPPORT,FINANCE`; status→`SUPPORT`;
  KVKK export/anonymize + audit-log + role/STAFF assignment→`SUPER_ADMIN`; subscription/economy view→
  `SUPPORT,FINANCE`, refund/cancel/adjust→`FINANCE`; metrics→`SUPPORT,FINANCE`; config→`SUPER_ADMIN`.
- **Generic role assignment:** `POST/DELETE /admin/users/:id/roles/:role` (`@Roles(SUPER_ADMIN)`, audited
  `role.assign`/`role.revoke`). Allowlist `ASSIGNABLE_ADMIN_ROLES` (`@mentor/types`) = EDITOR/SUPPORT/FINANCE/
  MODERATOR — **never SUPER_ADMIN/ADMIN** (no privilege escalation; bootstrap the first super-admin via SQL)
  or STAFF (its own endpoint). Service double-checks the allowlist (`ADMIN_ROLE_NOT_ASSIGNABLE` → 400).
- **Admin UI:** `lib/roles.ts` (`canSee`/`canEnterPanel`/`isFullAccess` — umbrella-aware, mirrors the API).
  AuthProvider admits any admin role; menu/HomeCards/MetricsCards gate via `canSee`; user-detail gains a
  **Roller** panel (SUPER_ADMIN/ADMIN) to grant/revoke sub-roles. STAFF stays on the users-list toggle.

## How to use (usage)
```bash
# Bootstrap first super-admin (SQL): update users set roles = array_append(roles,'SUPER_ADMIN') where id=...
# SUPER_ADMIN → user-detail → Roller: ver/al (EDITOR/SUPPORT/FINANCE/MODERATOR).
# API: POST /v1/admin/users/:id/roles/FINANCE · DELETE …/roles/FINANCE  (SUPER_ADMIN; audited)
```

## Gotchas
- **Backward compat:** ADMIN remains full-access (umbrella) → existing ADMIN users/tokens work unchanged,
  **no data migration**. SUPER_ADMIN is the new explicit top; ADMIN = legacy alias (deprecate later).
- **JWT staleness:** roles live in the access token → a newly assigned role takes effect on the **next
  refresh** (current token keeps old roles). Acceptable with short access TTL.
- **Guard change is global:** the super-admin bypass affects every `@Roles` route; today only admin routes
  use `@Roles`, so blast radius is low. Method-override (handler-first) preserved.
- **Self-escalation blocked:** the assignable allowlist excludes SUPER_ADMIN/ADMIN, so no SUPER_ADMIN can
  mint another via the API. STAFF is assigned only through its dedicated endpoint (kept for backward compat).
- **STAFF entitlement** unaffected (payments checks STAFF separately); sub-roles grant no premium.
- **MODERATOR** is reserved (forum/community moderation, Phase 2) — assignable now but gates no endpoints yet.

## Related files & decisions
- `packages/types/src/index.ts` (UserRole + `ASSIGNABLE_ADMIN_ROLES`)
- `apps/api/src/common/auth/roles.{decorator,guard}.ts` (umbrella) · every `apps/api/src/modules/admin/presentation/*.controller.ts`
- `apps/api/src/modules/admin/application/admin-users.service.ts` (`grantRole`/`revokeRole`) · `domain/admin.constants.ts` · `error-code.ts` (+ i18n)
- `apps/admin/src/lib/roles.ts` · `contentApi/authProvider.tsx` · `components/shared/navigationMenu/Menus.jsx` ·
  `utils/fackData/menuList.ts` · `app/{HomeCards,MetricsCards}.tsx` · `app/(general)/users/[id]/page.tsx`
- **Verified:** e2e `admin-rbac` 6 (SUPPORT/FINANCE/SUPER_ADMIN/ADMIN-umbrella matrix; allowlist 400; assign 403
  for non-super); full `admin-*` e2e suite green (existing ADMIN/EDITOR specs still pass via umbrella);
  api lint+typecheck, admin typecheck+build green.
- Decisions (owner): guard-hierarchy umbrella; economy adjust → FINANCE; role assignment SUPER_ADMIN-only +
  SUPER_ADMIN SQL-bootstrap; full UI.

## Backlog
- MODERATOR endpoints (forum/community — Phase 2). · ADMIN→SUPER_ADMIN full migration/deprecation.
- Org-scoped roles (ORG_ADMIN/COACH — Phase 2/3). · Assigning SUPER_ADMIN from the UI (currently SQL-only).
