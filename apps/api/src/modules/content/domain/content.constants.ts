/**
 * Editorial exam event types. EXAM_DATE drives the countdown (`listFamilyCandidates`); the
 * application/result windows are admin-editable calendar entries (web rendering of the extra
 * types is a separate frontend task).
 */
export const ExamEventType = {
  EXAM_DATE: "EXAM_DATE",
  APPLICATION_START: "APPLICATION_START",
  APPLICATION_END: "APPLICATION_END",
  RESULT_DATE: "RESULT_DATE",
} as const;
export type ExamEventType = (typeof ExamEventType)[keyof typeof ExamEventType];

/** Matches `@mentor/types` ExamType / identity `users.examType`. */
export const ExamFamily = {
  KPSS: "KPSS",
  YKS: "YKS",
  LGS: "LGS",
} as const;
export type ExamFamily = (typeof ExamFamily)[keyof typeof ExamFamily];

/** KPSS sub-types stored on `exams.variant` (countdown variant pick deferred). */
export const ExamVariant = {
  LISANS: "LISANS",
  ONLISANS: "ONLISANS",
  ORTAOGRETIM: "ORTAOGRETIM",
} as const;
export type ExamVariant = (typeof ExamVariant)[keyof typeof ExamVariant];

/** Knowledge-center article categories (A-layer). */
export const InfoArticleCategory = {
  EXAM_PROCESS: "EXAM_PROCESS",
  APPLICATION: "APPLICATION",
  GENERAL: "GENERAL",
} as const;
export type InfoArticleCategory =
  (typeof InfoArticleCategory)[keyof typeof InfoArticleCategory];

/** Domain event topic strings (code-style §4). */
export const ContentEventTopic = {
  ARTICLE_PUBLISHED: "content.article.published",
  ARTICLE_UPDATED: "content.article.updated",
} as const;

/**
 * Article cover/body image upload cap. Lives here rather than inline in the service because the
 * dev fake-storage controller enforces the same number on the way in — two copies of a limit is
 * how one of them quietly stops matching the other.
 *
 * R2 cannot enforce this: a presigned PUT accepts whatever the client sends, so this is an
 * advisory the client checks and the fake path enforces. Real protection is the bucket's
 * lifecycle/orphan sweep, not this constant.
 */
export const ARTICLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const ARTICLE_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
