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
  status: "ACTIVE" | "HEALED";
  reviewCount: number;
}

/**
 * Advance one entry after the student answers "could you do it this time?".
 *
 * `reviewCount` counts *consecutive successes*, so a relapse resets it to 0 rather than just
 * stepping back one rung: a card missed at the three-week mark is not a card that was nearly
 * learned, and treating it as one is how an entry ping-pongs forever at the top of the ladder.
 */
export function advanceReview(
  reviewCount: number,
  solved: boolean,
  now: Date = new Date(),
): ReviewOutcome {
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
    nextReviewAt: new Date(now.getTime() + NOTEBOOK_REVIEW_LADDER_DAYS[next]! * MS_PER_DAY),
    status: "ACTIVE",
    reviewCount: next,
  };
}

/** First review is scheduled the moment an entry is created — nothing enters the book unscheduled. */
export function firstReviewAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + NOTEBOOK_REVIEW_LADDER_DAYS[0]! * MS_PER_DAY);
}
