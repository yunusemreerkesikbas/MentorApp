import type { WeeklyRecapSlideKind } from "@mentor/core";

/**
 * The weekly recap's scene colours (web `--recap-*` in globals.css). Like the chest scene's, they
 * belong to the scene, not the app theme, so they stay the same in dark mode.
 */
export const RECAP = {
  coral: "#ff5b49",
  lavender: "#afb1ff",
  mint: "#16d0a6",
  sky: "#e3ecef",
  ink: "#000000",
} as const;

/** Each slide's ground (the web story's `STORY_COLORS`). */
export const STORY_COLORS: Record<WeeklyRecapSlideKind, string> = {
  welcome: RECAP.coral,
  week_map: RECAP.sky,
  focus: RECAP.coral,
  weekly_run: RECAP.lavender,
  weekly_best: RECAP.lavender,
  performance: RECAP.mint,
  spark: RECAP.mint,
  weekly_title: RECAP.ink,
  partial_unlocks: RECAP.coral,
  partial_final: RECAP.ink,
  final: RECAP.ink,
};
