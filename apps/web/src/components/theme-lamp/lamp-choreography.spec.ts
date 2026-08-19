import { describe, expect, it } from "vitest";

import {
  BLINK_MAX_MS,
  BLINK_MIN_MS,
  DOUBLE_BLINK_CHANCE,
  LAMP_LAYOUT,
  LEAN_AT_CORD,
  LEAN_MAX_X,
  LEAN_MAX_Y,
  OWL_ART,
  OWL_SPRITES,
  SHADE_ART,
  computeLean,
  isDoubleBlink,
  isLit,
  nextBlinkDelay,
  owlArtBox,
  owlPose,
  pullReaction,
  reactionScale,
  resolveLean,
  shadeArtBox,
} from "./lamp-choreography";

describe("isLit", () => {
  it("treats dark as the lit state", () => {
    expect(isLit("dark")).toBe(true);
    expect(isLit("light")).toBe(false);
  });
});

describe("pullReaction", () => {
  it("squints into the light and widens into the dark", () => {
    expect(pullReaction("dark")).toBe("squint");
    expect(pullReaction("light")).toBe("widen");
  });

  it("shrinks him away from a new glare and pops him toward a new calm", () => {
    expect(reactionScale("squint")).toBeLessThan(1);
    expect(reactionScale("widen")).toBeGreaterThan(1);
    expect(reactionScale(null)).toBe(1);
  });
});

describe("nextBlinkDelay", () => {
  it("stays inside the idle cadence for the whole random range", () => {
    expect(nextBlinkDelay(0)).toBe(BLINK_MIN_MS);
    expect(nextBlinkDelay(1)).toBe(BLINK_MAX_MS);
    expect(nextBlinkDelay(0.5)).toBe((BLINK_MIN_MS + BLINK_MAX_MS) / 2);
  });

  it("clamps values outside the unit interval", () => {
    expect(nextBlinkDelay(-3)).toBe(BLINK_MIN_MS);
    expect(nextBlinkDelay(9)).toBe(BLINK_MAX_MS);
  });
});

describe("isDoubleBlink", () => {
  it("fires below the configured chance only", () => {
    expect(isDoubleBlink(0)).toBe(true);
    expect(isDoubleBlink(DOUBLE_BLINK_CHANCE - 0.01)).toBe(true);
    expect(isDoubleBlink(DOUBLE_BLINK_CHANCE)).toBe(false);
    expect(isDoubleBlink(0.99)).toBe(false);
  });
});

describe("computeLean", () => {
  const centre = { x: 100, y: 100 };

  it("stands upright when the pointer sits on the scene centre", () => {
    expect(computeLean(centre, centre)).toEqual({ x: 0, y: 0 });
  });

  it("never exceeds the lean limits, however far the pointer is", () => {
    const far = computeLean({ x: 10_000, y: 10_000 }, centre);
    expect(far.x).toBe(LEAN_MAX_X);
    expect(far.y).toBe(LEAN_MAX_Y);

    const farNegative = computeLean({ x: -10_000, y: -10_000 }, centre);
    expect(farNegative.x).toBe(-LEAN_MAX_X);
    expect(farNegative.y).toBe(-LEAN_MAX_Y);
  });

  it("leans toward the pointer direction", () => {
    const left = computeLean({ x: 60, y: 100 }, centre);
    expect(left.x).toBeLessThan(0);
    expect(left.y).toBe(0);
  });

  it("stays subtle enough to read as a turn, not a slide", () => {
    expect(LEAN_MAX_X).toBeLessThanOrEqual(3);
    expect(LEAN_MAX_Y).toBeLessThanOrEqual(3);
  });
});

describe("resolveLean", () => {
  const pointerLean = { x: -1, y: 0.5 };

  it("rests upright while idle", () => {
    expect(resolveLean("idle", pointerLean)).toEqual({ x: 0, y: 0 });
  });

  it("follows the pointer only while nearby", () => {
    expect(resolveLean("near", pointerLean)).toEqual(pointerLean);
  });

  it("locks onto the cord once the wing is reaching", () => {
    expect(resolveLean("hover", pointerLean)).toEqual(LEAN_AT_CORD);
    expect(resolveLean("pulling", pointerLean)).toEqual(LEAN_AT_CORD);
  });

  it("leans up and to his right, where the cord actually hangs", () => {
    expect(LEAN_AT_CORD.x).toBeGreaterThan(0);
    expect(LEAN_AT_CORD.y).toBeLessThan(0);
  });
});

describe("owlPose", () => {
  it("reaches on hover and stays reaching through the pull", () => {
    expect(owlPose("hover", false)).toBe("reach");
    expect(owlPose("pulling", false)).toBe("reach");
  });

  it("lets the reach outrank a blink, so the wing is never swallowed", () => {
    expect(owlPose("hover", true)).toBe("reach");
    expect(owlPose("pulling", true)).toBe("reach");
  });

  it("blinks only while the wing is down", () => {
    expect(owlPose("idle", true)).toBe("blink");
    expect(owlPose("near", true)).toBe("blink");
    expect(owlPose("idle", false)).toBe("rest");
    expect(owlPose("near", false)).toBe("rest");
  });
});

describe("OWL_SPRITES", () => {
  it("points every pose at its own sprite under the lamp folder", () => {
    const paths = Object.values(OWL_SPRITES);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path.startsWith("/mascot/puhu/lamp/")).toBe(true);
    }
  });
});

describe("owlArtBox", () => {
  const owl = LAMP_LAYOUT.panel.owl!;
  const sceneHeight = LAMP_LAYOUT.panel.height;

  it("stands the painted body on the floor of the scene", () => {
    const box = owlArtBox(owl, sceneHeight);
    const bodyTop = box.top + OWL_ART.painted.top * box.height;
    const bodyBottom = bodyTop + OWL_ART.painted.height * box.height;

    expect(bodyBottom).toBeCloseTo(sceneHeight);
    expect(bodyTop).toBeGreaterThan(0);
  });

  it("puts the painted body at the requested width and left edge", () => {
    const box = owlArtBox(owl, sceneHeight);
    expect(box.left + OWL_ART.painted.left * box.width).toBeCloseTo(owl.left);
    expect(OWL_ART.painted.width * box.width).toBeCloseTo(owl.width);
  });

  it("hangs the shade clear above his head, which is what licenses the overhang", () => {
    const box = owlArtBox(owl, sceneHeight);
    const headTop = box.top + OWL_ART.painted.top * box.height;
    const panel = LAMP_LAYOUT.panel;

    expect(shadeArtBox(panel).mouthY).toBeLessThan(headTop);
  });

  it("hangs the knob within reach, just past the body's edge", () => {
    const box = owlArtBox(owl, sceneHeight);
    const bodyRight = box.left + (OWL_ART.painted.left + OWL_ART.painted.width) * box.width;
    const panel = LAMP_LAYOUT.panel;

    expect(panel.pullCordX).toBeGreaterThan(bodyRight);
    expect(panel.pullCordX - bodyRight).toBeLessThan(8);
  });

  it("keeps the scene wide enough for the whole shade", () => {
    const panel = LAMP_LAYOUT.panel;
    expect(panel.shadeCentreX + panel.shadeWidth / 2).toBeLessThanOrEqual(panel.width);
  });
});

describe("LAMP_LAYOUT", () => {
  it("keeps the rail scene inside the 52px collapsed sidebar and drops the owl", () => {
    expect(LAMP_LAYOUT.rail.width).toBeLessThanOrEqual(52);
    expect(LAMP_LAYOUT.rail.owl).toBeNull();
  });

  it("gives the expanded panel an owl and still fits the 240px rail", () => {
    expect(LAMP_LAYOUT.panel.owl).not.toBeNull();
    expect(LAMP_LAYOUT.panel.width).toBeLessThanOrEqual(240);
  });

  it("hangs both cords on the shade, not beside it", () => {
    for (const layout of [LAMP_LAYOUT.rail, LAMP_LAYOUT.panel]) {
      const half = layout.shadeWidth / 2;
      expect(layout.pullCordX).toBeGreaterThan(layout.shadeCentreX - half);
      expect(layout.pullCordX).toBeLessThan(layout.shadeCentreX + half);
    }
  });
});

describe("shadeArtBox", () => {
  const layout = LAMP_LAYOUT.panel;

  it("scales the box so the painted shade is exactly the requested width", () => {
    const box = shadeArtBox(layout);
    expect(box.width * SHADE_ART.painted.width).toBeCloseTo(layout.shadeWidth);
  });

  it("keeps the source aspect ratio, so the shade is never stretched", () => {
    const box = shadeArtBox(layout);
    expect(box.width / box.height).toBeCloseTo(
      SHADE_ART.source.width / SHADE_ART.source.height,
    );
  });

  it("offsets the box so the painted shade lands on the layout coordinates", () => {
    const box = shadeArtBox(layout);
    const paintedLeft = box.left + SHADE_ART.painted.left * box.width;
    const paintedTop = box.top + SHADE_ART.painted.top * box.height;

    expect(paintedLeft + layout.shadeWidth / 2).toBeCloseTo(layout.shadeCentreX);
    expect(paintedTop).toBeCloseTo(layout.shadeTopY);
  });

  it("puts the mouth below the shade top and no lower than the box", () => {
    const box = shadeArtBox(layout);
    expect(box.mouthY).toBeGreaterThan(layout.shadeTopY);
    expect(box.mouthY).toBeLessThanOrEqual(box.top + box.height);
  });

  it("still places an untrimmed export, where the box is padded around the shade", () => {
    const box = shadeArtBox(layout, {
      source: { width: 1024, height: 1024 },
      painted: { left: 0.1, top: 0.15, width: 0.8, height: 0.7 },
    });

    expect(box.width * 0.8).toBeCloseTo(layout.shadeWidth);
    expect(box.left + 0.1 * box.width).toBeCloseTo(layout.shadeCentreX - layout.shadeWidth / 2);
    expect(box.top + 0.15 * box.height).toBeCloseTo(layout.shadeTopY);
  });

  it("keeps the painted bounds of both exports inside their source box", () => {
    for (const art of [SHADE_ART, OWL_ART]) {
      expect(art.painted.left + art.painted.width).toBeLessThanOrEqual(1);
      expect(art.painted.top + art.painted.height).toBeLessThanOrEqual(1);
    }
  });
});
