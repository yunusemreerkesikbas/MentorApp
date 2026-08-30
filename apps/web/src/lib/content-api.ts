import type {
  ExamCalendarDto,
  ExamType,
  InfoArticleDto,
  InfoArticleSummaryDto,
  Paginated,
} from "@mentor/types";

import { getPathname } from "../i18n/navigation";

import { apiBaseUrl, resolveApiUrl } from "./api-base";
import { siteUrl } from "./forum-public";

export const publicApiBase = apiBaseUrl;

export const ARTICLE_CATEGORIES = [
  "APPLICATION",
  "EXAM_PROCESS",
  "GENERAL",
] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export const EXAM_FAMILIES: ExamType[] = ["KPSS", "YKS", "LGS"];

export function infoArticleUrl(slug: string): string {
  return `${siteUrl()}${getPathname({
    locale: "tr",
    href: {
      pathname: "/knowledge/[slug]",
      params: { slug },
    },
  })}`;
}

function resolveCover(
  image: InfoArticleSummaryDto["coverImage"],
): InfoArticleSummaryDto["coverImage"] {
  return image ? { ...image, url: resolveApiUrl(image.url) } : null;
}

function resolveArticle(article: InfoArticleDto): InfoArticleDto {
  const withBody =
    article.bodyFormat === "HTML"
      ? {
          ...article,
          body: article.body.replace(
            /(<img\b[^>]*\bsrc=")\/v1\//g,
            `$1${apiBaseUrl()}/v1/`,
          ),
        }
      : article;
  return {
    ...withBody,
    coverImage: resolveCover(withBody.coverImage),
    galleryImages: (withBody.galleryImages ?? []).map((image) => ({
      ...image,
      url: resolveApiUrl(image.url),
    })),
  };
}

function resolveSummary(article: InfoArticleSummaryDto): InfoArticleSummaryDto {
  return {
    ...article,
    coverImage: resolveCover(article.coverImage),
  };
}

export async function fetchInfoArticleBySlug(slug: string): Promise<InfoArticleDto | null> {
  const res = await fetch(
    `${publicApiBase()}/v1/content/info-articles/${encodeURIComponent(slug)}`,
    { next: { revalidate: 3600 } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Article fetch failed: ${res.status}`);
  }
  return resolveArticle((await res.json()) as InfoArticleDto);
}

export async function fetchInfoArticlesByFamily(
  family: string,
  page = 1,
  pageSize = 20,
  opts?: {
    revalidate?: number;
    category?: string;
    excludeSlug?: string;
  },
): Promise<Paginated<InfoArticleSummaryDto>> {
  const params = new URLSearchParams({
    family,
    page: String(page),
    pageSize: String(pageSize),
  });
  if (opts?.category) params.set("category", opts.category);
  if (opts?.excludeSlug) params.set("excludeSlug", opts.excludeSlug);
  const cacheInit: RequestInit =
    opts?.revalidate != null
      ? { next: { revalidate: opts.revalidate } }
      : { cache: "no-store" };
  const res = await fetch(
    `${publicApiBase()}/v1/content/info-articles?${params}`,
    cacheInit,
  );
  if (!res.ok) {
    throw new Error(`Article list fetch failed: ${res.status}`);
  }
  const pageData = (await res.json()) as Paginated<InfoArticleSummaryDto>;
  return { ...pageData, items: pageData.items.map(resolveSummary) };
}

export async function fetchFeaturedArticle(
  family: string,
  opts?: { revalidate?: number },
): Promise<InfoArticleSummaryDto | null> {
  const cacheInit: RequestInit =
    opts?.revalidate != null
      ? { next: { revalidate: opts.revalidate } }
      : { cache: "no-store" };
  const res = await fetch(
    `${publicApiBase()}/v1/content/info-articles/featured?family=${encodeURIComponent(family)}`,
    cacheInit,
  );
  if (res.status === 404 || res.status === 204) return null;
  if (!res.ok) {
    throw new Error(`Featured article fetch failed: ${res.status}`);
  }
  const payload = (await res.text()).trim();
  if (!payload || payload === "null") return null;
  return resolveSummary(JSON.parse(payload) as InfoArticleSummaryDto);
}

export async function fetchExamCalendarByFamily(
  family: string,
  opts?: { revalidate?: number },
): Promise<ExamCalendarDto | null> {
  const cacheInit: RequestInit =
    opts?.revalidate != null
      ? { next: { revalidate: opts.revalidate } }
      : { cache: "no-store" };
  const res = await fetch(
    `${publicApiBase()}/v1/content/exams/by-type/${encodeURIComponent(family)}/calendar`,
    cacheInit,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Calendar fetch failed: ${res.status}`);
  }
  return (await res.json()) as ExamCalendarDto | null;
}

export async function recordArticleView(slug: string): Promise<void> {
  try {
    await fetch(
      `${publicApiBase()}/v1/content/info-articles/${encodeURIComponent(slug)}/views`,
      { method: "POST" },
    );
  } catch {
    // ponytail: ranking increment is best-effort; a failed count must not block reading
  }
}
