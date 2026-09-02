/**
 * Mentorship domain constants (W8) — the HUMAN coach relation.
 *
 * Naming: `coach_*` belongs to the AI companion (W3). Everything this module adds is `mentorship_*`.
 * The single exception is the pre-existing `coach_students` table, which has always meant the human
 * link (roadmap §11) and is not worth a rename migration.
 */

/** Invite-code prefix. `KOC` keeps it visually distinct from the economy `MENTOR-` friend code. */
export const MENTORSHIP_INVITE_CODE_PREFIX = "MENTOR-KOC-";

/** Bytes of entropy behind a code → 12 uppercase hex chars (48 bits). */
export const MENTORSHIP_INVITE_CODE_BYTES = 6;

/** Domain events (topic format `module.entity.action` — §8 event backbone). */
export const MentorshipEventTopic = {
  LINK_ACCEPTED: "mentorship.link.accepted",
  LINK_ENDED: "mentorship.link.ended",
} as const;

/** A student accepted a coach's invite. Carries display names so listeners need no extra lookup. */
export class MentorshipLinkAccepted {
  constructor(
    readonly linkId: string,
    readonly coachId: string,
    readonly studentId: string,
    readonly studentDisplayName: string,
    readonly coachDisplayName: string,
  ) {}
}

/** Either side ended the link. `endedBy` is the actor; the notification goes to the other party. */
export class MentorshipLinkEnded {
  constructor(
    readonly linkId: string,
    readonly coachId: string,
    readonly studentId: string,
    readonly endedBy: string,
    readonly actorDisplayName: string,
  ) {}
}
