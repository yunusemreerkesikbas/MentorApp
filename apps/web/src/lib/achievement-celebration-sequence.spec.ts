import { describe, expect, it } from "vitest";

import {
  BADGE_EFFECT_CLIP_PATH,
  BADGE_LIGHT_SWEEPS,
  getAchievementCelebrationLayers,
} from "./achievement-celebration-sequence";

describe("getAchievementCelebrationLayers", () => {
  it("keeps confetti visible when the badge reveal starts", () => {
    expect(
      getAchievementCelebrationLayers({
        reducedMotion: false,
        badgeRevealStarted: false,
        confettiCompleted: false,
      }),
    ).toEqual({ showConfetti: true, showBadge: false });
    expect(
      getAchievementCelebrationLayers({
        reducedMotion: false,
        badgeRevealStarted: true,
        confettiCompleted: false,
      }),
    ).toEqual({ showConfetti: true, showBadge: true });
    expect(
      getAchievementCelebrationLayers({
        reducedMotion: false,
        badgeRevealStarted: true,
        confettiCompleted: true,
      }),
    ).toEqual({ showConfetti: false, showBadge: true });
  });

  it("skips confetti when reduced motion is requested", () => {
    expect(
      getAchievementCelebrationLayers({
        reducedMotion: true,
        badgeRevealStarted: false,
        confettiCompleted: false,
      }),
    ).toEqual({ showConfetti: false, showBadge: true });
  });
});

describe("BADGE_LIGHT_SWEEPS", () => {
  it("uses a strong reveal followed by a softer finishing glint", () => {
    expect(BADGE_LIGHT_SWEEPS).toHaveLength(2);
    expect(BADGE_LIGHT_SWEEPS[1]!.delay - BADGE_LIGHT_SWEEPS[0]!.delay).toBeGreaterThanOrEqual(0.5);
    expect(BADGE_LIGHT_SWEEPS[1]!.peakOpacity).toBeLessThan(
      BADGE_LIGHT_SWEEPS[0]!.peakOpacity,
    );
    expect(BADGE_LIGHT_SWEEPS[1]!.duration).toBeLessThan(
      BADGE_LIGHT_SWEEPS[0]!.duration,
    );
  });
});

describe("BADGE_EFFECT_CLIP_PATH", () => {
  it("clips celebration effects to the five-sided badge silhouette", () => {
    expect(BADGE_EFFECT_CLIP_PATH).toMatch(/^polygon\(/);
    expect(BADGE_EFFECT_CLIP_PATH.match(/%/g)).toHaveLength(10);
  });
});
