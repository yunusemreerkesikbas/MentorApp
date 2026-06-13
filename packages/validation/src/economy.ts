/**
 * Economy schemas (W6 light economy) — shared FE+BE (§8). User-facing copy is localized by the backend.
 */
import { z } from "zod";
import { Currency } from "@mentor/types";

/** Max magnitude of a single admin adjustment (fat-finger guard; corrections are small/medium). */
export const ECONOMY_ADJUST_MAX = 1_000_000;

/** Admin manual ledger adjustment (correction/support). Amount is signed, non-zero, bounded. */
export const economyAdjustSchema = z.object({
  unit: z.nativeEnum(Currency),
  amount: z.coerce
    .number()
    .int()
    .min(-ECONOMY_ADJUST_MAX)
    .max(ECONOMY_ADJUST_MAX)
    .refine((n) => n !== 0, { message: "amount_must_be_nonzero" }),
  reason: z.string().trim().min(1).max(200),
  note: z.string().trim().max(500).optional(),
});
export type EconomyAdjust = z.infer<typeof economyAdjustSchema>;
