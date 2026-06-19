/** AI module schemas (W3) — shared FE+BE. */
import { z } from "zod";

/** Premium AI coach chat — a single user message (single-turn, stateless). */
export const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  /** Idempotency key for coin spend (free path) — prevents double-debit on retry. */
  clientMessageId: z.string().uuid().optional(),
});
export type AiChatInput = z.infer<typeof aiChatSchema>;

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
