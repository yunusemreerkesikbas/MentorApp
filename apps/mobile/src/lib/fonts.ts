import { Nunito_500Medium } from "@expo-google-fonts/nunito/500Medium";
import { Nunito_600SemiBold } from "@expo-google-fonts/nunito/600SemiBold";
import { Nunito_700Bold } from "@expo-google-fonts/nunito/700Bold";
import { Nunito_800ExtraBold } from "@expo-google-fonts/nunito/800ExtraBold";
import { Nunito_900Black } from "@expo-google-fonts/nunito/900Black";

/**
 * Nunito, DESIGN.md §3. Per-weight imports keep the eleven unused font files out of the bundle.
 * React Native picks a custom font by family name, not by `fontWeight`, so every weight is its
 * own family and `AppText` maps the type scale's weight onto one of these.
 */
export const APP_FONTS = {
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} as const;

export type AppFontFamily = keyof typeof APP_FONTS;

const FAMILY_BY_WEIGHT: Record<string, AppFontFamily> = {
  "400": "Nunito_500Medium",
  normal: "Nunito_500Medium",
  "500": "Nunito_500Medium",
  "600": "Nunito_600SemiBold",
  "700": "Nunito_700Bold",
  bold: "Nunito_700Bold",
  "800": "Nunito_800ExtraBold",
  "900": "Nunito_900Black",
};

/** The Nunito family for a CSS-style weight; unknown weights read as body text. */
export function fontFamilyFor(weight: string | number | undefined): AppFontFamily {
  return FAMILY_BY_WEIGHT[String(weight ?? "500")] ?? "Nunito_500Medium";
}
