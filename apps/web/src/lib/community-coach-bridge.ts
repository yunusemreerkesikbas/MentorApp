import type {
  ForumCoachIntent,
  PlanTaskDto,
  CommunityCoachPlanTaskOriginDto,
  PlanTaskStatus,
} from "@mentor/types";

export const COACH_RETURN_TO_STORAGE_KEY = "mentor.coach-return-to.v1";

export interface CommunityCoachAttribution {
  intent: ForumCoachIntent;
  zoneType: "CHAT" | "QA";
  conversationId: string;
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
  conversationId: string | null;
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
  if (!params.conversationId || !UUID_PATTERN.test(params.conversationId)) return null;
  return {
    intent: params.intent,
    zoneType: params.zoneType,
    conversationId: params.conversationId,
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CommunityReturnContext {
  intent: ForumCoachIntent;
}

/** Validate the structural return marker; no task, conversation or content travels to the composer. */
export function parseCommunityReturnContext(params: {
  composer: string | null;
  intent: string | null;
}): CommunityReturnContext | null {
  if (params.composer !== "community-return") return null;
  if (
    params.intent !== "PLAN" &&
    params.intent !== "NEXT_STEP" &&
    params.intent !== "STUDY_METHOD" &&
    params.intent !== "STRATEGY"
  ) {
    return null;
  }
  return { intent: params.intent };
}

const COMMUNITY_RETURN_PLACEHOLDER_KEYS = {
  PLAN: "community_return_placeholder_plan",
  NEXT_STEP: "community_return_placeholder_next_step",
  STUDY_METHOD: "community_return_placeholder_study_method",
  STRATEGY: "community_return_placeholder_strategy",
} as const;

export function communityReturnPlaceholderKey(intent: ForumCoachIntent) {
  return COMMUNITY_RETURN_PLACEHOLDER_KEYS[intent];
}

export function communityTaskSourceLabelKey(status: PlanTaskStatus) {
  return status === "DONE"
    ? ("community_task_source_done" as const)
    : ("community_task_source_pending" as const);
}

/** Locale-safe destination for a community-origin task; no reply text is carried in the URL. */
export function communityTaskReturnHref(origin: CommunityCoachPlanTaskOriginDto) {
  return {
    pathname:
      origin.zoneType === "QA"
        ? ("/community/question/[threadId]" as const)
        : ("/community/message/[threadId]" as const),
    params: { threadId: origin.threadId },
    query: { composer: "community-return", intent: origin.intent },
  };
}

/** Pending tasks link back to context; only completed tasks activate the empty share composer. */
export function communityTaskSourceHref(
  origin: CommunityCoachPlanTaskOriginDto,
  status: PlanTaskStatus,
) {
  if (status === "DONE") return communityTaskReturnHref(origin);
  return {
    pathname:
      origin.zoneType === "QA"
        ? ("/community/question/[threadId]" as const)
        : ("/community/message/[threadId]" as const),
    params: { threadId: origin.threadId },
  };
}

export function communityCoachPlanHref(
  task: { title: string; subject: string | null },
  context: CommunityCoachAttribution,
) {
  return {
    pathname: "/plan" as const,
    query: {
      add: "1",
      title: task.title,
      ...(task.subject ? { subject: task.subject } : {}),
      source: "community_coach",
      communityIntent: context.intent,
      communityZoneType: context.zoneType,
      communityConversationId: context.conversationId,
    },
  };
}

/** Completion prompt is ephemeral: only the successful transition triggers it, never list hydration. */
export function shouldShowCommunityCompletionPrompt(
  previousStatus: PlanTaskStatus,
  updated: Pick<PlanTaskDto, "status" | "origin">,
): updated is Pick<PlanTaskDto, "status"> & {
  origin: CommunityCoachPlanTaskOriginDto;
} {
  return (
    previousStatus === "PENDING" &&
    updated.status === "DONE" &&
    updated.origin?.type === "COMMUNITY_COACH"
  );
}
