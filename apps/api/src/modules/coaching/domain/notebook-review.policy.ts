/**
 * Spaced review ladder for the mistake notebook.
 *
 * A fixed interval ladder, deliberately not SM-2: an adaptive algorithm needs a difficulty signal
 * we do not have (there is no grade here, only "could you do it this time?"), and its parameters
 * cannot be calibrated without real usage. Three rungs is the shortest schedule that still spans
 * the forgetting curve a student cares about — a few days, a week, three weeks.
 *
 * ponytail: fixed ladder; move to a per-entry adaptive interval only if the data shows students
 * healing too early or grinding the same card forever.
 */

/** Days from a successful review to the next one. Its length is the number of rungs to HEALED. */
export const NOTEBOOK_REVIEW_LADDER_DAYS = [2, 7, 21] as const;

/** A failed review starts the ladder over — the card is clearly not learned yet. */
const RELAPSE_DAYS = NOTEBOOK_REVIEW_LADDER_DAYS[0];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ReviewOutcome {
  /** `null` once the entry leaves the rotation; that is also how the due query stops finding it. */
  nextReviewAt: Date | null;
  /**
   * `ARCHIVED` is here because an early answer leaves the card exactly as it found it, and a card
   * the student took out of the rotation can still be opened and answered from its page.
   */
  status: "ACTIVE" | "HEALED" | "ARCHIVED";
  reviewCount: number;
}

/** What the caller knows about the card at the moment it is answered. */
export interface ReviewInput {
  /** Consecutive successes so far. */
  reviewCount: number;
  solved: boolean;
  /** The date this card was scheduled for; null when it is not in the rotation at all. */
  dueAt: Date | null;
  status: "ACTIVE" | "HEALED" | "ARCHIVED";
  now?: Date;
}

/**
 * Advance one entry after the student answers "could you do it this time?".
 *
 * `reviewCount` counts *consecutive successes*, so a relapse resets it to 0 rather than just
 * stepping back one rung: a card missed at the three-week mark is not a card that was nearly
 * learned, and treating it as one is how an entry ping-pongs forever at the top of the ladder.
 *
 * A card can also be answered *before* it is due — a student who wants to drill something today
 * rather than wait two days, or one looking at a single card they opened from a page. That is a
 * different act and it is scored differently:
 *
 * - Answered early and solved: nothing moves. The interval measures whether the answer survived
 *   the gap, and there was no gap — promoting here would let anyone climb a card to twenty-one days
 *   in an afternoon and call it learned.
 * - Answered early and missed, while still in the rotation: the card comes back in two days.
 *   Discovering you cannot do it is real information whenever it arrives, and it should cost the
 *   card its place.
 * - Answered early and missed, while archived or healed: nothing moves. The student took this card
 *   out of the rotation deliberately; one answer given in passing is not them asking for it back.
 */
export function advanceReview({
  reviewCount,
  solved,
  dueAt,
  status,
  now = new Date(),
}: ReviewInput): ReviewOutcome {
  const early = dueAt === null || now.getTime() < dueAt.getTime();
  if (early) {
    if (!solved && status === "ACTIVE") {
      return {
        nextReviewAt: new Date(now.getTime() + RELAPSE_DAYS * MS_PER_DAY),
        status: "ACTIVE",
        reviewCount: 0,
      };
    }
    return { nextReviewAt: dueAt, status, reviewCount };
  }

  if (!solved) {
    return {
      nextReviewAt: new Date(now.getTime() + RELAPSE_DAYS * MS_PER_DAY),
      status: "ACTIVE",
      reviewCount: 0,
    };
  }

  const next = reviewCount + 1;
  if (next >= NOTEBOOK_REVIEW_LADDER_DAYS.length) {
    return { nextReviewAt: null, status: "HEALED", reviewCount: next };
  }
  return {
    nextReviewAt: new Date(
      now.getTime() + NOTEBOOK_REVIEW_LADDER_DAYS[next]! * MS_PER_DAY,
    ),
    status: "ACTIVE",
    reviewCount: next,
  };
}

export function firstReviewAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + NOTEBOOK_REVIEW_LADDER_DAYS[0]! * MS_PER_DAY);
}
