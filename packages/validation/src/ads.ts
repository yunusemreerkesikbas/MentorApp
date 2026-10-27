import { z } from "zod";
import { listInfoArticlesQuerySchema } from "./content.js";

export const adPlacementIdSchema = z.enum([
  "community.announcement.end",
  "community.overview",
  "knowledge.article.end",
  "knowledge.index",
  "forum.question.end",
  "community.question.end",
  "dashboard.rewarded.coin",
  "notebooks.overview",
  "vision.overview",
]);

/** Ad Manager inventory paths only; an empty value leaves the placement unconfigured. */
export const googleAdUnitPathSchema = z.string().trim().max(1024).refine(
  (value) => value === "" || /^\/\d+(?:,\d+)?\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(value),
  "Expected a Google Ad Manager unit path, not a URL or script.",
);

export const adPlacementParamsSchema = z.object({ placementId: adPlacementIdSchema });
export const adBlogListContextSchema = listInfoArticlesQuerySchema.pick({ family: true, category: true, page: true });
export type AdBlogListContext = z.infer<typeof adBlogListContextSchema>;
export const adQuestionContextSchema = z.object({
  questionId: z.string().uuid(),
  contentRevision: z.string().regex(/^[a-f0-9]{64}$/),
});
export const adQuestionParamsSchema = adQuestionContextSchema.pick({ questionId: true });
export const adAnnouncementParamsSchema = z.object({ threadId: z.string().uuid() });
export const adAnnouncementContextSchema = adAnnouncementParamsSchema.extend({ contentRevision: adQuestionContextSchema.shape.contentRevision });
export const approveAdQuestionSchema = adQuestionContextSchema.pick({ contentRevision: true });
export const adPlacementQuerySchema = z.object({
  ...adBlogListContextSchema.partial().shape,
  examType: z.enum(["KPSS", "YKS", "LGS"]).optional(),
  contentSlug: z.string().trim().min(1).max(128).optional(),
  ...adQuestionContextSchema.partial().shape,
  threadId: z.string().uuid().optional(),
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
