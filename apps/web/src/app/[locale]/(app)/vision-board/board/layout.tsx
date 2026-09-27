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

const fontVariables = {
  "--font-script": '"Caveat Variable", cursive',
  "--font-vision-heading": '"Poppins", sans-serif',
  "--font-vision-serif": '"Playfair Display Variable", serif',
  "--font-vision-rounded": '"Baloo 2 Variable", sans-serif',
  "--font-vision-condensed": '"Oswald Variable", sans-serif',
  "--font-vision-classic": '"Merriweather Variable", serif',
  "--font-vision-impact": '"Anton", sans-serif',
  "--font-vision-elegant": '"Dancing Script Variable", cursive',
  "--font-vision-slab": '"Bitter Variable", serif',
  "--font-vision-mono": '"Space Mono", monospace',
} as CSSProperties;

export default function VisionBoardFontsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div style={fontVariables}>{children}</div>;
}
