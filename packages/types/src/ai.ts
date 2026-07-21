/** AI module contracts (W3) — shared by api (producer) and web/mobile (consumers). */

export const CoachAccessMode = {
  PREMIUM: "PREMIUM",
  COIN: "COIN",
  NONE: "NONE",
} as const;
export type CoachAccessMode =
  (typeof CoachAccessMode)[keyof typeof CoachAccessMode];

/** GET /v1/coach/access — whether the user may send a coach chat message. */
export interface CoachAccessDto {
  canChat: boolean;
  mode: CoachAccessMode;
  /** Machine reason when chat is unavailable (including rate-limited PREMIUM mode). */
  reason?: string;
  /** Coin cost per message (COIN path only; never shown inside the chat zone §4 #3). */
  chatCost?: number;
  /** Remaining free-coin messages today (COIN path only). */
  freeCoinMessagesRemainingToday?: number;
  /** Remaining messages in the rolling-24h premium limit (PREMIUM only; a message count, never coins §4 #3). */
  dailyMessagesRemaining?: number;
}

/** GET /v1/coach/conversations item — one chat thread. */
export interface CoachConversationDto {
  id: string;
  /** Derived from the first user message (no LLM). */
  title: string;
  lastMessageAt: string;
  messageCount: number;
}

/** POST /v1/coach/chat response (no coin fields in the chat zone §4 #3). */
export interface CoachChatReplyDto {
  reply: string;
  model: string;
  /** Thread this exchange belongs to — new when the request omitted `conversationId`. */
  conversationId: string;
  sources: { title: string; slug: string; url: string }[];
  /** Authoritative exam-date card; critical facts are never repeated in reply text. */
  officialCountdown?: import("./coaching.js").CountdownDto;
  /** Optional coach-suggested plan task — FE renders a "Plana ekle" card (user confirms; AI never writes). */
  suggestedTask?: { title: string; subject: string | null };
  /** Ephemeral follow-up question chips (max 3) — never persisted; only on the live reply. */
  followUps?: string[];
}

/**
 * POST /v1/coach/chat/stream SSE event payloads: text `delta`s while generating, exactly one
 * terminal `done` (full reply + sources) or `error` (localized ApiError shape).
 */
export type CoachChatStreamEvent =
  | { delta: string }
  | { done: CoachChatReplyDto }
  | { error: { code: string; message: string } };

/** coach_messages.role — who authored a persisted chat message. */
export const CoachMessageRole = {
  USER: "USER",
  COACH: "COACH",
} as const;
export type CoachMessageRole =
  (typeof CoachMessageRole)[keyof typeof CoachMessageRole];

/** GET /v1/coach/messages item — one persisted chat message (single rolling conversation). */
export interface CoachMessageDto {
  id: string;
  role: CoachMessageRole;
  content: string;
  /** RAG source chips on COACH rows; empty on USER rows. */
  sources: { title: string; slug: string; url: string }[];
  /** User rating on a COACH row: 1 = 👍, -1 = 👎, null = none. */
  feedback: number | null;
  /** Persisted coach plan-task suggestion on a COACH row (survives reload). */
  suggestedTask?: { title: string; subject: string | null };
  createdAt: string;
  /** Persisted authoritative exam-date card for deterministic replies. */
  officialCountdown?: import("./coaching.js").CountdownDto;
}

/** GET /v1/coach/memory — legacy saved summary; automatic generation is disabled. */
export interface CoachMemoryDto {
  summary: string;
  updatedAt: string;
}

/** One time-window's aggregate AI usage (admin cost dashboard). Cost is micro-USD. */
export interface AiCostWindowDto {
  costMicros: number;
  calls: number;
  promptTokens: number;
  completionTokens: number;
}

/** GET /v1/admin/metrics/coach-feedback — coach reply satisfaction (Dilim 6 signal → admin report). */
export interface AdminCoachFeedbackDto {
  /** 👍 count on coach replies (all-time). */
  up: number;
  /** 👎 count on coach replies (all-time). */
  down: number;
  /** Total rated coach replies (up + down). */
  rated: number;
  /** up / (up + down); null when nothing has been rated yet. */
  satisfactionRate: number | null;
  /** Most recent 👎 replies with the question that prompted each (admin-only free text). */
  downrated: {
    id: string;
    userId: string;
    question: string | null;
    reply: string;
    createdAt: string;
  }[];
  generatedAt: string;
}

/** GET /v1/admin/metrics/ai — LLM cost visibility (§7). All windows are rolling from now. */
export interface AdminAiCostDto {
  /** Rolling windows: last 24h / 7d / 30d. */
  windows: { d1: AiCostWindowDto; d7: AiCostWindowDto; d30: AiCostWindowDto };
  /** Per-model breakdown over the last 30d, highest cost first. */
  byModel: (AiCostWindowDto & { model: string })[];
  /** Per-feature breakdown over the last 30d (chat/vision/...), highest cost first. */
  byFeature: (AiCostWindowDto & { feature: string })[];
  /** Top spenders over the last 30d (admin-only PII). */
  topSpenders: {
    userId: string;
    email: string;
    displayName: string;
    costMicros: number;
    calls: number;
  }[];
  /** Monthly budget guard status (calendar-month; capMicros 0 = no cap). */
  budget: { capMicros: number; spentMicros: number; exceeded: boolean };
  generatedAt: string;
}

/**
 * POST /v1/coach/mood-reflection response — premium AI-adaptive reflection on today's mood
 * (§4 #5 premium-only; warm/short coaching, never official info §4 #1).
 */
export interface MoodReflectionDto {
  reflection: string;
  model: string;
}

/**
 * POST /v1/coach/session-reflection response — premium AI reflection on a finalized study session
 * after micro check-in (§4 #5 premium-only; warm/short, never official info §4 #1).
 * `model` is "cache" on a hit.
 */
export interface SessionReflectionDto {
  reflection: string;
  model: string;
  /** Plan-task suggestion extracted from the reflection (user confirms via /plan?add=1). */
  suggestedTask?: { title: string; subject: string | null };
}

/**
 * POST /v1/coach/plan-draft response — a clamped 7-day plan PREVIEW (§4 #5 premium-only).
 * Never persisted; the user confirms in the FE and tasks are written via POST /v1/plan-tasks/bulk.
 */
export interface CoachPlanDraftDto {
  days: { date: string; tasks: { title: string; subject: string | null }[] }[];
  model: string;
}

/**
 * POST /v1/coach/daily-greeting response — premium proactive daily greeting on the /coach hub
 * (§4 #5 premium-only; cached per user+day, `model` is "cache" on a hit).
 */
export interface DailyGreetingDto {
  greeting: string;
  model: string;
}

/**
 * POST /v1/coach/vision-note response — premium AI motivation note grounded on the user's vision
 * board (goal + city + "why") + PII-free context (§4 #5 premium-only; never official info §4 #1).
 */
export interface VisionNoteDto {
  note: string;
  model: string;
}

/**
 * POST /v1/coach/ghost-narration response — premium AI narration of the user's progress vs their
 * own past (§4 #5 premium-only; warm/short, never official info §4 #1). `model` is "cache" on a hit.
 */
export interface GhostNarrationDto {
  narration: string;
  model: string;
}

/** GET /v1/coach/photo-access — premium photo categorize gate. */
export interface PhotoAccessDto {
  canCategorize: boolean;
  reason?: string;
  monthlyLimit?: number;
  remainingThisMonth?: number;
}

/** POST /v1/mock-exams/photo-upload-url response. */
export interface PhotoUploadUrlDto {
  uploadUrl: string;
  key: string;
  expiresAt: string;
  maxBytes: number;
}

/** POST /v1/mock-exams/{id}/categorize-photo response — classification only (§4 #2). */
export interface CategorizePhotoResultDto {
  subjectRefs: { slug: string; name: string }[];
  topicRefs: {
    slug: string;
    name: string;
    subjectSlug: string;
    subjectName: string;
  }[];
}

/** Premium weekly coach narration plus deterministic plan-task prefill. */
export interface WeeklyReviewNarrationDto {
  narration: string;
  model: string;
  suggestedTask: { subjectRef: string | null; title: string };
}
