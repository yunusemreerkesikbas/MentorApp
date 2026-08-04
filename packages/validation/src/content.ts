/** Content module request/query schemas — shared FE+BE. */
import { z } from "zod";
import { isoDateSchema } from "./coaching.js";
import { paginationQuerySchema } from "./pagination.js";
import { YKS_SCORE_TYPES } from "@mentor/types";

export const PUBLIC_HOLIDAY_KINDS = ["FULL", "HALF"] as const;

/**
 * Inclusive date range for the holiday lookup. Capped at the same 62 days as the plan-task
 * calendar so one month grid (42 days) fits in a single request and nothing unbounded escapes.
 */
export const listPublicHolidaysQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    /** ISO 3166-1 alpha-2; defaults to Turkey. */
    country: z.string().trim().length(2).toUpperCase().default("TR"),
  })
  .superRefine((data, ctx) => {
    if (data.from > data.to) {
      ctx.addIssue({ code: "custom", message: "invalid_range", path: ["to"] });
      return;
    }
    const fromMs = new Date(`${data.from}T12:00:00`).getTime();
    const toMs = new Date(`${data.to}T12:00:00`).getTime();
    if (Math.floor((toMs - fromMs) / 86_400_000) + 1 > 62) {
      ctx.addIssue({ code: "custom", message: "range_too_large", path: ["to"] });
    }
  });
export type ListPublicHolidaysQuery = z.infer<typeof listPublicHolidaysQuerySchema>;

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

/**
 * Geo search query. Bounded on both ends: under two characters every result list would be
 * meaningless, and the upper bound keeps a pathological string out of the LIKE pattern.
 */
export const geoSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
  /**
   * Which reference sets to search. Defaults to YKS so existing callers keep working; a KPSS
   * client sends "KPSS" and stops receiving university programs it has no use for.
   */
  family: z.enum(["YKS", "KPSS", "LGS"]).default("YKS"),
});
export type GeoSearchQuery = z.infer<typeof geoSearchQuerySchema>;

/** Active, official YKS program catalogue search used by the preference builder. */
export const programCatalogSearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(2).max(100),
  scoreType: z.enum(YKS_SCORE_TYPES).optional(),
});
export type ProgramCatalogSearchQuery = z.infer<
  typeof programCatalogSearchQuerySchema
>;

/* --------------------- admin content editor (W6) --------------------- */

const EXAM_FAMILIES = ["KPSS", "YKS", "LGS"] as const;

const ARTICLE_CATEGORIES = ["EXAM_PROCESS", "APPLICATION", "GENERAL"] as const;
export const ARTICLE_BODY_FORMATS = ["MARKDOWN", "HTML"] as const;
const EXAM_VARIANTS = ["LISANS", "ONLISANS", "ORTAOGRETIM"] as const;
const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), { message: "invalid_http_url" });
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
export const upsertArticleSchema = z
  .object({
    slug: z.string().trim().min(1).max(128).regex(/^[a-z0-9-]+$/, "invalid_slug"),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1),
    bodyFormat: z.enum(ARTICLE_BODY_FORMATS).default("MARKDOWN"),
    family: z.enum(EXAM_FAMILIES),
    category: z.enum(ARTICLE_CATEGORIES),
    source: z.string().trim().min(1).max(200),
    sourceUrl: httpUrlSchema,
    verifiedBy: z.string().trim().min(1).max(120),
    verifiedAt: z.string().min(4).refine((s) => !Number.isNaN(Date.parse(s)), { message: "invalid_date" }),
    metaTitle: z.string().trim().max(200).optional(),
    metaDescription: z.string().trim().max(320).optional(),
    authorName: z.string().trim().min(1).max(120).nullish(),
    authorTitle: z.string().trim().min(1).max(160).nullish(),
    authorBio: z.string().trim().min(1).max(500).nullish(),
    coverImageKey: z
      .string()
      .trim()
      .startsWith("content/articles/cover/")
      .max(500)
      .nullish(),
    coverImageAlt: z.string().trim().min(1).max(300).nullish(),
    coverImageWidth: z.number().int().positive().nullish(),
    coverImageHeight: z.number().int().positive().nullish(),
  })
  .superRefine((value, ctx) => {
    const cover = [
      value.coverImageKey,
      value.coverImageAlt,
      value.coverImageWidth,
      value.coverImageHeight,
    ];
    if (cover.some((field) => field != null) && cover.some((field) => field == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "incomplete_cover_image",
        path: ["coverImageKey"],
      });
    }
  });
export type UpsertArticle = z.infer<typeof upsertArticleSchema>;

export const articleImageUploadSchema = z.object({
  purpose: z.enum(["COVER", "BODY"]),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
export type ArticleImageUpload = z.infer<typeof articleImageUploadSchema>;

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
  sourceUrl: httpUrlSchema,
  verifiedBy: z.string().trim().min(1).max(120),
  verifiedAt: z.string().min(4).refine((s) => !Number.isNaN(Date.parse(s)), { message: "invalid_date" }),
});
export type UpsertExamEvent = z.infer<typeof upsertExamEventSchema>;
