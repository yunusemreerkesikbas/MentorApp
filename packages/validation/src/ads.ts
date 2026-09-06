import { z } from "zod";

export const adPlacementIdSchema = z.enum([
  "knowledge.article.end",
  "dashboard.rewarded.coin",
]);

export const adPlacementParamsSchema = z.object({ placementId: adPlacementIdSchema });
export const adPlacementQuerySchema = z.object({
  examType: z.enum(["KPSS", "YKS", "LGS"]).optional(),
  contentSlug: z.string().trim().min(1).max(128).optional(),
});
export const createAdRewardSessionSchema = z.object({
  placementId: z.literal("dashboard.rewarded.coin"),
});
/*
 * There was an `adIdempotencyHeadersSchema` here, wired to `@Headers() dto: AdIdempotencyHeadersDto`.
 * It never ran: Nest reports header params as `ArgumentMetadata.type === "custom"` and hands the
 * pipe `Object` rather than the declared class, so `ZodValidationPipe` finds no schema and passes
 * the raw headers through. Removed rather than left in place — a schema that reads as validation
 * and performs none is a decoy, and the next person to need a validated header would reach for it.
 * Headers are validated with an explicit pipe at the parameter (see `ads.controller.ts`).
 */

export type AdPlacementParamsInput = z.infer<typeof adPlacementParamsSchema>;
export type AdPlacementQueryInput = z.infer<typeof adPlacementQuerySchema>;
export type CreateAdRewardSessionInput = z.infer<typeof createAdRewardSessionSchema>;
