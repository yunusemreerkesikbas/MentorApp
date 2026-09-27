import { MentorshipSeat, type MentorshipSeatId } from "@mentor/types";

/** One live link as the seat decision reads it. */
export interface SeatedLink {
  id: string;
  acceptedAt: Date;
  /** What the link holds now (`coach_students.seat`). */
  seat: MentorshipSeatId;
  /** The student pays for their own Premium right now (payments decides). */
  selfPaying: boolean;
}

/**
 * Who holds which seat on one coach's links. Every trigger asks this one function (a student
 * accepting, a coach's or a student's subscription changing, a link ending, the coach opening their
 * home), so the answer never depends on which door asked.
 *
 * - One payer per student: a student paying for their own Premium holds no seat (SELF).
 * - A free seat already held stays held, even past a lowered `free_seats`: lowering the quota shapes
 *   who gets a seat next and takes none back.
 * - Everyone else, oldest link first, takes a free seat, then one of the plan's, else waits (NONE).
 *   So when a plan shrinks or ends, the newest students freeze first, and when seats return the
 *   longest waiting come back first.
 *
 * Pure: no clock, no I/O. Ties on the acceptance time break by id, so every caller agrees.
 */
export function assignSeats(
  links: readonly SeatedLink[],
  quota: { freeSeats: number; paidSeats: number },
): Map<string, MentorshipSeatId> {
  const ordered = [...links].sort(
    (a, b) => a.acceptedAt.getTime() - b.acceptedAt.getTime() || a.id.localeCompare(b.id),
  );
  const heldFree = ordered.filter(
    (link) => !link.selfPaying && link.seat === MentorshipSeat.FREE,
  ).length;
  let free = Math.max(quota.freeSeats - heldFree, 0);
  let paid = Math.max(quota.paidSeats, 0);

  const seats = new Map<string, MentorshipSeatId>();
  for (const link of ordered) {
    if (link.selfPaying) {
      seats.set(link.id, MentorshipSeat.SELF);
    } else if (link.seat === MentorshipSeat.FREE) {
      seats.set(link.id, MentorshipSeat.FREE);
    } else if (free > 0) {
      free -= 1;
      seats.set(link.id, MentorshipSeat.FREE);
    } else if (paid > 0) {
      paid -= 1;
      seats.set(link.id, MentorshipSeat.PAID);
    } else {
      seats.set(link.id, MentorshipSeat.NONE);
    }
  }
  return seats;
}

/** Stands in for the link that does not exist yet. Link ids are UUIDs, so this cannot collide. */
const NEWCOMER = "newcomer";

/**
 * The seat a student accepting an invite lands on, decided after everyone already linked (the
 * newest link goes last), so a student already waiting for a seat is never overtaken. NONE means
 * refuse the link: accepting never creates a frozen one.
 */
export function seatForNewcomer(
  existing: readonly SeatedLink[],
  newcomer: { acceptedAt: Date; selfPaying: boolean },
  quota: { freeSeats: number; paidSeats: number },
): MentorshipSeatId {
  const seats = assignSeats(
    [...existing, { ...newcomer, id: NEWCOMER, seat: MentorshipSeat.NONE }],
    quota,
  );
  return seats.get(NEWCOMER)!;
}
