/** AI module schemas (W3) — shared FE+BE. */
import { z } from "zod";

/** Premium AI coach chat — a single user message (single-turn, stateless). */
export const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  /** Idempotency key for coin spend (free path) — prevents double-debit on retry. */
  clientMessageId: z.string().uuid().optional(),
  /** Existing thread to continue; omit to start a new conversation. */
  conversationId: z.string().uuid().optional(),
  /** Owned mock exam whose authoritative result summary should ground this message. */
  contextMockExamId: z.string().uuid().optional(),
  /** Published Bilgi article selected by the user as the source for this message. */
  contextArticleSlug: z.string().trim().min(1).max(128).regex(/^[a-z0-9-]+$/).optional(),
});
export type AiChatInput = z.infer<typeof aiChatSchema>;

/** POST /v1/coach/plan-draft — optional free-text wish for the weekly draft. */
export const planDraftSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
export type PlanDraftInput = z.infer<typeof planDraftSchema>;

/** PATCH /v1/coach/messages/:id/feedback — 1 = 👍, -1 = 👎, null = clear. */
export const coachFeedbackSchema = z.object({
  feedback: z.union([z.literal(1), z.literal(-1), z.null()]),
});
export type CoachFeedbackInput = z.infer<typeof coachFeedbackSchema>;

/** Mock-exam wrong-question photo upload (signed URL). */
export const photoUploadUrlSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png"]),
});
export type PhotoUploadUrlInput = z.infer<typeof photoUploadUrlSchema>;

/** Vision categorize request — storage key from prior upload. */
export const categorizePhotoSchema = z.object({
  storageKey: z.string().trim().min(1).max(512),
  clientRequestId: z.string().uuid().optional(),
});
export type CategorizePhotoInput = z.infer<typeof categorizePhotoSchema>;

/** Premium AI reflection on a finalized study session (after micro check-in). */
export const sessionReflectionSchema = z.object({
  sessionId: z.string().uuid(),
});
export type SessionReflectionInput = z.infer<typeof sessionReflectionSchema>;

/** Optional active-exam scope for premium ghost narration. */
export const ghostNarrationSchema = z
  .object({
    examId: z.string().uuid().optional(),
  })
  .default({});
export type GhostNarrationInput = z.infer<typeof ghostNarrationSchema>;




/** Premium weekly review generation request. */
export const weeklyReviewNarrationSchema = z.object({
  examId: z.string().uuid(),
});
export type WeeklyReviewNarrationInput = z.infer<typeof weeklyReviewNarrationSchema>;

