import { z } from "zod";

export const adPlacementIdSchema = z.enum([
  "knowledge.article.end",
  "dashboard.rewarded.coin",
]);

export const adPlacementParamsSchema = z.object({ placementId: adPlacementIdSchema });
export const adPlacementQuerySchema = z.object({
  examType: z.enum(["KPSS", "YKS", "LGS"]).optional(),
});
export const createAdRewardSessionSchema = z.object({
  placementId: z.literal("dashboard.rewarded.coin"),
});

export type AdPlacementParamsInput = z.infer<typeof adPlacementParamsSchema>;
export type AdPlacementQueryInput = z.infer<typeof adPlacementQuerySchema>;
export type CreateAdRewardSessionInput = z.infer<typeof createAdRewardSessionSchema>;
