import { UserRole, ZoneRole } from "@mentor/types";

/**
 * Two-plane authz (design 2026-06-22, §3). Framework-free pure logic — no NestJS/Drizzle.
 *
 * Plane 1 = platform role (global): staff override on every zone, admin panel, PII.
 * Plane 2 = zone role (scoped to one zone): an external OWNER/MODERATOR governs only their zone.
 */
export interface ForumActor {
  userId: string;
  /** Platform roles from the JWT (`users.roles`). */
  platformRoles: string[];
  /** The actor's role IN the target zone, or null if not a member. */
  zoneRole: ZoneRole | null;
}

/** Platform staff that override zone-level authz (curate, moderate any zone). */
const STAFF_ROLES: readonly string[] = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.MODERATOR,
  UserRole.EDITOR,
  UserRole.STAFF,
];

export function isPlatformStaff(roles: string[]): boolean {
  return roles.some((r) => STAFF_ROLES.includes(r));
}

/** Zone creation + OWNER assignment is curated — platform staff only (MVP). */
export function canCreateZone(roles: string[]): boolean {
  return isPlatformStaff(roles);
}

/** Moderate/approve within a zone: platform staff (override) OR that zone's OWNER/MODERATOR. */
export function canModerateZone(actor: ForumActor): boolean {
  if (isPlatformStaff(actor.platformRoles)) return true;
  return actor.zoneRole === ZoneRole.OWNER || actor.zoneRole === ZoneRole.MODERATOR;
}

/** Approving a pending join request is a moderation action. */
export const canApproveMember = canModerateZone;
