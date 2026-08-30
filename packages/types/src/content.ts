/**
 * Content API contracts (W1 exam calendar) — shared by api and web.
 * Critical dates render as data cards verbatim (guardrail §4 #1).
 */

export interface ExamSummaryDto {
  id: string;
  slug: string;
  name: string;
  family: string;
  variant: string | null;
  isCurrent: boolean;
}

export type PublicHolidayKind = "FULL" | "HALF";

/**
 * An official public holiday. Carries the same trust metadata as every other editorial fact —
 * the client displays it verbatim and never derives holidays on its own (guardrail §4 #1).
 */
export interface PublicHolidayDto {
  /** yyyy-mm-dd */
  date: string;
  name: string;
  /** HALF = bayram arifesi (afternoon only). */
  kind: PublicHolidayKind;
  source: string;
  sourceUrl: string;
  verifiedAt: string;
  verifiedBy: string;
}

export interface ExamEventDto {
  type: string;
  eventAt: string;
  source: string;
  sourceUrl: string;
  verifiedAt: string;
  verifiedBy: string;
}

/** Data-card payload for an exam calendar (backend-computed display fields). */
export interface ExamCalendarDto {
  exam: ExamSummaryDto;
  events: ExamEventDto[];
  /** Pre-formatted Turkish date label for EXAM_DATE, or null when missing. */
  examDateLabel: string | null;
  /** Days until EXAM_DATE (server-computed); null when no upcoming date. */
  daysRemaining: number | null;
  /** Today's or the nearest future verified calendar event. */
  nextEvent: ExamEventDto | null;
  /** UTC calendar days until nextEvent; null when no event remains. */
  daysUntilNextEvent: number | null;
}

export interface NetRuleDto {
  kind: string;
  divisor: number;
}

export interface InfoArticleSummaryDto {
  slug: string;
  title: string;
  family: string;
  category: string;
  metaTitle: string | null;
  publishedAt: string | null;
  source: string;
  sourceUrl: string;
  verifiedAt: string;
  verifiedBy: string;
  updatedAt: string;
  author: InfoArticleAuthorDto | null;
  coverImage: InfoArticleCoverImageDto | null;
}

export type InfoArticleBodyFormat = "MARKDOWN" | "HTML";

export interface InfoArticleAuthorDto {
  name: string;
  title: string | null;
  bio: string | null;
}

export interface InfoArticleCoverImageDto {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface ArticleImageUploadUrlDto {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresAt: string;
  maxBytes: number;
}

/** Full editorial article for detail/SEO (no embedding in API). */
export interface InfoArticleDto extends InfoArticleSummaryDto {
  body: string;
  bodyFormat: InfoArticleBodyFormat;
  galleryImages: InfoArticleCoverImageDto[];
  isFeatured: boolean;
  featuredUntil: string | null;
  metaDescription: string | null;
}

/** Subject in the exam taxonomy (editorial reference data). */
export interface ExamSubjectDto {
  slug: string;
  name: string;
  questionCount: number | null;
  sortOrder: number;
}

/**
 * Topic in the exam taxonomy, carrying its parent subject so a client can group or filter without
 * a second call. Public reference data, same as the subjects above — nothing user-scoped here.
 */
export interface ExamTopicDto {
  subjectSlug: string;
  subjectName: string;
  slug: string;
  name: string;
  sortOrder: number;
}
