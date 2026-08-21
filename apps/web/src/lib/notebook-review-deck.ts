/**
 * Pure logic for the mistake notebook's review deck: which way a swipe meant, and which card comes
 * next. Both are DOM-free so they can be tested without a browser — Playwright can drive a click,
 * but it cannot honestly drive a flick, and walking a deck of seven cards through every jump and
 * answer is a unit test's job, not an end-to-end one's.
 */

/**
 * Did this drag mean an answer, and which one?
 *
 * The card component reads the verdict and calls the matching callback, nothing more.
 *
 * ponytail: two thresholds, not a physics model. A deliberate slow drag is measured by distance and
 * a quick flick by speed; anything that is neither is a wobble and snaps back.
 */

/** Distance that counts as an answer on its own, however slowly it was dragged. */
export const SWIPE_THRESHOLD_PX = 120;

/** A flick this fast answers early — but only once it has also cleared `SWIPE_FLICK_MIN_PX`. */
export const SWIPE_VELOCITY_PX_PER_S = 500;

/**
 * Floor for the velocity path. Without it a fast twitch of a few pixels — the tail end of a tap on
 * a touchscreen — would answer the card, which is the one mistake this gesture must not make.
 */
export const SWIPE_FLICK_MIN_PX = 40;

export type SwipeVerdict = "solved" | "missed";

/**
 * Right = solved, left = missed, short of both thresholds = no answer.
 *
 * Direction is read from the offset, never the velocity: a drag that overshoots and is pulled back
 * ends with the two pointing opposite ways, and the card went where the offset says. For the same
 * reason a flick only counts when its velocity still agrees with the direction travelled — a
 * gesture being reeled back in is a cancel, not an answer.
 */
export function swipeVerdict(
  offsetX: number,
  velocityX: number,
): SwipeVerdict | null {
  const distance = Math.abs(offsetX);
  const far = distance >= SWIPE_THRESHOLD_PX;
  const flick =
    distance >= SWIPE_FLICK_MIN_PX &&
    Math.abs(velocityX) >= SWIPE_VELOCITY_PX_PER_S &&
    Math.sign(velocityX) === Math.sign(offsetX);

  if (!far && !flick) return null;
  return offsetX > 0 ? "solved" : "missed";
}

/**
 * Where the deck goes after a card is answered — or after the student jumps to one from the list.
 *
 * Not `index + 1`. The deck is a fixed set of cards taken when the panel opens, but the student can
 * jump anywhere in it from the list view, so "the next one" has to mean "the next one they have not
 * answered yet", wrapping past the end to pick up anything left behind earlier. `-1` means the deck
 * is finished, and it is the only thing that ends the session — counting answers would end it early
 * the first time a card was answered twice.
 */
export function nextUnansweredIndex(
  ids: readonly string[],
  answered: ReadonlySet<string>,
  from: number,
): number {
  for (let i = from + 1; i < ids.length; i += 1) {
    if (!answered.has(ids[i]!)) return i;
  }
  // Wrap: a card skipped over earlier is still due, and the deck should come back for it rather
  // than declaring the day done with cards left in it.
  for (let i = 0; i <= Math.min(from, ids.length - 1); i += 1) {
    if (!answered.has(ids[i]!)) return i;
  }
  return -1;
}
