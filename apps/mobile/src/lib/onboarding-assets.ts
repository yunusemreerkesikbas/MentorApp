/* eslint-disable @typescript-eslint/no-require-imports -- Metro bundles these literal asset paths. */
import type { CareerGroup } from "@mentor/types";

/** The web's `onboarding-assets.ts`, bundled. Clips are 3:5, posters are their first and last frames. */
export const WELCOME_SCENES = [
  { video: require("../../../web/public/visuals/onboarding/welcome-scene-1.mp4"), start: require("../../../web/public/visuals/onboarding/welcome-scene-1-start.webp"), end: require("../../../web/public/visuals/onboarding/welcome-scene-1-end.webp"), tint: "#be9baa" },
  { video: require("../../../web/public/visuals/onboarding/welcome-scene-2.mp4"), start: require("../../../web/public/visuals/onboarding/welcome-scene-2-start.webp"), end: require("../../../web/public/visuals/onboarding/welcome-scene-2-end.webp"), tint: "#96a0bc" },
  { video: require("../../../web/public/visuals/onboarding/welcome-scene-3.mp4"), start: require("../../../web/public/visuals/onboarding/welcome-scene-3-start.webp"), end: require("../../../web/public/visuals/onboarding/welcome-scene-3-end.webp"), tint: "#d28e64" },
  { video: require("../../../web/public/visuals/onboarding/welcome-scene-4.mp4"), start: require("../../../web/public/visuals/onboarding/welcome-scene-4-start.webp"), end: require("../../../web/public/visuals/onboarding/welcome-scene-4-end.webp"), tint: "#14284e" },
] as const satisfies readonly { video: number; start: number; end: number; tint: string }[];

export const PUHU_MOTION_FRAMES = {
  default: require("../../../web/public/mascot/puhu/motion/rest.png"),
  gazeLeft: require("../../../web/public/mascot/puhu/motion/gaze-left.png"),
  gazeRight: require("../../../web/public/mascot/puhu/motion/gaze-right.png"),
  blink: require("../../../web/public/mascot/puhu/motion/blink.png"),
  wave: require("../../../web/public/mascot/puhu/motion/wave.png"),
  talkClosed: require("../../../web/public/mascot/puhu/motion/talk-closed.png"),
  lookDown: require("../../../web/public/mascot/puhu/motion/look-down.png"),
} as const satisfies Record<string, number>;

export type PuhuPose = keyof typeof PUHU_MOTION_FRAMES;

const CAREER_PUHU_3D: Record<CareerGroup, number> = {
  SAGLIK: require("../../../web/public/mascot/career-3d/saglik.webp"),
  MUHENDISLIK: require("../../../web/public/mascot/career-3d/muhendislik.webp"),
  YAZILIM: require("../../../web/public/mascot/career-3d/yazilim.webp"),
  HUKUK_KAMU: require("../../../web/public/mascot/career-3d/hukuk_kamu.webp"),
  EGITIM: require("../../../web/public/mascot/career-3d/egitim.webp"),
  ISLETME: require("../../../web/public/mascot/career-3d/isletme.webp"),
  SOSYAL_ILETISIM: require("../../../web/public/mascot/career-3d/sosyal_iletisim.webp"),
  SANAT_TASARIM: require("../../../web/public/mascot/career-3d/sanat_tasarim.webp"),
  FEN: require("../../../web/public/mascot/career-3d/fen.webp"),
  MIMARLIK: require("../../../web/public/mascot/career-3d/mimarlik.webp"),
};

/** Soft-3D career Puhu on a white ground (field cards, "Yolun hazır" window). */
export function careerPuhu3d(group: CareerGroup): number {
  return CAREER_PUHU_3D[group];
}

/** The web's `PuhuImage` variants on the daily-goal cards, lightest to busiest. */
export const DAILY_GOAL_PUHU = {
  60: require("../../../web/public/mascot/puhu/puhu-default.png"),
  120: require("../../../web/public/mascot/puhu/puhu-happy.png"),
  240: require("../../../web/public/mascot/puhu/puhu-encouraging.png"),
  360: require("../../../web/public/mascot/puhu/puhu-surprised.png"),
} as const;
