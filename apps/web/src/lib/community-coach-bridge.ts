import type { ForumCoachIntent } from "@mentor/types";

export const COACH_RETURN_TO_STORAGE_KEY = "mentor.coach-return-to.v1";

export interface CommunityCoachAttribution {
  intent: ForumCoachIntent;
  zoneType: "CHAT" | "QA";
}

export type CoachReturnHref =
  | { pathname: "/coach" }
  | { pathname: "/coach/chat"; query?: Record<string, string> };

const COACH_RETURN_QUERY_KEYS = new Set([
  "seed",
  "c",
  "contextMockExamId",
  "contextArticleSlug",
  "contextCommunityThreadId",
]);

const DRAFTS: Record<"tr" | "en", Record<ForumCoachIntent, string>> = {
  tr: {
    PLAN: "Planımı daha uygulanabilir hâle getirmeme yardım eder misin?",
    NEXT_STEP: "Bugün atabileceğim küçük bir adımı birlikte çıkaralım mı?",
    STUDY_METHOD: "Çalışma ritmime uygun bir yöntem seçmeme yardım eder misin?",
    STRATEGY: "Mevcut düzenime göre stratejimi netleştirmeme yardım eder misin?",
  },
  en: {
    PLAN: "Can you help me make my plan more practical?",
    NEXT_STEP: "Can we choose one small step I can take today?",
    STUDY_METHOD: "Can you help me find a method that fits my study rhythm?",
    STRATEGY: "Can you help me clarify my strategy for my current routine?",
  },
};

export function communityCoachDraft(
  intent: ForumCoachIntent,
  locale: string,
): string {
  return DRAFTS[locale.toLowerCase().startsWith("en") ? "en" : "tr"][intent];
}

/** Allows only an app-relative path; rejects protocol-relative and backslash ambiguity. */
export function safeInternalReturnTo(
  value: string | null | undefined,
  fallback = "/coach/chat",
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  try {
    const parsed = new URL(value, "https://mentor.invalid");
    return parsed.origin === "https://mentor.invalid"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

/** Convert the stored string to a typed, allowlisted next-intl route. */
export function coachReturnHref(value: string | null | undefined): CoachReturnHref {
  const safe = safeInternalReturnTo(value, "/coach");
  const parsed = new URL(safe, "https://mentor.invalid");
  if (parsed.pathname !== "/coach/chat") return { pathname: "/coach" };

  const query: Record<string, string> = {};
  for (const [key, item] of parsed.searchParams) {
    if (COACH_RETURN_QUERY_KEYS.has(key) && item.length <= 2_000) query[key] = item;
  }
  return Object.keys(query).length > 0
    ? { pathname: "/coach/chat", query }
    : { pathname: "/coach/chat" };
}

/** Parse the content-free attribution carried from a coach suggestion to the plan form. */
export function parseCommunityCoachAttribution(params: {
  source: string | null;
  intent: string | null;
  zoneType: string | null;
}): CommunityCoachAttribution | null {
  if (params.source !== "community_coach") return null;
  if (
    params.intent !== "PLAN" &&
    params.intent !== "NEXT_STEP" &&
    params.intent !== "STUDY_METHOD" &&
    params.intent !== "STRATEGY"
  ) {
    return null;
  }
  if (params.zoneType !== "CHAT" && params.zoneType !== "QA") return null;
  return { intent: params.intent, zoneType: params.zoneType };
}
