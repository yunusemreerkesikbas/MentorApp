import { describe, expect, it } from "vitest";

import {
  SPOTLIGHT_CENTER_X,
  SPOTLIGHT_MAX_ANGLE_DEG,
  SPOTLIGHT_SWEEP_KEYFRAMES,
  SPOTLIGHT_TIMELINE,
  badgeLightIntensity,
  beamAngleDeg,
  beamThrowFalloff,
  lightXFromPointer,
  neighbourLightIntensity,
  resolveSpotlightTimeline,
} from "./spotlight-choreography";

describe("resolveSpotlightTimeline", () => {
  it("zeroes every step under reduced motion", () => {
    const timeline = resolveSpotlightTimeline(true);
    expect(Object.values(timeline).every((ms) => ms === 0)).toBe(true);
  });

  it("keeps the full timeline otherwise", () => {
    expect(resolveSpotlightTimeline(false)).toEqual(SPOTLIGHT_TIMELINE);
  });
});

describe("lightXFromPointer", () => {
  it("maps a pointer across the stage to 0..1", () => {
    expect(lightXFromPointer(100, 100, 400)).toBe(0);
    expect(lightXFromPointer(300, 100, 400)).toBe(SPOTLIGHT_CENTER_X);
    expect(lightXFromPointer(500, 100, 400)).toBe(1);
  });

  it("clamps a pointer dragged past either edge", () => {
    expect(lightXFromPointer(-50, 100, 400)).toBe(0);
    expect(lightXFromPointer(9999, 100, 400)).toBe(1);
  });

  it("falls back to centre when the stage has not been measured yet", () => {
    expect(lightXFromPointer(200, 0, 0)).toBe(SPOTLIGHT_CENTER_X);
  });
});

describe("beamAngleDeg", () => {
  it("hangs straight down at centre", () => {
    expect(beamAngleDeg(SPOTLIGHT_CENTER_X)).toBe(0);
  });

  /* CSS rotates clockwise on positive degrees and the rig points down, so light on the LEFT of
     the stage is a POSITIVE angle. Getting this backwards is invisible in unit tests but obvious
     on screen — the beam chases away from the pointer. */
  it("swings the beam toward the light, not away from it", () => {
    expect(beamAngleDeg(0)).toBe(SPOTLIGHT_MAX_ANGLE_DEG);
    expect(beamAngleDeg(1)).toBe(-SPOTLIGHT_MAX_ANGLE_DEG);
  });
});

describe("badgeLightIntensity", () => {
  it("is fully lit when the beam is centred on the badge", () => {
    expect(badgeLightIntensity(SPOTLIGHT_CENTER_X)).toBe(1);
  });

  it("goes dark once the beam has swung fully aside", () => {
    expect(badgeLightIntensity(0)).toBe(0);
    expect(badgeLightIntensity(1)).toBe(0);
  });

  it("falls off as the beam leaves centre", () => {
    const near = badgeLightIntensity(0.42);
    const far = badgeLightIntensity(0.2);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });
});

describe("beamThrowFalloff", () => {
  it("is brightest with the rig hanging straight down", () => {
    expect(beamThrowFalloff(SPOTLIGHT_CENTER_X)).toBe(1);
  });

  it("dims as the rig swings, symmetrically", () => {
    expect(beamThrowFalloff(0)).toBeCloseTo(beamThrowFalloff(1));
    expect(beamThrowFalloff(0)).toBeLessThan(1);
  });

  /* The cone is meant to fall off hard at the extremes, but it must never read as switched off —
     the rig is still lit, just throwing further. Bound loosened from 0.6 when the coefficient
     went 0.32 → 0.45; it guards the "not off" floor, not a particular look. */
  it("stays visible even at full swing", () => {
    expect(beamThrowFalloff(0)).toBeGreaterThan(0.4);
  });
});

describe("neighbourLightIntensity", () => {
  it("lights each neighbour only on its own side", () => {
    expect(neighbourLightIntensity(SPOTLIGHT_CENTER_X - 0.42, -1)).toBe(1);
    expect(neighbourLightIntensity(SPOTLIGHT_CENTER_X + 0.42, 1)).toBe(1);
    expect(neighbourLightIntensity(SPOTLIGHT_CENTER_X + 0.42, -1)).toBe(0);
  });

  it("leaves neighbours dim while the badge is lit", () => {
    expect(neighbourLightIntensity(SPOTLIGHT_CENTER_X, -1)).toBeLessThan(0.5);
    expect(neighbourLightIntensity(SPOTLIGHT_CENTER_X, 1)).toBeLessThan(0.5);
  });
});

describe("SPOTLIGHT_SWEEP_KEYFRAMES", () => {
  it("ends centred so the pointer takes over without a jump", () => {
    expect(SPOTLIGHT_SWEEP_KEYFRAMES.at(-1)).toBe(SPOTLIGHT_CENTER_X);
  });

  /* The badge has to start in the dark and be found by the beam; a centred first frame lit it
     before the swing and then took it away, which reads backwards. */
  it("starts hard over at an edge, not centred", () => {
    const first = SPOTLIGHT_SWEEP_KEYFRAMES.at(0)!;
    expect(Math.abs(first - SPOTLIGHT_CENTER_X)).toBeGreaterThan(0.35);
  });

  it("decays — each swing reaches less far than the one before", () => {
    const amplitudes = SPOTLIGHT_SWEEP_KEYFRAMES.slice(0, -1).map((x) =>
      Math.abs(x - SPOTLIGHT_CENTER_X),
    );
    for (let i = 1; i < amplitudes.length; i += 1) {
      expect(amplitudes[i]).toBeLessThan(amplitudes[i - 1]!);
    }
  });

  it("stays inside the stage", () => {
    for (const x of SPOTLIGHT_SWEEP_KEYFRAMES) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
  });
});
