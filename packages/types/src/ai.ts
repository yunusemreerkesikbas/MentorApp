/** AI module contracts (W3) — shared by api (producer) and web/mobile (consumers). */

export const CoachAccessMode = {
  PREMIUM: "PREMIUM",
  COIN: "COIN",
  NONE: "NONE",
} as const;
export type CoachAccessMode = (typeof CoachAccessMode)[keyof typeof CoachAccessMode];

/** GET /v1/coach/access — whether the user may send a coach chat message. */
export interface CoachAccessDto {
  canChat: boolean;
  mode: CoachAccessMode;
  /** Machine reason when mode=NONE (e.g. INSUFFICIENT_COIN, PAYMENT_PREMIUM_REQUIRED). */
  reason?: string;
  /** Coin cost per message (COIN path only; never shown inside the chat zone §4 #3). */
  chatCost?: number;
  /** Remaining free-coin messages today (COIN path only). */
  freeCoinMessagesRemainingToday?: number;
}

/** POST /v1/coach/chat response (no coin fields in the chat zone §4 #3). */
export interface CoachChatReplyDto {
  reply: string;
  model: string;
  sources: { title: string; slug: string; url: string }[];
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
}
