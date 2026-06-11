/**
 * Content API contracts (W1 exam calendar) — shared by api and web.
 * Critical dates render as data cards verbatim (guardrail §4 #1).
 */

export interface ExamSummaryDto {
  slug: string;
  name: string;
  family: string;
  variant: string | null;
  isCurrent: boolean;
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
}

/** Full editorial article for detail/SEO (no embedding in API). */
export interface InfoArticleDto extends InfoArticleSummaryDto {
  body: string;
  metaDescription: string | null;
}
