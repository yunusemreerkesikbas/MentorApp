/** Shared swatch sets for the collage editor — keep toolbar + color panel in sync. */

export const TEXT_COLORS = ["#111111", "#ffffff", "#b42318", "#2e7d54", "#1d6fbf", "#7c6f97"] as const;
export const PLATE_COLORS = ["#111111", "#ffffff", "#f3705a", "#55acee", "#bea1fe"] as const;
export const BOARD_COLORS = ["#faf7f2", "#ffffff", "#111111", "#c3d9fd", "#ffe8e2"] as const;

export type ColorPanelTarget = "text" | "plate" | "board";
