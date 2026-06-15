/** Payments schemas (W4) — shared FE+BE. */
import { z } from "zod";

export const checkoutSchema = z.object({
  planId: z.string().min(1).max(64),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/**
 * Admin refund (W6): record-only ledger refund of the last successful charge. Amount is integer
 * minor units (kuruş), capped server-side to the remaining refundable amount. Reason is required.
 */
export const adminRefundSchema = z.object({
  amountMinor: z.number().int().positive(),
  reason: z.string().trim().min(1).max(200),
});
export type AdminRefundInput = z.infer<typeof adminRefundSchema>;
