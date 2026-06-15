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

/* --------------------- admin content editor (W6) --------------------- */

const EXAM_FAMILIES = ["KPSS", "YKS", "LGS"] as const;
const ARTICLE_CATEGORIES = ["EXAM_PROCESS", "APPLICATION", "GENERAL"] as const;
const EXAM_VARIANTS = ["LISANS", "ONLISANS", "ORTAOGRETIM"] as const;
/** Editorial calendar event types (mirrors content.constants ExamEventType). */
export const EXAM_EVENT_TYPES = [
  "EXAM_DATE",
  "APPLICATION_START",
  "APPLICATION_END",
  "RESULT_DATE",
] as const;

/** Admin article listing — family optional (list across families incl. drafts). */
export const adminListArticlesQuerySchema = paginationQuerySchema.extend({
  family: z.enum(EXAM_FAMILIES).optional(),
});
export type AdminListArticlesQuery = z.infer<typeof adminListArticlesQuerySchema>;

/**
 * Editorial article create/update (§4 #1): trust metadata is REQUIRED — the LLM never generates
 * official info; an editor enters it with a verifiable source.
 */
export const upsertArticleSchema = z.object({
  slug: z.string().trim().min(1).max(128).regex(/^[a-z0-9-]+$/, "invalid_slug"),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  family: z.enum(EXAM_FAMILIES),
  category: z.enum(ARTICLE_CATEGORIES),
  source: z.string().trim().min(1).max(200),
  sourceUrl: z.string().url(),
  verifiedBy: z.string().trim().min(1).max(120),
  verifiedAt: z.string().min(4).refine((s) => !Number.isNaN(Date.parse(s)), { message: "invalid_date" }),
  metaTitle: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(320).optional(),
});
export type UpsertArticle = z.infer<typeof upsertArticleSchema>;

/* --------------------- admin exam-calendar editor (W6) --------------------- */

/** Admin exam listing — family optional (list across families). */
export const adminListExamsQuerySchema = paginationQuerySchema.extend({
  family: z.enum(EXAM_FAMILIES).optional(),
});
export type AdminListExamsQuery = z.infer<typeof adminListExamsQuerySchema>;

/**
 * Editorial exam create/update (idempotent by slug). `netRule` is the net-scoring rule
 * (PENALTY divisor); `isCurrent` marks the active exam for countdown preference.
 */
export const upsertExamSchema = z.object({
  slug: z.string().trim().min(1).max(128).regex(/^[a-z0-9-]+$/, "invalid_slug"),
  name: z.string().trim().min(1).max(200),
  family: z.enum(EXAM_FAMILIES),
  variant: z.enum(EXAM_VARIANTS).nullish(),
  netRule: z.object({
    kind: z.enum(["PENALTY"]),
    divisor: z.number().int().positive(),
  }),
  isCurrent: z.boolean().optional(),
});
export type UpsertExam = z.infer<typeof upsertExamSchema>;

/**
 * Editorial exam event create/update (§4 #1): trust metadata is REQUIRED — official dates are
 * entered by an editor with a verifiable source; the LLM never generates them.
 */
export const upsertExamEventSchema = z.object({
  type: z.enum(EXAM_EVENT_TYPES),
  eventAt: z.string().min(4).refine((s) => !Number.isNaN(Date.parse(s)), { message: "invalid_date" }),
  source: z.string().trim().min(1).max(200),
  sourceUrl: z.string().url(),
  verifiedBy: z.string().trim().min(1).max(120),
  verifiedAt: z.string().min(4).refine((s) => !Number.isNaN(Date.parse(s)), { message: "invalid_date" }),
});
export type UpsertExamEvent = z.infer<typeof upsertExamEventSchema>;
