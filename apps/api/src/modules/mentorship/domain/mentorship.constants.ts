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

/**
 * How far ahead a coach may assign. `isoDateSchema` itself is unbounded, so without this a task
 * could land in year 9999 and sit in the student's calendar forever. A term is the honest ceiling
 * for "homework"; anything beyond that is a study plan, which is a different feature.
 */
export const MENTORSHIP_ASSIGNMENT_MAX_DAYS_AHEAD = 120;

/** Domain events (topic format `module.entity.action` — §8 event backbone). */
export const MentorshipEventTopic = {
  LINK_ACCEPTED: "mentorship.link.accepted",
  LINK_ENDED: "mentorship.link.ended",
  ASSIGNMENTS_CREATED: "mentorship.assignments.created",
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

/** A coach assigned one or more plan tasks. The student is the one who hears about it. */
export class MentorshipAssignmentsCreated {
  constructor(
    readonly linkId: string,
    readonly coachId: string,
    readonly studentId: string,
    readonly coachDisplayName: string,
    readonly taskCount: number,
    /** Earliest assigned date, so the notification can link to the day the work starts. */
    readonly firstTaskDate: string,
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
