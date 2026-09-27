import type { VisionBoardTextItem } from "@mentor/types";

/** Shared by the DOM editor and Canvas export so a chosen face renders the same in both. */
export const FONT_FAMILIES: Record<VisionBoardTextItem["font"], string> = {
  body: '"Nunito", sans-serif',
  heading: '"Poppins", sans-serif',
  script: '"Caveat Variable", cursive',
  serif: '"Playfair Display Variable", Georgia, serif',
  rounded: '"Baloo 2 Variable", sans-serif',
  condensed: '"Oswald Variable", sans-serif',
  classic: '"Merriweather Variable", serif',
  impact: '"Anton", sans-serif',
  elegant: '"Dancing Script Variable", cursive',
  slab: '"Bitter Variable", serif',
  mono: '"Space Mono", monospace',
};
