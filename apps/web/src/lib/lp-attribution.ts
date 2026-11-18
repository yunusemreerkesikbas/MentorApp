import { type SeoLpSlug, trackSeoLpEvent } from "./analytics";

export const SEO_LP_SOURCE_KEY = "mentor.seo-lp-source.v1";

const VALID_SOURCES = new Set<SeoLpSlug>([
  "pomodoro",
  "yks",
  "tyt",
  "lgs",
  "notebook",
  "study_app",
]);

export function recordSeoLpSource(source: SeoLpSlug): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SEO_LP_SOURCE_KEY, source);
  } catch {
    // sessionStorage unavailable — ignore
  }
}

export function readSeoLpSource(): SeoLpSlug | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(SEO_LP_SOURCE_KEY);
    if (raw && VALID_SOURCES.has(raw as SeoLpSlug)) {
      return raw as SeoLpSlug;
    }
  } catch {
    // sessionStorage unavailable — ignore
  }
  return undefined;
}

export function trackSeoLpSignupClick(
  source: SeoLpSlug,
  location:
    | "hero"
    | "demo"
    | "table"
    | "timer_done"
    | "closing"
    | "parent"
    | "how"
    | "features",
): void {
  recordSeoLpSource(source);
  if (source === "pomodoro") {
    const pomodoroLoc =
      location === "hero" ||
      location === "table" ||
      location === "timer_done" ||
      location === "closing"
        ? location
        : "hero";
    trackSeoLpEvent("signup_from_pomodoro_lp", { location: pomodoroLoc });
    return;
  }
  if (source === "notebook") {
    const placement =
      location === "hero" ||
      location === "demo" ||
      location === "how" ||
      location === "closing"
        ? location
        : "hero";
    trackSeoLpEvent("notebook_cta_click", {
      placement,
      page_type: "mistake_notebook",
    });
    return;
  }
  if (source === "study_app") {
    const placement =
      location === "hero" || location === "features" || location === "closing"
        ? location
        : "hero";
    trackSeoLpEvent("category_cta_click", {
      placement,
      page_type: "study_app",
    });
    return;
  }
  const planClickLoc =
    location === "hero" ||
    location === "demo" ||
    location === "table" ||
    location === "closing" ||
    location === "parent"
      ? location
      : "demo";
  trackSeoLpEvent("plan_cta_click", {
    lp: source,
    location: planClickLoc,
  });
  const planLoc =
    planClickLoc === "parent" ? "closing" : planClickLoc;
  if (source === "yks") {
    trackSeoLpEvent("signup_from_yks_lp", { location: planLoc });
  } else if (source === "tyt") {
    trackSeoLpEvent("signup_from_tyt_lp", { location: planLoc });
  } else {
    trackSeoLpEvent("signup_from_lgs_lp", {
      location: planClickLoc,
    });
  }
}
