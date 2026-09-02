export const CUSTOM_ONBOARDING_ASSETS_READY = false;

const DEFAULT_PUHU = "/mascot/puhu/puhu-default.png";

export const PUHU_MOTION_FRAMES = {
  default: DEFAULT_PUHU,
  gazeLeft: CUSTOM_ONBOARDING_ASSETS_READY ? "/mascot/puhu/motion/gaze-left.png" : DEFAULT_PUHU,
  gazeRight: CUSTOM_ONBOARDING_ASSETS_READY ? "/mascot/puhu/motion/gaze-right.png" : DEFAULT_PUHU,
  blink: CUSTOM_ONBOARDING_ASSETS_READY ? "/mascot/puhu/motion/blink.png" : DEFAULT_PUHU,
  wave: CUSTOM_ONBOARDING_ASSETS_READY ? "/mascot/puhu/motion/wave.png" : DEFAULT_PUHU,
  talkClosed: CUSTOM_ONBOARDING_ASSETS_READY ? "/mascot/puhu/motion/talk-closed.png" : DEFAULT_PUHU,
  lookDown: CUSTOM_ONBOARDING_ASSETS_READY ? "/mascot/puhu/motion/look-down.png" : DEFAULT_PUHU,
} as const;

export const WELCOME_SCENE_ASSETS = CUSTOM_ONBOARDING_ASSETS_READY
  ? {
      coach: "/visuals/onboarding/coach.png",
      dailyStep: "/visuals/onboarding/daily-step.png",
      community: "/visuals/onboarding/community.png",
    }
  : null;

export const CLOUD_ASSETS = CUSTOM_ONBOARDING_ASSETS_READY
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
