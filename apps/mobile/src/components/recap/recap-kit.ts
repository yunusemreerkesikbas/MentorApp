import { FadeIn, FadeInUp } from "react-native-reanimated";
import { careerArt, recapArt } from "../../lib/art.js";
import { useAuth } from "../../providers/auth-provider.js";

/** Puhu in a story pose, or dressed for the user's field (the web's `PuhuImage`). */
export function useRecapPuhu(pose: "host" | "proud"): number {
  const { user } = useAuth();
  return user?.careerGroup ? careerArt[user.careerGroup] : recapArt.puhu[pose];
}

/** Rises in from below (the web's `y: 24 → 0`), or a short fade under reduced motion. */
export const riseIn = (reducedMotion: boolean, ms = 480) =>
  reducedMotion ? FadeIn.duration(120) : FadeInUp.duration(ms);

/** The `Intl` tag for the app locale, as the web formats dates. */
export const recapLocaleTag = (locale: string) => (locale === "en" ? "en-GB" : "tr-TR");
