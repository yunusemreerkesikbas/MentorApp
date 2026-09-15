import type { CareerGroup } from "@mentor/types";

export const ONBOARDING_ASSET_READINESS = {
  puhuMotion: true,
  clouds: false,
} as const;

const PUHU_MOTION_ROOT = "/mascot/puhu/motion";

export const PUHU_MOTION_FRAMES = {
  default: `${PUHU_MOTION_ROOT}/rest.png`,
  gazeLeft: `${PUHU_MOTION_ROOT}/gaze-left.png`,
  gazeRight: `${PUHU_MOTION_ROOT}/gaze-right.png`,
  blink: `${PUHU_MOTION_ROOT}/blink.png`,
  wave: `${PUHU_MOTION_ROOT}/wave.png`,
  talkClosed: `${PUHU_MOTION_ROOT}/talk-closed.png`,
  lookDown: `${PUHU_MOTION_ROOT}/look-down.png`,
} as const;

const SCENE_ROOT = "/visuals/onboarding";

function welcomeScene(n: number, ground: string) {
  return {
    ground,
    video: `${SCENE_ROOT}/welcome-scene-${n}.mp4`,
    start: `${SCENE_ROOT}/welcome-scene-${n}-start.webp`,
    end: `${SCENE_ROOT}/welcome-scene-${n}-end.webp`,
  };
}

/**
 * "Puhu'nun bir günü": one clip per welcome slide, dawn → morning → afternoon → evening.
 * `start` / `end` are the clip's own first and last frames, so the poster never jumps when playback
 * begins and reduced motion can show the end state. `ground` is the artwork's edge colour, painted
 * only while the poster loads — art palette, not a UI token. Encoding notes: the folder README.
 */
export const WELCOME_SCENES = [
  welcomeScene(1, "#be9baa"),
  welcomeScene(2, "#96a0bc"),
  welcomeScene(3, "#d28e64"),
  welcomeScene(4, "#14284e"),
] as const;

/**
 * Soft-3D career Puhu (onboarding field cards, "Yolun hazır" window). The set ships on a white
 * ground, so place it with `mix-blend-multiply`; the flat `/mascot/career/` set stays for stickers.
 */
export function careerPuhu3d(group: CareerGroup): string {
  return `/mascot/career-3d/${group.toLowerCase()}.webp`;
}

export const CLOUD_ASSETS = ONBOARDING_ASSET_READINESS.clouds
  ? {
      left: "/visuals/onboarding/cloud-left.png",
      right: "/visuals/onboarding/cloud-right.png",
      bottom: "/visuals/onboarding/cloud-bottom.png",
    }
  : null;

export const ONBOARDING_MOTION = {
  phraseSeconds: 0.24,
  stepSeconds: 0.3,
  completionCenterSeconds: 0.4,
  cloudCoverSeconds: 0.5,
  authSplitMs: 260,
} as const;
