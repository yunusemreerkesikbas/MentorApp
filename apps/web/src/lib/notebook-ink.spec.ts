import { describe, expect, it } from "vitest";
import type { NotebookInkStroke } from "@mentor/types";
import { NOTEBOOK_INK_TOOLS } from "@mentor/types";
import {
  INK_PALETTE,
  INK_SIZE_MAX,
  INK_SIZE_MIN,
  INK_TOOLS,
  finalizeStroke,
  hitStroke,
  simplifyPoints,
  strokeBounds,
  strokeToPath,
} from "./notebook-ink";

/** A straight horizontal stroke, three samples, full pressure. */
function stroke(patch: Partial<NotebookInkStroke> = {}): NotebookInkStroke {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tool: "pen",
    color: "#111111",
    size: 8,
    opacity: 1,
    points: [0, 0, 0.5, 50, 0, 0.5, 100, 0, 0.5],
    ...patch,
  };
}

describe("INK_TOOLS", () => {
  it("covers every tool in the shared enum", () => {
    // A missing preset would render that tool's strokes as `undefined` options at runtime, and the
    // enum is append-only, so this is the check that a new pen was wired up rather than just named.
    for (const tool of NOTEBOOK_INK_TOOLS) {
      expect(INK_TOOLS[tool]).toBeDefined();
    }
    expect(Object.keys(INK_TOOLS)).toHaveLength(NOTEBOOK_INK_TOOLS.length);
  });

  it("keeps every default size inside the slider range", () => {
    for (const tool of NOTEBOOK_INK_TOOLS) {
      expect(INK_TOOLS[tool].size).toBeGreaterThanOrEqual(INK_SIZE_MIN);
      expect(INK_TOOLS[tool].size).toBeLessThanOrEqual(INK_SIZE_MAX);
    }
  });

  it("gives the highlighter a multiply blend so overlapping text stays readable", () => {
    expect(INK_TOOLS.highlighter.blend).toBe("multiply");
    expect(INK_TOOLS.highlighter.opacity).toBeLessThan(1);
  });

  it("holds the fineliner to a constant width", () => {
    expect(INK_TOOLS.fineliner.thinning).toBe(0);
  });

  it("gives only the fountain pen a nib angle", () => {
    expect(INK_TOOLS.fountain.nibAngle).toBeTypeOf("number");
    const others = NOTEBOOK_INK_TOOLS.filter((tool) => tool !== "fountain");
    for (const tool of others) {
      expect(INK_TOOLS[tool].nibAngle).toBeUndefined();
    }
  });
});

describe("INK_PALETTE", () => {
  it("is all six-digit hex, which is what the schema accepts", () => {
    for (const color of INK_PALETTE) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("has no duplicates — two identical swatches is a dead tap target", () => {
    expect(new Set(INK_PALETTE).size).toBe(INK_PALETTE.length);
  });
});

describe("simplifyPoints", () => {
  it("drops samples that sit on the line between their neighbours", () => {
    // Five collinear samples; only the endpoints carry information.
    const points = [0, 0, 0.5, 25, 0, 0.5, 50, 0, 0.5, 75, 0, 0.5, 100, 0, 0.5];
    expect(simplifyPoints(points, 1)).toEqual([0, 0, 0.5, 100, 0, 0.5]);
  });

  it("keeps a corner that a straight line would cut", () => {
    const points = [0, 0, 0.5, 50, 50, 0.5, 100, 0, 0.5];
    expect(simplifyPoints(points, 1)).toEqual(points);
  });

  it("never returns fewer than the two samples the schema requires", () => {
    expect(simplifyPoints([0, 0, 0.5, 100, 0, 0.5], 1000)).toHaveLength(6);
  });

  it("carries each kept sample's own pressure, not a recomputed one", () => {
    const points = [0, 0, 0.1, 50, 50, 0.9, 100, 0, 0.3];
    expect(simplifyPoints(points, 1)).toEqual(points);
  });
});

describe("finalizeStroke", () => {
  it("rounds coordinates to one decimal and pressure to two", () => {
    expect(finalizeStroke([1.234_56, 2.345_67, 0.123_45, 90.987, 3.21, 0.876])).toEqual([
      1.2, 2.3, 0.12, 91, 3.2, 0.88,
    ]);
  });

  it("turns a single tap into two samples so it renders as a dot", () => {
    // One sample is not a stroke to the outline algorithm, and the schema rejects it outright.
    const finalized = finalizeStroke([10, 20, 0.5]);
    expect(finalized).toEqual([10, 20, 0.5, 10, 20, 0.5]);
  });

  it("returns null for nothing at all", () => {
    expect(finalizeStroke([])).toBeNull();
  });

  it("simplifies before rounding, so a drawn line stores far fewer samples", () => {
    const dense = Array.from({ length: 200 }, (_, i) => [i, 0, 0.5]).flat();
    const finalized = finalizeStroke(dense);
    expect(finalized).not.toBeNull();
    expect(finalized!.length).toBeLessThan(dense.length / 10);
  });
});

describe("strokeToPath", () => {
  it("produces a closed, finite path for every tool", () => {
    for (const tool of NOTEBOOK_INK_TOOLS) {
      const d = strokeToPath(stroke({ tool }));
      expect(d.startsWith("M")).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
      expect(d).not.toMatch(/NaN|Infinity/);
    }
  });

  it("gives the fountain pen a different outline from the pen at the same size", () => {
    // The nib is the whole reason that tool exists; if the two agree, it fell back to the
    // pressure algorithm and nobody would notice from the toolbar.
    expect(strokeToPath(stroke({ tool: "fountain" }))).not.toBe(
      strokeToPath(stroke({ tool: "pen" })),
    );
  });

  it("returns an empty path rather than throwing on a stroke with no samples", () => {
    expect(strokeToPath(stroke({ points: [] }))).toBe("");
  });
});

describe("strokeBounds", () => {
  it("covers the samples plus the nib's own half-width", () => {
    const bounds = strokeBounds(stroke({ size: 10 }));
    expect(bounds.minX).toBeLessThanOrEqual(-5);
    expect(bounds.maxX).toBeGreaterThanOrEqual(105);
    expect(bounds.minY).toBeLessThanOrEqual(-5);
    expect(bounds.maxY).toBeGreaterThanOrEqual(5);
  });

  it("grows with the nib, which is what makes it a safe eraser pre-filter", () => {
    const thin = strokeBounds(stroke({ size: 4 }));
    const thick = strokeBounds(stroke({ size: 40 }));
    expect(thick.maxX - thick.minX).toBeGreaterThan(thin.maxX - thin.minX);
    expect(thick.maxY - thick.minY).toBeGreaterThan(thin.maxY - thin.minY);
  });
});

describe("hitStroke", () => {
  it("hits a point sitting on the line", () => {
    expect(hitStroke(stroke(), 50, 0, 4)).toBe(true);
  });

  it("hits between two samples, not just at them", () => {
    // The eraser walks segments; testing only at samples would pass on a broken implementation
    // that compares against sample points alone.
    expect(hitStroke(stroke({ points: [0, 0, 0.5, 100, 0, 0.5] }), 73, 0, 2)).toBe(true);
  });

  it("misses a point beyond the eraser radius and the nib", () => {
    expect(hitStroke(stroke({ size: 8 }), 50, 200, 4)).toBe(false);
  });

  it("counts the stroke's own width, so a fat highlighter is easier to catch", () => {
    const at = 20;
    expect(hitStroke(stroke({ size: 4 }), 50, at, 2)).toBe(false);
    expect(hitStroke(stroke({ size: 60 }), 50, at, 2)).toBe(true);
  });

  it("misses past the ends rather than treating the stroke as an infinite line", () => {
    expect(hitStroke(stroke(), 400, 0, 4)).toBe(false);
  });
});
