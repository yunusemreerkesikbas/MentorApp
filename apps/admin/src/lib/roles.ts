// Admin panel RBAC helpers (§9). Mirrors the API: ADMIN/SUPER_ADMIN are the umbrella (see anything);
// scoped sub-roles (EDITOR/SUPPORT/FINANCE/MODERATOR) match the item's declared roles.
// Role lists derive from @mentor/types so the FE never drifts from the API's authz contract.
import { UserRole, ASSIGNABLE_ROLES as ASSIGNABLE_ROLES_CONTRACT } from "@mentor/types";

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

/**
 * Roles a SUPER_ADMIN may assign from the UI — the single source of truth is @mentor/types.
 * Includes COACH (W8): assignable here, but absent from ADMIN_PANEL_ROLES above, so granting it
 * never lets that user into this panel (§9 "delegated authority is not admin access").
 */
export const ASSIGNABLE_ROLES = ASSIGNABLE_ROLES_CONTRACT;

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

/**
 * Roles worth offering as a user-list filter: everything except STUDENT, which every account
 * carries by default and would therefore filter nothing. COACH is the reason this exists — a role
 * is not part of a name or an email, so free-text search can never answer "who are my coaches",
 * and that is the first question before `mentorship.enabled` is ever switched on.
 */
export const FILTERABLE_ROLES: readonly string[] = Object.values(UserRole).filter(
  (role) => role !== UserRole.STUDENT,
);
