/** Payments schemas (W4) — shared FE+BE. */
import { z } from "zod";
// Leaf import, not the barrel — see the cycle note in promotions.ts.
import { promotionCodeSchema } from "./promotions.js";

export const checkoutSchema = z.object({
  planId: z.string().min(1).max(64),
  /** Optional coupon. Re-validated server-side at checkout — the preview call is advisory only. */
  code: promotionCodeSchema.optional(),
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

/** Admin catalog edit. `id` and `periodMonths` stay immutable. */
export const adminUpdatePlanSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    priceMinor: z.number().int().positive().max(10_000_000).optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.priceMinor !== undefined ||
      value.trialDays !== undefined ||
      value.isActive !== undefined,
    { message: "At least one field is required" },
  );
export type AdminUpdatePlanInput = z.infer<typeof adminUpdatePlanSchema>;
