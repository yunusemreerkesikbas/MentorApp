/** Shared swatch sets for the collage editor — keep toolbar + color panel in sync. */

export const TEXT_COLORS = [
  "#111111",
  "#ffffff",
  "#b42318",
  "#2e7d54",
  "#1d6fbf",
  "#7c6f97",
  "#f3705a",
  "#55acee",
  "#bea1fe",
] as const;

export const PLATE_COLORS = [
  "#111111",
  "#ffffff",
  "#f3705a",
  "#55acee",
  "#bea1fe",
  "#2e7d54",
  "#ffc700",
  "#d6dbfd",
] as const;

export const BOARD_COLORS = [
  "#faf7f2",
  "#ffffff",
  "#111111",
  "#c3d9fd",
  "#ffe8e2",
  "#ddace5",
  "#d6dbfd",
  "#bdebff",
  "#ffd15c",
  "#ffdad6",
  "#f2efe9",
] as const;

/**
 * Hex → translation-key suffix (`t(\`color_name_${name}\`)`). One shared map so the same hex
 * always reads as the same name no matter which palette it shows up in.
 */
export const COLOR_NAMES: Record<string, string> = {
  "#111111": "black",
  "#ffffff": "white",
  "#b42318": "red",
  "#2e7d54": "green",
  "#1d6fbf": "blue",
  "#7c6f97": "purple",
  "#f3705a": "coral",
  "#55acee": "sky",
  "#bea1fe": "violet",
  "#ffc700": "amber",
  "#d6dbfd": "periwinkle",
  "#c3d9fd": "light_blue",
  "#ffe8e2": "peach",
  "#ddace5": "lilac",
  "#bdebff": "cyan",
  "#ffd15c": "butter",
  "#ffdad6": "blush",
  "#f2efe9": "sand",
  "#faf7f2": "paper",
};

export type ColorPanelTarget = "text" | "plate";
