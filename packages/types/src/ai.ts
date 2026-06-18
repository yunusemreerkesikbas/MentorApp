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
