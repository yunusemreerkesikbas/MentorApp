/** Content module request/query schemas — shared FE+BE. */
import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const listExamsQuerySchema = paginationQuerySchema;
export type ListExamsQuery = z.infer<typeof listExamsQuerySchema>;

export const examFamilyParamSchema = z.object({
  type: z.enum(["KPSS", "YKS", "LGS"]),
});
export type ExamFamilyParam = z.infer<typeof examFamilyParamSchema>;

export const examSlugParamSchema = z.object({
  slug: z.string().min(1).max(128),
});
export type ExamSlugParam = z.infer<typeof examSlugParamSchema>;

export const listInfoArticlesQuerySchema = paginationQuerySchema.extend({
  family: z.enum(["KPSS", "YKS", "LGS"]),
});
export type ListInfoArticlesQuery = z.infer<typeof listInfoArticlesQuerySchema>;

export const infoArticleSlugParamSchema = z.object({
  slug: z.string().min(1).max(128),
});
export type InfoArticleSlugParam = z.infer<typeof infoArticleSlugParamSchema>;
