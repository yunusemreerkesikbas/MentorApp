import { CAREER_GROUPS, type CareerGroup } from "@mentor/types";

/**
 * The field a visitor picked at the landing's "your window", carried into onboarding so its field
 * step opens with that answer selected. Best-effort: blocked storage just means no carry-over.
 */
const STORAGE_KEY = "mentor_landing_career";

export type LandingCareer = CareerGroup | "none";

function isLandingCareer(value: string | null): value is LandingCareer {
  return value === "none" || (CAREER_GROUPS as readonly string[]).includes(value ?? "");
}

export function readLandingCareer(): LandingCareer | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isLandingCareer(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveLandingCareer(value: LandingCareer): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* private browsing: the pick still lights the window, it just isn't carried over */
  }
}

export function clearLandingCareer(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
