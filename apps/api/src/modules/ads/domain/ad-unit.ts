import { GOOGLE_DISPLAY_TEST_AD_UNIT } from "./ads.constants";

export function resolveAdUnit(configured: string | undefined, legacyValue: unknown): { path: string | null; source: "CONFIG" | "ENV" | "NONE" } {
  if (configured?.trim()) return { path: configured.trim(), source: "CONFIG" };
  if (typeof legacyValue === "string" && legacyValue.trim()) return { path: legacyValue.trim(), source: "ENV" };
  return { path: null, source: "NONE" };
}

/** Google's official sample network must never be mistaken for publisher revenue inventory. */
export function isGoogleTestAdUnit(path: string | null): boolean {
  const sampleNetwork = GOOGLE_DISPLAY_TEST_AD_UNIT.split("/")[1]!;
  return path?.split("/")[1]?.split(",").includes(sampleNetwork) ?? false;
}
