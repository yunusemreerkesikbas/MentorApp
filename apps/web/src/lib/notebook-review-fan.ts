/**
 * The review deck's list view laid out as a hand of cards ("Yelpaze"): geometry only, no React.
 *
 * The list used to be a separate object, a stack of title slabs that replaced the card. Now the
 * review card and the list are one deck: the card the student is on shrinks into its slot in the
 * hand, the two cards drawn behind it spread out beside it, and the cards already answered sit on a
 * small pile in the top left corner. A tap lifts a card back up into the review card.
 *
 * Everything here is a pure function of the screen size and the deck's state. That is what lets the
 * spec pin down the two ways this view goes wrong without anyone noticing in a demo: a hand that
 * runs off a narrow screen, and a window that loses the card the student is browsing.
 *
 * Coordinates are offsets from the hand's middle slot. A card at `{ x: 0, y: 0, rotate: 0, scale: 1 }`
 * stands upright in the middle of the hand at hand size; the hand pivots on a point `radius` below
 * it, the way cards held in one hand pivot on the wrist.
 */

/** A card's resting place: offset from the middle slot, tilt, size against a hand card, stacking. */
export interface FanPlacement {
  x: number;
  y: number;
  /** Degrees, clockwise. */
  rotate: number;
  scale: number;
  opacity: number;
  z: number;
}

export interface FanGeometry {
  /** A hand card, 4:5 like the review card it shrinks from. */
  cardWidth: number;
  cardHeight: number;
  /** The middle slot's centre, in the fan's own box. */
  handX: number;
  handY: number;
  /** From a card's centre down to the point the hand pivots on. */
  radius: number;
  /** Degrees between neighbours on a hand small enough to spread out. */
  maxStep: number;
  /** Degrees from the middle to the outermost card dealt in full. */
  halfSpan: number;
  /** Cards dealt in full on each side of the window's middle; past that they are squeezed. */
  window: number;
  /** How far the browsed card rises out of the hand, along its own radius. */
  lift: number;
  /** The smaller rise a pointer gives the card under it. */
  hoverLift: number;
  /** Middle of the answered pile, in the fan's own box. */
  pileX: number;
  pileY: number;
  pileWidth: number;
  pileHeight: number;
  pileLabel: { left: number; top: number; width: number; align: "left" | "center" };
  /** Top of the arrow row under the hand. */
  navY: number;
  /** Pointer travel that moves the lifted card one slot. */
  dragStep: number;
}

/** The middle and the two cards behind it, as the panel draws them over the review card. */
export interface ReviewStackLayer {
  /** How many cards must still be unanswered for this layer to be worth drawing. */
  after: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
}

/**
 * The two cards drawn behind the review card, furthest first.
 *
 * Fixed values, not jitter: a random tilt per render is a pile that rearranges itself every time
 * React re-runs, and "the deck moved on its own" is a bug report. `after` is how many cards must
 * still be unanswered for that layer to be worth drawing — no point promising two more cards when
 * there is one.
 *
 * Here rather than in the panel because the hand is dealt *from* these two: the cards that spread
 * out beside the shrinking review card start exactly where the panel drew them.
 */
export const REVIEW_STACK_LAYERS: readonly ReviewStackLayer[] = [
  { after: 2, y: 26, rotate: 3.5, scale: 0.93, opacity: 0.45 },
  { after: 1, y: 14, rotate: -2.5, scale: 0.965, opacity: 0.7 },
];

/**
 * How long each part of the fan takes, in milliseconds.
 *
 * The deal is the one beat that stagger has to carry: the cards leave the review card nearest
 * first, so the hand visibly comes *out of* the card the student was on. The stagger is capped so
 * the last card of any hand lands by 600 ms, the `Moment` budget (DESIGN.md §9).
 */
export const FAN_TIMING = {
  dealMs: 480,
  dealStaggerMs: 24,
  dealStaggerCap: 5,
  /** The pile, the count and the arrows arrive once the hand has mostly landed. */
  chromeDelayMs: 300,
  chromeMs: 250,
  browseMs: 300,
  /** Shorter under the finger: a card that lags behind a drag reads as a slow screen. */
  dragMs: 200,
  /** The picked card growing back into the review card. */
  foldMs: 460,
  /** Everything else folding into it, a touch quicker so the picked card lands last. */
  foldRestMs: 400,
  /** Reduced motion: the whole fan crossfades instead. */
  fadeMs: 150,
} as const;

/** Under this width the pile label hugs the left edge and the margins tighten: a phone. */
const COMPACT_WIDTH_PX = 640;
const CARD_MIN_PX = 96;
const CARD_MAX_PX = 176;
/** The pivot sits this many card widths below a card's centre. */
const RADIUS_PER_CARD = 4.66;
/**
 * Neighbours never closer than this many card widths. Below it the band under each card, the only
 * place its "Ders · Konu" is written, is covered by the next card before it can be read.
 */
const MIN_SPACING_PER_CARD = 0.42;
const MAX_STEP_DEG = 7.5;
/** Past 30° the outer cards lie so flat that the hand reads as a wheel, not something held. */
const MAX_HALF_SPAN_DEG = 30;
const MAX_WINDOW = 5;
const MIN_WINDOW = 2;
/** Cards squeezed past each end of the window, and how far apart. The rest fade out. */
const SQUEEZED = 4;
const SQUEEZE_STEP_DEG = 1.1;
const LIFT_SCALE = 1.06;
const PILE_SCALE = 0.5;
/** How many answered cards the pile shows on top; the rest are under them. */
const PILE_SHOWN = 3;
/** Per-card nudge on the pile, so it reads as cards dropped there and not a single tile. */
const PILE_JITTER = [
  { x: 0, y: 0, rotate: -4 },
  { x: 7, y: -5, rotate: 3 },
  { x: -6, y: 4, rotate: -1.5 },
  { x: 4, y: 6, rotate: 5 },
  { x: -3, y: -6, rotate: 2 },
] as const;
/** Kept clear at the screen's sides by every card dealt in full. */
const EDGE_PX = 8;
const NAV_HEIGHT_PX = 44;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * The widest angle whose card, tilted to it, still ends `budget` px from the middle.
 *
 * A card at angle A reaches `(radius + h/2)·sin A + (w/2)·cos A` sideways: its centre's swing plus
 * its own tilted half-width. That is `K·sin(A + φ)`, so the largest A that fits has a closed form.
 */
function widestAngle(budget: number, radius: number, width: number, height: number): number {
  const reach = radius + height / 2;
  const span = Math.hypot(reach, width / 2);
  if (budget <= width / 2) return 0;
  if (budget >= span) return 90;
  return toDegrees(Math.asin(budget / span) - Math.atan2(width / 2, reach));
}

/** How far below its own centre a card tilted to `degrees` reaches, swing and corners included. */
function reachBelow(degrees: number, radius: number, width: number, height: number): number {
  const angle = toRadians(degrees);
  return (
    radius * (1 - Math.cos(angle)) +
    (width / 2) * Math.sin(angle) +
    (height / 2) * Math.cos(angle)
  );
}

/**
 * Lays the fan out for a screen. Everything is sized from the card, and the card from the screen:
 * a third of the width on a phone, capped by the height so a short window still fits the lift.
 */
export function fanGeometry(width: number, height: number): FanGeometry {
  const compact = width < COMPACT_WIDTH_PX;
  const cardWidth = Math.round(
    clamp(Math.min(width * 0.33, height * 0.22), CARD_MIN_PX, CARD_MAX_PX),
  );
  const cardHeight = Math.round(cardWidth * 1.25);
  const radius = cardWidth * RADIUS_PER_CARD;
  const lift = Math.round(cardWidth * 0.24);
  const hoverLift = Math.round(cardWidth * 0.1);

  // Measured on the card as it looks when browsed (lifted and grown), the widest it ever gets.
  const halfSpan = Math.min(
    MAX_HALF_SPAN_DEG,
    widestAngle(
      width / 2 - EDGE_PX,
      radius + lift,
      cardWidth * LIFT_SCALE,
      cardHeight * LIFT_SCALE,
    ),
  );
  const minStep = toDegrees(Math.asin(MIN_SPACING_PER_CARD / RADIUS_PER_CARD));
  const window = clamp(Math.floor(halfSpan / minStep), MIN_WINDOW, MAX_WINDOW);

  // The pile sits under the dialog's own controls row (16 + 44 px), top left, where nothing else is.
  const pileWidth = cardWidth * PILE_SCALE;
  const pileHeight = cardHeight * PILE_SCALE;
  const pileY = (compact ? 72 : 96) + pileHeight / 2;
  const labelWidth = compact ? Math.min(200, width - 32) : 176;
  const pileX = compact ? 28 + pileWidth / 2 : 40 + labelWidth / 2;
  const labelTop = pileY + pileHeight / 2 + 12;

  const navY = height - (compact ? 24 : 28) - NAV_HEIGHT_PX;

  // Vertically the hand takes the band between the pile's label and the arrows, sitting low in it
  // the way a hand of cards is held low. A screen too short for that ignores the pile (it is off to
  // the side anyway), and the outer cards, which drop as they tilt, must still clear the bottom.
  const above = (cardHeight / 2) * LIFT_SCALE + lift + hoverLift;
  const below = cardHeight / 2;
  let top = labelTop + 18 + (compact ? 20 : 24);
  const bottom = navY - 12;
  if (bottom - top < above + below) top = 72;
  const free = Math.max(0, bottom - top - above - below);
  const lowest = reachBelow(
    halfSpan + SQUEEZED * SQUEEZE_STEP_DEG,
    radius,
    cardWidth,
    cardHeight,
  );
  const handY = Math.min(top + above + free * 0.6, height - EDGE_PX - lowest);

  return {
    cardWidth,
    cardHeight,
    handX: width / 2,
    handY,
    radius,
    maxStep: MAX_STEP_DEG,
    halfSpan,
    window,
    lift,
    hoverLift,
    pileX,
    pileY,
    pileWidth,
    pileHeight,
    pileLabel: {
      left: compact ? 16 : pileX - labelWidth / 2,
      top: labelTop,
      width: labelWidth,
      align: compact ? "left" : "center",
    },
    navY,
    dragStep: Math.round(cardWidth * 0.45),
  };
}

/** True when the hand holds more cards than its window deals in full. */
export function handOverflows(geometry: FanGeometry, handSize: number): boolean {
  return handSize > 2 * geometry.window + 1;
}

/** The window's middle, kept far enough from both ends that the window is always full. */
export function clampAnchor(anchor: number, handSize: number, window: number): number {
  return Math.max(window, Math.min(handSize - 1 - window, anchor));
}

/**
 * Where the window's middle goes when the student browses to `position`.
 *
 * A hand that fits stays put, centred, like cards held in a hand. Only a hand wider than the window
 * slides, and only once the browsed card walks past the window's last-but-one slot. A fan that
 * re-centred on every card left half the screen empty, because answered cards leave the hand and
 * the card the student is on is nearly always its first.
 */
export function followAnchor(
  anchor: number,
  position: number,
  handSize: number,
  window: number,
): number {
  const margin = window - 1;
  let next = clampAnchor(anchor, handSize, window);
  if (position > next + margin) next = position - margin;
  if (position < next - margin) next = position + margin;
  return clampAnchor(next, handSize, window);
}

/**
 * One unanswered card's slot in the open hand.
 *
 * Cards past the window are squeezed under its outermost card a degree apart, then fade: the
 * student sees that the hand goes on without the screen having to fit it. Stacking runs left to
 * right the way a hand is held, except the cards squeezed past the right end, which tuck under it
 * instead of burying its last full card.
 */
export function handPlacement(
  geometry: FanGeometry,
  hand: { size: number; position: number; browsed: number; anchor: number },
): FanPlacement {
  const { window } = geometry;
  const visible = Math.min(hand.size, 2 * window + 1);
  const step =
    visible > 1 ? Math.min(geometry.maxStep, (2 * geometry.halfSpan) / (visible - 1)) : 0;
  const centre = handOverflows(geometry, hand.size)
    ? clampAnchor(hand.anchor, hand.size, window)
    : (hand.size - 1) / 2;
  const offset = hand.position - centre;
  const distance = Math.abs(offset);
  const degrees =
    distance <= window
      ? distance * step
      : window * step + Math.min(distance - window, SQUEEZED) * SQUEEZE_STEP_DEG;
  const rotate = offset < 0 ? -degrees : degrees;
  const lifted = hand.position === hand.browsed;
  // Lifted along the card's own radius, out of the hand, not straight up the screen.
  const reach = geometry.radius + (lifted ? geometry.lift : 0);
  return {
    x: reach * Math.sin(toRadians(rotate)),
    y: geometry.radius - reach * Math.cos(toRadians(rotate)),
    rotate,
    scale: lifted ? LIFT_SCALE : 1,
    opacity: distance > window + SQUEEZED ? 0 : 1,
    z: lifted ? 900 : offset > window ? 90 - Math.round(distance - window) : 100 + hand.position,
  };
}

/** An answered card on the pile; `rank` is its place in answer order. */
export function pilePlacement(
  geometry: FanGeometry,
  rank: number,
  count: number,
): FanPlacement {
  const jitter = PILE_JITTER[rank % PILE_JITTER.length]!;
  return {
    x: geometry.pileX - geometry.handX + jitter.x,
    y: geometry.pileY - geometry.handY + jitter.y,
    rotate: jitter.rotate,
    scale: PILE_SCALE,
    opacity: rank >= count - PILE_SHOWN ? 1 : 0,
    z: 10 + rank,
  };
}

/** The review card's box in the fan's own coordinates: centre and width. */
export interface ReviewCardBox {
  x: number;
  y: number;
  width: number;
}

/**
 * Where a hand card sits while the review card is up, by `rank` behind the card on top: 0 is the
 * review card itself, 1 and 2 are the tilted cards the panel draws behind it, and the rest wait
 * inside it unseen. The hand is dealt from here and folds back to here, so these have to match
 * what the panel draws to the pixel or the hand-over shows a jump.
 */
export function foldPlacement(
  geometry: FanGeometry,
  box: ReviewCardBox,
  rank: number,
): FanPlacement {
  const scale = box.width / geometry.cardWidth;
  const x = box.x - geometry.handX;
  const y = box.y - geometry.handY;
  if (rank === 0) return { x, y, rotate: 0, scale, opacity: 1, z: 1000 };
  const layer = REVIEW_STACK_LAYERS.find((item) => item.after === Math.min(rank, 2))!;
  return {
    x,
    y: y + layer.y,
    rotate: layer.rotate,
    scale: scale * layer.scale,
    opacity: rank <= 2 ? layer.opacity : 0,
    z: 1000 - Math.min(rank, 3),
  };
}

/** How long a card waits before leaving the review card: nearest first, capped. */
export function dealDelay(position: number, origin: number): number {
  return (
    Math.min(Math.abs(position - origin), FAN_TIMING.dealStaggerCap) *
    FAN_TIMING.dealStaggerMs
  );
}

/** The last card's landing time for a deal from `origin` — when the hand stops being dealt. */
export function dealDuration(handSize: number, origin: number): number {
  const furthest = Math.max(origin, handSize - 1 - origin, 0);
  return dealDelay(furthest, 0) + FAN_TIMING.dealMs;
}

export function placementTransform(placement: FanPlacement): string {
  return `translate(${placement.x.toFixed(1)}px, ${placement.y.toFixed(1)}px) rotate(${placement.rotate.toFixed(2)}deg) scale(${placement.scale.toFixed(4)})`;
}
