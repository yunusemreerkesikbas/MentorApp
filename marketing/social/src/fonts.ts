import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { loadVariableFont } from "@remotion/google-fonts/Nunito";
import { FONT_SUBSETS } from "./brand";

// Nunito as the variable font: the static set stops at 900 and the kit uses 1000.
export const nunito = loadVariableFont("normal", { subsets: [...FONT_SUBSETS] }).fontFamily;
export const caveat = loadCaveat("normal", { weights: ["700"], subsets: [...FONT_SUBSETS] }).fontFamily;
