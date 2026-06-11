import type { InfoArticleDto, InfoArticleSummaryDto, Paginated } from "@mentor/types";

/** Strips a trailing /v1 — API paths include the prefix. */
export function publicApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return raw.replace(/\/v1\/?$/, "");
}

export async function fetchInfoArticleBySlug(slug: string): Promise<InfoArticleDto | null> {
  const res = await fetch(
    `${publicApiBase()}/v1/content/info-articles/${encodeURIComponent(slug)}`,
    { next: { revalidate: 300 } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Article fetch failed: ${res.status}`);
  }
  return (await res.json()) as InfoArticleDto;
}

export async function fetchInfoArticlesByFamily(
  family: string,
  page = 1,
  pageSize = 20,
): Promise<Paginated<InfoArticleSummaryDto>> {
  const params = new URLSearchParams({
    family,
    page: String(page),
    pageSize: String(pageSize),
  });
  const res = await fetch(`${publicApiBase()}/v1/content/info-articles?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Article list fetch failed: ${res.status}`);
  }
  return (await res.json()) as Paginated<InfoArticleSummaryDto>;
}
