import { UserRole, ZoneMemberStatus, ZoneRole, ZoneType } from "@mentor/types";

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

/** Remove an active member or reject a pending request. OWNER cannot be removed. */
export function canRemoveMember(actor: ForumActor, targetRole: ZoneRole): boolean {
  if (targetRole === ZoneRole.OWNER) return false;
  return canModerateZone(actor);
}

/**
 * Who may post a feed item (Slice 2):
 *  - ANNOUNCEMENT → broadcast: only owner/mod or platform staff.
 *  - CHAT → any ACTIVE member (join-to-participate), or owner/mod/staff.
 * (QA posting rules arrive in Slice 3.)
 */
export function canPostInZone(
  actor: ForumActor,
  zoneType: string,
  memberStatus: string | null,
): boolean {
  if (zoneType === ZoneType.ANNOUNCEMENT) return canModerateZone(actor);
  // CHAT messages + QA questions/answers: any ACTIVE member, or owner/mod/staff.
  if (zoneType === ZoneType.CHAT || zoneType === ZoneType.QA) {
    return memberStatus === ZoneMemberStatus.ACTIVE || canModerateZone(actor);
  }
  return false;
}

/**
 * Who may comment on a CHAT/ANNOUNCEMENT thread (APP-017). Unlike posting, commenting on an
 * ANNOUNCEMENT is open to any ACTIVE member (broadcast stays mod-only; discussion under it does not).
 * QA replies keep their own path (`canPostInZone` + answer flow), so this covers CHAT + ANNOUNCEMENT.
 */
export function canCommentInZone(
  actor: ForumActor,
  zoneType: string,
  memberStatus: string | null,
): boolean {
  if (zoneType !== ZoneType.CHAT && zoneType !== ZoneType.ANNOUNCEMENT) return false;
  return memberStatus === ZoneMemberStatus.ACTIVE || canModerateZone(actor);
}

/** Only the question's author may accept an answer (asker-only; no staff override in MVP). */
export function canAcceptAnswer(actor: ForumActor, questionAuthorId: string): boolean {
  return actor.userId === questionAuthorId;
}

/** Delete a thread: its author, or a zone owner/mod / platform staff (moderation). */
export function canDeleteThread(actor: ForumActor, authorId: string): boolean {
  return actor.userId === authorId || canModerateZone(actor);
}

/** Pin/unpin is a moderation action. */
export const canPinThread = canModerateZone;
