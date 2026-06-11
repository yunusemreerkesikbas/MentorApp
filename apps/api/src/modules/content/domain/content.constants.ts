/** Editorial exam event types — extend when adding application/result windows. */
export const ExamEventType = {
  EXAM_DATE: "EXAM_DATE",
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
} as const;
