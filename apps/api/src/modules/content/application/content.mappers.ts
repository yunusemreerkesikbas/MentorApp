import type {
  ExamCalendarDto,
  ExamEventDto,
  ExamSubjectDto,
  ExamSummaryDto,
  InfoArticleDto,
  InfoArticleSummaryDto,
  Paginated,
  PublicHolidayDto,
  PublicHolidayKind,
} from "@mentor/types";
import type { ExamEventRow, ExamRow } from "../infrastructure/exam.repository";
import type { PublicHolidayRow } from "../infrastructure/public-holiday.repository";
import type { InfoArticleRow } from "../infrastructure/info-article.repository";
import {
  daysBetween,
  formatTurkishDate,
  toIsoDate,
  todayIso,
} from "../domain/date.util";
import { selectNextEvent } from "../domain/calendar.util";

export function toExamSummary(row: ExamRow): ExamSummaryDto {
  return {
    id: row.id,
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

export function toPublicHolidayDto(row: PublicHolidayRow): PublicHolidayDto {
  return {
    date: row.holidayDate,
    name: row.name,
    kind: row.kind as PublicHolidayKind,
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
  const nextEvent = selectNextEvent(events, today);
  const nextEventIso = nextEvent ? toIsoDate(nextEvent.eventAt) : null;
  return {
    exam: toExamSummary(exam),
    events: events.map(toExamEventDto),
    examDateLabel: examDateIso ? formatTurkishDate(examDateIso) : null,
    daysRemaining:
      examDateIso !== null
        ? Math.max(0, daysBetween(today, examDateIso))
        : null,
    nextEvent: nextEvent ? toExamEventDto(nextEvent) : null,
    daysUntilNextEvent: nextEventIso ? daysBetween(today, nextEventIso) : null,
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

export function toInfoArticleSummary(
  row: InfoArticleRow,
): InfoArticleSummaryDto {
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
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toInfoArticleDto(
  row: InfoArticleRow,
  coverImageUrl: string | null,
): InfoArticleDto {
  return {
    ...toInfoArticleSummary(row),
    body: row.body,
    bodyFormat: row.bodyFormat as InfoArticleDto["bodyFormat"],
    author: row.authorName
      ? { name: row.authorName, title: row.authorTitle, bio: row.authorBio }
      : null,
    coverImage:
      coverImageUrl &&
      row.coverImageAlt &&
      row.coverImageWidth &&
      row.coverImageHeight
        ? {
            url: coverImageUrl,
            alt: row.coverImageAlt,
            width: row.coverImageWidth,
            height: row.coverImageHeight,
          }
        : null,
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

export function toExamSubjectDto(row: {
  slug: string;
  name: string;
  questionCount: number | null;
  sortOrder: number;
}): ExamSubjectDto {
  return {
    slug: row.slug,
    name: row.name,
    questionCount: row.questionCount,
    sortOrder: row.sortOrder,
  };
}
