import { ApiClientError, http } from "@mentor/api-client";
import {
  BLOG_PAGE_SIZE,
  type ExamCalendarDto,
  type ExamType,
  type InfoArticleDto,
  type InfoArticleSummaryDto,
  type Paginated,
  type PublicHolidayDto,
} from "@mentor/types";
import { getApiBaseUrl } from "./env.js";
import { resolveContentMediaUrl } from "./knowledge-view.js";

function resolveSummaryMedia(article: InfoArticleSummaryDto): InfoArticleSummaryDto {
  const apiBase = getApiBaseUrl();
  return {
    ...article,
    coverImage: article.coverImage
      ? { ...article.coverImage, url: resolveContentMediaUrl(article.coverImage.url, apiBase) }
      : null,
  };
}

function resolveArticleMedia(article: InfoArticleDto): InfoArticleDto {
  const apiBase = getApiBaseUrl();
  return {
    ...article,
    ...resolveSummaryMedia(article),
    galleryImages: (article.galleryImages ?? []).map((img) => ({
      ...img,
      url: resolveContentMediaUrl(img.url, apiBase),
    })),
  };
}

export async function fetchExamCalendarByType(
  examType: ExamType,
  variant?: string | null,
): Promise<ExamCalendarDto | null> {
  const qs = variant ? `?variant=${encodeURIComponent(variant)}` : "";
  try {
    const res = await http<ExamCalendarDto | null>(
      `/v1/content/exams/by-type/${encodeURIComponent(examType)}/calendar${qs}`,
    );
    return res ?? null;
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function fetchFeaturedArticle(
  family: ExamType,
): Promise<InfoArticleSummaryDto | null> {
  try {
    const res = await http<InfoArticleSummaryDto | null>(
      `/v1/content/info-articles/featured?family=${encodeURIComponent(family)}`,
    );
    return res ? resolveSummaryMedia(res) : null;
  } catch (err) {
    if (err instanceof ApiClientError && (err.status === 404 || err.status === 204)) {
      return null;
    }
    throw err;
  }
}

export async function listInfoArticles(
  family?: string,
  page = 1,
  opts?: { category?: string; excludeSlug?: string; pageSize?: number },
): Promise<Paginated<InfoArticleSummaryDto>> {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(opts?.pageSize ?? BLOG_PAGE_SIZE),
  });
  if (family) qs.set("family", family);
  if (opts?.category) qs.set("category", opts.category);
  if (opts?.excludeSlug) qs.set("excludeSlug", opts.excludeSlug);

  const res = (await http<Paginated<InfoArticleSummaryDto>>(
    `/v1/content/info-articles?${qs.toString()}`,
  )) as Paginated<InfoArticleSummaryDto>;

  return {
    ...res,
    items: (res.items ?? []).map(resolveSummaryMedia),
  };
}

export async function getInfoArticleBySlug(
  slug: string,
): Promise<InfoArticleDto> {
  const res = (await http<InfoArticleDto>(
    `/v1/content/info-articles/${encodeURIComponent(slug)}`,
  )) as InfoArticleDto;
  return resolveArticleMedia(res);
}

export async function recordArticleView(slug: string): Promise<void> {
  try {
    await http<void>(
      `/v1/content/info-articles/${encodeURIComponent(slug)}/views`,
      { method: "POST" },
    );
  } catch {
    // View counter is best-effort and must never block reading.
  }
}

export async function listPublicHolidays(
  from: string,
  to: string,
): Promise<PublicHolidayDto[]> {
  const query = new URLSearchParams({ from, to });
  return (await http<PublicHolidayDto[]>(
    `/v1/content/holidays?${query.toString()}`,
  )) as PublicHolidayDto[];
}
