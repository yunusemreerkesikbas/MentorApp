import type { ReactNode } from "react";
import {
  Anton,
  Baloo_2,
  Bitter,
  Caveat,
  Dancing_Script,
  Merriweather,
  Oswald,
  Playfair_Display,
  Poppins,
  Space_Mono,
} from "next/font/google";

const script = Caveat({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-script",
});
const visionHeading = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vision-heading",
});
const visionSerif = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vision-serif",
});
const visionRounded = Baloo_2({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vision-rounded",
});
const visionCondensed = Oswald({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vision-condensed",
});
const visionClassic = Merriweather({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vision-classic",
});
const visionImpact = Anton({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-vision-impact",
});
const visionElegant = Dancing_Script({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vision-elegant",
});
const visionSlab = Bitter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vision-slab",
});
const visionMono = Space_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vision-mono",
});

const fontVariables = [
  script.variable,
  visionHeading.variable,
  visionSerif.variable,
  visionRounded.variable,
  visionCondensed.variable,
  visionClassic.variable,
  visionImpact.variable,
  visionElegant.variable,
  visionSlab.variable,
  visionMono.variable,
].join(" ");

export default function VisionBoardFontsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className={fontVariables}>{children}</div>;
}
