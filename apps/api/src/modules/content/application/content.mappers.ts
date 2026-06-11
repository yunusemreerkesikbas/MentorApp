import type {
  ExamCalendarDto,
  ExamEventDto,
  ExamSummaryDto,
  InfoArticleDto,
  InfoArticleSummaryDto,
  Paginated,
} from "@mentor/types";
import type { ExamEventRow, ExamRow } from "../infrastructure/exam.repository";
import type { InfoArticleRow } from "../infrastructure/info-article.repository";
import { daysBetween, formatTurkishDate, toIsoDate, todayIso } from "../domain/date.util";

export function toExamSummary(row: ExamRow): ExamSummaryDto {
  return {
    slug: row.slug,
    name: row.name,
    family: row.family,
    variant: row.variant,
    isCurrent: row.isCurrent,
  };
}

export function toExamEventDto(row: ExamEventRow): ExamEventDto {
  return {
    type: row.type,
    eventAt: row.eventAt.toISOString(),
    source: row.source,
    sourceUrl: row.sourceUrl,
    verifiedAt: row.verifiedAt.toISOString(),
    verifiedBy: row.verifiedBy,
  };
}

export function toExamCalendarDto(
  exam: ExamRow,
  events: ExamEventRow[],
  today: string = todayIso(),
): ExamCalendarDto {
  const examDateEvent = events.find((e) => e.type === "EXAM_DATE");
  const examDateIso = examDateEvent ? toIsoDate(examDateEvent.eventAt) : null;
  return {
    exam: toExamSummary(exam),
    events: events.map(toExamEventDto),
    examDateLabel: examDateIso ? formatTurkishDate(examDateIso) : null,
    daysRemaining:
      examDateIso !== null ? Math.max(0, daysBetween(today, examDateIso)) : null,
  };
}

export function toPaginatedExams(
  items: ExamRow[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<ExamSummaryDto> {
  return { items: items.map(toExamSummary), total, page, pageSize };
}

export function toInfoArticleSummary(row: InfoArticleRow): InfoArticleSummaryDto {
  return {
    slug: row.slug,
    title: row.title,
    family: row.family,
    category: row.category,
    metaTitle: row.metaTitle,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    source: row.source,
    sourceUrl: row.sourceUrl,
    verifiedAt: row.verifiedAt.toISOString(),
    verifiedBy: row.verifiedBy,
  };
}

export function toInfoArticleDto(row: InfoArticleRow): InfoArticleDto {
  return {
    ...toInfoArticleSummary(row),
    body: row.body,
    metaDescription: row.metaDescription,
  };
}

export function toPaginatedInfoArticles(
  items: InfoArticleRow[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<InfoArticleSummaryDto> {
  return { items: items.map(toInfoArticleSummary), total, page, pageSize };
}
