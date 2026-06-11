/** Payments schemas (W4) — shared FE+BE. */
import { z } from "zod";

export const checkoutSchema = z.object({
  planId: z.string().min(1).max(64),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
