import { describe, expect, it } from "vitest";
import {
  FAN_TIMING,
  REVIEW_STACK_LAYERS,
  clampAnchor,
  dealDelay,
  dealDuration,
  fanGeometry,
  foldPlacement,
  followAnchor,
  handOverflows,
  handPlacement,
  pilePlacement,
  type FanGeometry,
  type FanPlacement,
} from "./notebook-review-fan";

/** Phones, tablets both ways round, laptops, a big monitor and a phone on its side. */
const SCREENS: [number, number][] = [
  [360, 640],
  [375, 812],
  [390, 844],
  [414, 896],
  [600, 900],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [844, 390],
];

/** How far a placed card reaches sideways from the screen's middle, tilt and size included. */
function sideways(geometry: FanGeometry, placement: FanPlacement): number {
  const angle = (Math.abs(placement.rotate) * Math.PI) / 180;
  const halfWidth = (geometry.cardWidth / 2) * placement.scale;
  const halfHeight = (geometry.cardHeight / 2) * placement.scale;
  return (
    Math.abs(placement.x) +
    halfWidth * Math.cos(angle) +
    halfHeight * Math.sin(angle)
  );
}

function hand(geometry: FanGeometry, size: number, browsed: number, anchor = browsed) {
  return Array.from({ length: size }, (_, position) =>
    handPlacement(geometry, {
      size,
      position,
      browsed,
      anchor: clampAnchor(anchor, size, geometry.window),
    }),
  );
}

describe("fanGeometry", () => {
  it("deals five a side on a laptop and two a side on a phone", () => {
    const laptop = fanGeometry(1200, 800);
    expect(laptop.cardWidth).toBe(176);
    expect(laptop.window).toBe(5);
    expect(laptop.halfSpan).toBe(30);

    const phone = fanGeometry(390, 844);
    expect(phone.cardWidth).toBeLessThan(140);
    expect(phone.window).toBe(2);
    expect(phone.halfSpan).toBeLessThan(laptop.halfSpan);
  });

  it("keeps every card dealt in full on screen, the browsed one included", () => {
    for (const [width, height] of SCREENS) {
      const geometry = fanGeometry(width, height);
      for (const size of [1, 2, 3, 7, 11, 24]) {
        for (let browsed = 0; browsed < size; browsed += 1) {
          hand(geometry, size, browsed).forEach((placement, position) => {
            const centre = handOverflows(geometry, size)
              ? clampAnchor(browsed, size, geometry.window)
              : (size - 1) / 2;
            if (Math.abs(position - centre) > geometry.window) return;
            expect(sideways(geometry, placement), `${width}x${height}, ${size} cards`)
              .toBeLessThanOrEqual(width / 2);
          });
        }
      }
    }
  });

  it("holds the hand above the arrows and the lifted card below the dialog's controls", () => {
    for (const [width, height] of SCREENS) {
      const geometry = fanGeometry(width, height);
      const middle = geometry.handY + geometry.cardHeight / 2;
      const lifted =
        geometry.handY - geometry.lift - (geometry.cardHeight / 2) * 1.06 - geometry.hoverLift;
      expect(middle, `${width}x${height}`).toBeLessThanOrEqual(geometry.navY);
      // The close / list / edit row ends at 60px.
      expect(lifted, `${width}x${height}`).toBeGreaterThanOrEqual(60);
    }
  });

  it("puts the pile in the top left corner, clear of the controls on the right", () => {
    for (const [width, height] of SCREENS) {
      const geometry = fanGeometry(width, height);
      expect(geometry.pileX + geometry.pileWidth / 2).toBeLessThan(width / 2);
      expect(geometry.pileY - geometry.pileHeight / 2).toBeGreaterThanOrEqual(60);
    }
  });
});

describe("handPlacement", () => {
  const geometry = fanGeometry(1280, 800);

  it("spreads a small hand symmetrically around the middle", () => {
    const cards = hand(geometry, 5, 0, 0);
    expect(cards[2]!.x).toBeCloseTo(0);
    expect(cards[1]!.x).toBeCloseTo(-cards[3]!.x);
    expect(cards[1]!.rotate).toBeCloseTo(-cards[3]!.rotate);
  });

  it("lifts the browsed card out of the hand and on top of it", () => {
    const cards = hand(geometry, 5, 3);
    const lifted = cards[3]!;
    expect(lifted.scale).toBeGreaterThan(1);
    expect(lifted.y).toBeLessThan(cards[1]!.y);
    expect(lifted.z).toBeGreaterThan(Math.max(...cards.filter((card) => card !== lifted).map((card) => card.z)));
  });

  it("stacks left to right, the way a hand is held", () => {
    const cards = hand(geometry, 7, -1);
    for (let position = 1; position < cards.length; position += 1) {
      expect(cards[position]!.x).toBeGreaterThan(cards[position - 1]!.x);
      expect(cards[position]!.z).toBeGreaterThan(cards[position - 1]!.z);
    }
  });

  it("squeezes a big hand past the window and fades what is left", () => {
    const size = 24;
    const cards = hand(geometry, size, 0);
    const window = geometry.window;
    // Anchored at the left end: the window is the first 2·window + 1 cards.
    const squeezed = cards[2 * window + 1]!;
    const full = cards[2 * window]!;
    expect(squeezed.rotate - full.rotate).toBeLessThan(full.rotate - cards[2 * window - 1]!.rotate);
    expect(squeezed.z).toBeLessThan(full.z);
    expect(cards[size - 1]!.opacity).toBe(0);
    expect(squeezed.opacity).toBe(1);
  });
});

describe("followAnchor", () => {
  it("never lets the browsed card fall out of the window", () => {
    const window = 5;
    const size = 24;
    let anchor = clampAnchor(0, size, window);
    const walk = [...Array.from({ length: size }, (_, n) => n), ...Array.from({ length: size }, (_, n) => size - 1 - n)];
    for (const position of walk) {
      anchor = followAnchor(anchor, position, size, window);
      expect(Math.abs(position - anchor)).toBeLessThanOrEqual(window);
    }
  });

  it("leaves the window where it is while the browsed card moves inside it", () => {
    expect(followAnchor(8, 9, 24, 5)).toBe(8);
    expect(followAnchor(8, 5, 24, 5)).toBe(8);
  });
});

describe("foldPlacement", () => {
  const geometry = fanGeometry(1280, 800);
  const box = { x: 640, y: 330, width: 416 };

  it("puts the card on top exactly over the review card", () => {
    const top = foldPlacement(geometry, box, 0);
    expect(geometry.handX + top.x).toBeCloseTo(box.x);
    expect(geometry.handY + top.y).toBeCloseTo(box.y);
    expect(geometry.cardWidth * top.scale).toBeCloseTo(box.width);
    expect(top.rotate).toBe(0);
  });

  it("puts the next two where the panel draws its stack", () => {
    for (const rank of [1, 2]) {
      const layer = REVIEW_STACK_LAYERS.find((item) => item.after === rank)!;
      const placement = foldPlacement(geometry, box, rank);
      expect(geometry.handY + placement.y).toBeCloseTo(box.y + layer.y);
      expect(placement.rotate).toBe(layer.rotate);
      expect(geometry.cardWidth * placement.scale).toBeCloseTo(box.width * layer.scale);
      expect(placement.opacity).toBe(layer.opacity);
    }
    expect(foldPlacement(geometry, box, 3).opacity).toBe(0);
  });
});

describe("pilePlacement", () => {
  const geometry = fanGeometry(1280, 800);

  it("shows the last three answered cards on top of the pile", () => {
    const pile = Array.from({ length: 5 }, (_, rank) => pilePlacement(geometry, rank, 5));
    expect(pile.map((card) => card.opacity)).toEqual([0, 0, 1, 1, 1]);
    expect(pile[4]!.z).toBeGreaterThan(pile[0]!.z);
    expect(geometry.handX + pile[0]!.x).toBeCloseTo(geometry.pileX);
  });
});

describe("deal timing", () => {
  it("deals nearest first", () => {
    expect(dealDelay(3, 3)).toBe(0);
    expect(dealDelay(4, 3)).toBeLessThan(dealDelay(6, 3));
  });

  it("lands the last card of any hand within the Moment budget", () => {
    expect(dealDuration(50, 0)).toBeLessThanOrEqual(600);
    expect(dealDuration(1, 0)).toBe(FAN_TIMING.dealMs);
  });
});
