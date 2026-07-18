import type { InfoArticleDto, InfoArticleSummaryDto, Paginated } from "@mentor/types";
import { apiBaseUrl, resolveApiUrl } from "./api-base";
import { siteUrl } from "./forum-public";

export const publicApiBase = apiBaseUrl;

export function infoArticleUrl(slug: string): string {
  return `${siteUrl()}/tr/bilgi/${encodeURIComponent(slug)}`;
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
  const article = (await res.json()) as InfoArticleDto;
  const normalized = article.bodyFormat === "HTML"
    ? {
        ...article,
        body: article.body.replace(
          /(<img\b[^>]*\bsrc=")\/v1\//g,
          `$1${apiBaseUrl()}/v1/`,
        ),
      }
    : article;
  return normalized.coverImage
    ? {
        ...normalized,
        coverImage: {
          ...normalized.coverImage,
          url: resolveApiUrl(normalized.coverImage.url),
        },
      }
    : normalized;
}

export async function fetchInfoArticlesByFamily(
  family: string,
  page = 1,
  pageSize = 20,
  opts?: { revalidate?: number },
): Promise<Paginated<InfoArticleSummaryDto>> {
  const params = new URLSearchParams({
    family,
    page: String(page),
    pageSize: String(pageSize),
  });
  // Server callers (landing) pass revalidate for ISR; client callers (bilgi-shell,
  // per-user) keep no-store.
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
  return (await res.json()) as Paginated<InfoArticleSummaryDto>;
}
