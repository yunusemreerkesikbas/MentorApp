export function getAchievementCelebrationLayers(input: {
  reducedMotion: boolean;
  badgeRevealStarted: boolean;
  confettiCompleted: boolean;
}) {
  return {
    showConfetti: !input.reducedMotion && !input.confettiCompleted,
    showBadge:
      input.reducedMotion || input.badgeRevealStarted || input.confettiCompleted,
  };
}

export const BADGE_LIGHT_SWEEPS: ReadonlyArray<{
  delay: number;
  duration: number;
  peakOpacity: number;
}> = [
  { delay: 0.32, duration: 0.82, peakOpacity: 0.85 },
  { delay: 0.96, duration: 0.58, peakOpacity: 0.42 },
];

export const BADGE_EFFECT_CLIP_PATH =
  "polygon(50% 2%, 96% 36%, 82% 94%, 18% 94%, 4% 36%)";
