import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@mentor/types";

export const ROLES_KEY = "roles";

/** Requires the authenticated user to hold AT LEAST ONE of the given roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Full-access admin roles that satisfy ANY `@Roles(...)` requirement (super-admin bypass, §9).
 * ADMIN is the legacy umbrella (kept for backward compat); SUPER_ADMIN is the explicit top.
 * Scoped sub-roles (SUPPORT/FINANCE/MODERATOR/EDITOR) are matched normally.
 */
export const ADMIN_FULL_ACCESS_ROLES: readonly UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
