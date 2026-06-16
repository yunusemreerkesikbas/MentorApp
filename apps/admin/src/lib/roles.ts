// Admin panel RBAC helpers (§9). Mirrors the API: ADMIN/SUPER_ADMIN are the umbrella (see anything);
// scoped sub-roles (EDITOR/SUPPORT/FINANCE/MODERATOR) match the item's declared roles.
// Role lists derive from @mentor/types so the FE never drifts from the API's authz contract.
import { UserRole, ASSIGNABLE_ADMIN_ROLES } from "@mentor/types";

/** Full-access roles that satisfy any gate (mirror of the API guard umbrella). */
export const FULL_ACCESS_ROLES: readonly string[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

/** Roles allowed into the admin panel at all (route guard allow-list). */
export const ADMIN_PANEL_ROLES: readonly string[] = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.EDITOR,
  UserRole.SUPPORT,
  UserRole.FINANCE,
  UserRole.MODERATOR,
];

/** Sub-roles a SUPER_ADMIN may assign from the UI — the single source of truth is @mentor/types. */
export const ASSIGNABLE_ROLES = ASSIGNABLE_ADMIN_ROLES;

const has = (userRoles: readonly string[] | undefined, set: readonly string[]): boolean =>
  (userRoles ?? []).some((r) => set.includes(r));

/** Does the user hold a full-access (umbrella) role? */
export const isFullAccess = (userRoles: readonly string[] | undefined): boolean =>
  has(userRoles, FULL_ACCESS_ROLES);

/** May this user enter the admin panel? */
export const canEnterPanel = (userRoles: readonly string[] | undefined): boolean =>
  has(userRoles, ADMIN_PANEL_ROLES);

/**
 * Visibility gate mirroring the API: an item with no `roles` is open to any panel user; otherwise
 * the user must hold one of the item's roles OR a full-access role.
 */
export const canSee = (
  itemRoles: readonly string[] | undefined,
  userRoles: readonly string[] | undefined,
): boolean => !itemRoles || isFullAccess(userRoles) || has(userRoles, itemRoles);
