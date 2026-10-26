import { cache } from "react";
import type { ExamType } from "@mentor/types";
import { BLOG_PAGE_SIZE } from "@/lib/blog-url";
import { fetchFeaturedArticle, fetchInfoArticlesByFamily, type ArticleCategory } from "@/lib/content-api";

/** Share the same request-scoped result between the article list and the responsive ad rail. */
export const loadBlogPosts = cache(async (family: ExamType, category: ArticleCategory | null, page: number) => {
  const [featured, list] = await Promise.all([
    fetchFeaturedArticle(family, { revalidate: 300 }).catch(() => null),
    fetchInfoArticlesByFamily(family, page, BLOG_PAGE_SIZE, {
      category: category ?? undefined,
      revalidate: 300,
    }).catch(() => null),
  ]);
  return { featured, list };
});
