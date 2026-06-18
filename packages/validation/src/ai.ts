/** AI module schemas (W3) — shared FE+BE. */
import { z } from "zod";

/** Premium AI coach chat — a single user message (single-turn, stateless). */
export const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  /** Idempotency key for coin spend (free path) — prevents double-debit on retry. */
  clientMessageId: z.string().uuid().optional(),
});
export type AiChatInput = z.infer<typeof aiChatSchema>;
