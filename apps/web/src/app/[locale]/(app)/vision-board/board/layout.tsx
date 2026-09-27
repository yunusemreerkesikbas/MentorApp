import type { CSSProperties, ReactNode } from "react";
import "@fontsource-variable/caveat/wght.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/700.css";
import "@fontsource-variable/playfair-display/wght.css";
import "@fontsource-variable/baloo-2/wght.css";
import "@fontsource-variable/oswald/wght.css";
import "@fontsource-variable/merriweather/wght.css";
import "@fontsource/anton/400.css";
import "@fontsource-variable/dancing-script/wght.css";
import "@fontsource-variable/bitter/wght.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import { FONT_FAMILIES } from "@/components/vision-board/board-font-families";

const fontVariables = {
  "--font-script": FONT_FAMILIES.script,
  "--font-vision-heading": FONT_FAMILIES.heading,
  "--font-vision-serif": FONT_FAMILIES.serif,
  "--font-vision-rounded": FONT_FAMILIES.rounded,
  "--font-vision-condensed": FONT_FAMILIES.condensed,
  "--font-vision-classic": FONT_FAMILIES.classic,
  "--font-vision-impact": FONT_FAMILIES.impact,
  "--font-vision-elegant": FONT_FAMILIES.elegant,
  "--font-vision-slab": FONT_FAMILIES.slab,
  "--font-vision-mono": FONT_FAMILIES.mono,
} as CSSProperties;

export default function VisionBoardFontsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div style={fontVariables}>{children}</div>;
}
