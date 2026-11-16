import { http } from "@mentor/api-client";
import type {
  ExamCalendarDto,
  ExamType,
  InfoArticleDto,
  InfoArticleSummaryDto,
  Paginated,
  PublicHolidayDto,
} from "@mentor/types";

export async function fetchExamCalendarByType(
  examType: ExamType,
  variant?: string | null,
): Promise<ExamCalendarDto | null> {
  try {
    const qs = variant ? `?variant=${encodeURIComponent(variant)}` : "";
    return (await http<ExamCalendarDto>(
      `/v1/content/exams/by-type/${encodeURIComponent(examType)}/calendar${qs}`,
    )) as ExamCalendarDto;
  } catch {
    return null;
  }
}

export async function listInfoArticles(
  family?: string,
  page = 1,
): Promise<Paginated<InfoArticleSummaryDto>> {
  const qs = new URLSearchParams({ page: String(page) });
  if (family) qs.set("family", family);
  return (await http<Paginated<InfoArticleSummaryDto>>(
    `/v1/content/info-articles?${qs.toString()}`,
  )) as Paginated<InfoArticleSummaryDto>;
}

export async function getInfoArticleBySlug(
  slug: string,
): Promise<InfoArticleDto> {
  return (await http<InfoArticleDto>(
    `/v1/content/info-articles/${encodeURIComponent(slug)}`,
  )) as InfoArticleDto;
}

export async function listPublicHolidays(from: string, to: string): Promise<PublicHolidayDto[]> {
  const query = new URLSearchParams({ from, to });
  return (await http<PublicHolidayDto[]>(`/v1/content/holidays?${query.toString()}`)) as PublicHolidayDto[];
}
