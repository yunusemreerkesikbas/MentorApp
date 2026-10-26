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

/**
 * Friend invite code input → canonical form: trimmed, uppercased, legacy `MENTOR-` mapped to `PUHU-`.
 * Shared FE+BE so the web field, the invite link and the redeem endpoint all agree on one shape.
 */
export const normalizeInviteCode = (raw: string): string =>
  raw.trim().toUpperCase().replace(/^MENTOR-/, "PUHU-");

/** Normalized friend invite code. New codes are `PUHU-` + 8 chars; migrated legacy ones carry 12. */
export const inviteCodeSchema = z
  .string()
  .transform(normalizeInviteCode)
  .pipe(z.string().regex(/^PUHU-[0-9A-Z]{8,12}$/));

/** Redeem an invite code (post-signup). The output code is already normalized; server validates existence. */
export const redeemInviteSchema = z.object({
  code: inviteCodeSchema,
});
export type RedeemInvite = z.infer<typeof redeemInviteSchema>;

/** Deep-analysis unlock (coin sink): the exam whose weekly review is being unlocked. */
export const deepAnalysisSchema = z.object({
  examId: z.string().uuid(),
});
export type DeepAnalysis = z.infer<typeof deepAnalysisSchema>;

export const economyRewardsSeenSchema = z.object({
  ledgerIds: z.array(z.string().uuid()).min(1).max(100),
});
