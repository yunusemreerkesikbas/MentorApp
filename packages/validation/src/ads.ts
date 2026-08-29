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
export const adIdempotencyHeadersSchema = z.object({
  "idempotency-key": z.string().uuid().optional(),
});

export type AdPlacementParamsInput = z.infer<typeof adPlacementParamsSchema>;
export type AdPlacementQueryInput = z.infer<typeof adPlacementQuerySchema>;
export type CreateAdRewardSessionInput = z.infer<typeof createAdRewardSessionSchema>;
export type AdIdempotencyHeadersInput = z.infer<typeof adIdempotencyHeadersSchema>;
