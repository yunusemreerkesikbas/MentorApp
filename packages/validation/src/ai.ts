/** AI module schemas (W3) — shared FE+BE. */
import { z } from "zod";

/** Premium AI coach chat — a single user message (single-turn, stateless). */
export const aiChatSchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    /** Idempotency key for coin spend (free path) — prevents double-debit on retry. */
    clientMessageId: z.string().uuid().optional(),
    /** Existing thread to continue; omit to start a new conversation. */
    conversationId: z.string().uuid().optional(),
    /** Owned mock exam whose authoritative result summary should ground this message. */
    contextMockExamId: z.string().uuid().optional(),
    /** Published Knowledge article selected by the user as the source for this message. */
    contextArticleSlug: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    /** Eligible CHAT/QA source used only when creating a new coach conversation. */
    contextCommunityThreadId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.conversationId && value.contextCommunityThreadId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contextCommunityThreadId"],
        message: "contextCommunityThreadId cannot be used with conversationId",
      });
    }
  });
export type AiChatInput = z.infer<typeof aiChatSchema>;

export const coachProfilePatchSchema = z
  .object({
    calibrationStatus: z
      .enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "SKIPPED"])
      .optional(),
    memoryConsent: z.enum(["PENDING", "GRANTED", "DECLINED"]).optional(),
    supportPreference: z
      .enum(["EMOTIONAL", "BALANCED", "ACTION"])
      .nullable()
      .optional(),
    directnessPreference: z
      .enum(["GENTLE", "BALANCED", "DIRECT"])
      .nullable()
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "empty" });
export type CoachProfilePatchInput = z.infer<typeof coachProfilePatchSchema>;

export const coachMemoryFactPatchSchema = z
  .object({ value: z.string().trim().min(1).max(80) })
  .strict();
export type CoachMemoryFactPatchInput = z.infer<
  typeof coachMemoryFactPatchSchema
>;

export const coachActionDecisionSchema = z
  .object({ decision: z.enum(["ACCEPT", "CANCEL"]) })
  .strict();
export type CoachActionDecisionInput = z.infer<
  typeof coachActionDecisionSchema
>;

/** POST /v1/coach/plan-draft — optional free-text wish for the weekly draft. */
export const planDraftSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
export type PlanDraftInput = z.infer<typeof planDraftSchema>;

const planAdaptationMinutesSchema = z.union([
  z.literal(15),
  z.literal(30),
  z.literal(60),
  z.literal(90),
  z.literal(120),
]);

/** Block sizes the plan wizard offers; the brief's suggestion snaps to one of these. */
export const PLAN_ADAPTATION_MINUTES = planAdaptationMinutesSchema.options.map(
  (option) => option.value,
);

/** POST /v1/coach/plan-adaptation — explicit, user-triggered preview source. */
export const coachPlanAdaptationSchema = z
  .object({
    source: z.enum(["PLAN", "MOOD", "SESSION"]),
    note: z.string().trim().max(500).optional(),
    sessionId: z.string().uuid().optional(),
    /** Study days inside the 7-day window. PLAN only. */
    days: z.number().int().min(1).max(7).optional(),
    /** Target size of each added block, in minutes. PLAN only. */
    minutesPerDay: planAdaptationMinutesSchema.optional(),
    /** Subjects the added tasks must use. PLAN only, at most 3. */
    focusSubjects: z.array(z.string().trim().min(1).max(80)).max(3).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.source === "SESSION" && !value.sessionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sessionId"],
        message: "sessionId is required for SESSION source",
      });
    }
    if (value.source !== "SESSION" && value.sessionId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sessionId"],
        message: "sessionId is only allowed for SESSION source",
      });
    }
    if (value.source !== "PLAN" && value.note !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "note is only allowed for PLAN source",
      });
    }
    if (
      value.source !== "PLAN" &&
      (value.days !== undefined ||
        value.minutesPerDay !== undefined ||
        value.focusSubjects !== undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["days"],
        message: "days, minutesPerDay and focusSubjects are only allowed for PLAN source",
      });
    }
  });
export type CoachPlanAdaptationInput =
  | {
      source: "PLAN";
      note?: string;
      days?: number;
      minutesPerDay?: 15 | 30 | 60 | 90 | 120;
      focusSubjects?: string[];
    }
  | { source: "MOOD" }
  | { source: "SESSION"; sessionId: string };

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
export type WeeklyReviewNarrationInput = z.infer<
  typeof weeklyReviewNarrationSchema
>;
