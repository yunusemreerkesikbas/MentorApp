import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@mentor/types";

export const ROLES_KEY = "roles";

/** Requires the authenticated user to hold AT LEAST ONE of the given roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
