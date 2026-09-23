import type { ExamType } from "@mentor/types";
import { getPathname } from "@/i18n/navigation";
import { ARTICLE_CATEGORIES, EXAM_FAMILIES, type ArticleCategory } from "@/lib/content-api";
import { siteUrl } from "@/lib/forum-public";
import { blogHref } from "./blog-href";

export const BLOG_PAGE_SIZE = 12;

export interface BlogQuery {
  family: ExamType;
  category: ArticleCategory | null;
  page: number;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** `?family=&category=&page=` from the URL; anything unknown falls back instead of failing the page. */
export function parseBlogQuery(params: RawSearchParams): BlogQuery {
  const family = first(params.family)?.toUpperCase();
  const category = first(params.category);
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    family: EXAM_FAMILIES.find((known) => known === family) ?? "KPSS",
    category: ARTICLE_CATEGORIES.find((known) => known === category) ?? null,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

export { blogHref };

/** Canonical hub URL: the family's list is the indexable page; topic and page are views of it. */
export function blogUrl(family: ExamType = "KPSS"): string {
  return `${siteUrl()}${getPathname({ locale: "tr", href: blogHref({ family }) })}`;
}

/**
 * Which calm message an empty list shows. Past page 1 it is always "this page is empty": the featured
 * post never counts in the list's `total`, so `total` cannot tell "past the end" from "no posts yet".
 */
export function emptyListKind(query: BlogQuery): "page" | "topic" | "family" {
  if (query.page > 1) return "page";
  return query.category ? "topic" : "family";
}

/** The list API always leaves the featured post out, so it heads page 1 whenever it fits the topic. */
export function showsFeatured(featured: { category: string } | null, query: BlogQuery): boolean {
  return (
    featured !== null &&
    query.page === 1 &&
    (query.category === null || featured.category === query.category)
  );
}
