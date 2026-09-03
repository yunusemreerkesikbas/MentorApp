export const ONBOARDING_ASSET_READINESS = {
  puhuMotion: true,
  welcomeScenes: false,
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

export const WELCOME_SCENE_ASSETS = ONBOARDING_ASSET_READINESS.welcomeScenes
  ? {
      coach: "/visuals/onboarding/coach.png",
      dailyStep: "/visuals/onboarding/daily-step.png",
      community: "/visuals/onboarding/community.png",
    }
  : null;

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
