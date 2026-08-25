import { describe, expect, it } from "vitest";
import { seatPositions, type SeatPosition } from "./room-seat-layout";

interface Table {
  radiusXPct: number;
  radiusYPct: number;
}

const TALL: Table = { radiusXPct: 12, radiusYPct: 38 };
const WIDE: Table = { radiusXPct: 40, radiusYPct: 10 };
const DEFAULT_TABLE: Table = { radiusXPct: 34, radiusYPct: 30 };

const spreadRatio = (values: number[]) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return (Math.max(...values) - Math.min(...values)) / mean;
};

/** Recover the ellipse parameter a point was produced from (inverse of the layout's `pointAt`). */
const parameterOf = (p: SeatPosition, { radiusXPct, radiusYPct }: Table) => {
  const t =
    Math.atan2((p.topPct - 50) / radiusYPct, (p.leftPct - 50) / radiusXPct) + Math.PI / 2;
  return ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
};

/**
 * Perimeter length between two parameters, integrated independently of the implementation
 * (fine Riemann sum over |dP/dt|) so this measures the claim rather than restating the code.
 */
const arcBetween = (from: number, to: number, { radiusXPct, radiusYPct }: Table) => {
  const span = to >= from ? to - from : to + 2 * Math.PI - from;
  const steps = 4000;
  let total = 0;
  for (let i = 0; i < steps; i++) {
    const t = from + (span * (i + 0.5)) / steps;
    total +=
      Math.hypot(radiusXPct * Math.sin(t - Math.PI / 2), radiusYPct * Math.cos(t - Math.PI / 2)) *
      (span / steps);
  }
  return total;
};

/** Edge-length gaps between neighbouring seats, walking the table and closing the loop. */
const arcGaps = (points: SeatPosition[], table: Table) => {
  const params = points.map((p) => parameterOf(p, table));
  return params.map((t, i) => arcBetween(t, params[(i + 1) % params.length]!, table));
};

/** What stepping the ellipse parameter uniformly would produce — the thing this improves on. */
const naiveAnglePositions = (count: number, { radiusXPct, radiusYPct }: Table): SeatPosition[] =>
  Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      leftPct: 50 + radiusXPct * Math.cos(angle),
      topPct: 50 + radiusYPct * Math.sin(angle),
    };
  });

describe("seatPositions", () => {
  it("returns nothing for a table with no seats", () => {
    expect(seatPositions(0)).toEqual([]);
    expect(seatPositions(-3)).toEqual([]);
    expect(seatPositions(Number.NaN)).toEqual([]);
  });

  it("produces one position per seat, all inside the container", () => {
    for (let count = 2; count <= 10; count++) {
      const seats = seatPositions(count);
      expect(seats).toHaveLength(count);
      for (const seat of seats) {
        expect(seat.leftPct).toBeGreaterThanOrEqual(0);
        expect(seat.leftPct).toBeLessThanOrEqual(100);
        expect(seat.topPct).toBeGreaterThanOrEqual(0);
        expect(seat.topPct).toBeLessThanOrEqual(100);
      }
    }
  });

  it("puts the first seat at the top of the table", () => {
    const [first] = seatPositions(6, { radiusXPct: 30, radiusYPct: 20 });
    expect(first!.leftPct).toBeCloseTo(50, 5);
    expect(first!.topPct).toBeCloseTo(30, 5);
  });

  it("honours a start angle, moving clockwise", () => {
    const [first] = seatPositions(4, { radiusXPct: 30, radiusYPct: 30, startAngleDeg: 90 });
    // A quarter turn clockwise from the top is the right-hand side of a circular table.
    expect(first!.leftPct).toBeCloseTo(80, 4);
    expect(first!.topPct).toBeCloseTo(50, 4);
  });

  it("puts equal lengths of table edge between neighbouring seats", () => {
    for (const table of [TALL, WIDE, DEFAULT_TABLE]) {
      for (const count of [2, 5, 7, 8, 10]) {
        // Measured by independent integration, not by the layout's own sampling.
        expect(spreadRatio(arcGaps(seatPositions(count, table), table))).toBeLessThan(0.01);
      }
    }
  });

  it("beats naive angle-stepping, which clumps seats on an elongated table", () => {
    for (const table of [TALL, WIDE]) {
      for (const count of [6, 8, 10]) {
        const naive = spreadRatio(arcGaps(naiveAnglePositions(count, table), table));
        // Uniform angle stepping leaves wildly uneven edge gaps on an eccentric table…
        expect(naive).toBeGreaterThan(0.5);
        // …and this layout is at least an order of magnitude tighter.
        expect(spreadRatio(arcGaps(seatPositions(count, table), table))).toBeLessThan(
          naive / 10,
        );
      }
    }
  });

  it("keeps a circular table symmetric", () => {
    const [top, right, bottom, left] = seatPositions(4, { radiusXPct: 25, radiusYPct: 25 });
    expect(top!.leftPct).toBeCloseTo(bottom!.leftPct, 4);
    expect(right!.topPct).toBeCloseTo(left!.topPct, 4);
    expect(50 - left!.leftPct).toBeCloseTo(right!.leftPct - 50, 4);
    expect(50 - top!.topPct).toBeCloseTo(bottom!.topPct - 50, 4);
  });

  it("collapses onto the centre for a table with no size", () => {
    expect(seatPositions(3, { radiusXPct: 0, radiusYPct: 0 })).toEqual([
      { leftPct: 50, topPct: 50 },
      { leftPct: 50, topPct: 50 },
      { leftPct: 50, topPct: 50 },
    ]);
  });

  it("is deterministic", () => {
    expect(seatPositions(5)).toEqual(seatPositions(5));
  });
});
