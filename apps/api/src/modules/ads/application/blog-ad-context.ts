import { BLOG_PAGE_SIZE, type ExamType, type InfoArticleSummaryDto } from "@mentor/types";
import type { AdBlogListContext } from "@mentor/validation";
import type { ContentService } from "../../content/application/content.service";

/** Public Content APIs own publication, filtering and featured-post selection. */
export async function resolveBlogAdContext(
  content: Pick<ContentService, "listInfoArticles" | "getFeaturedArticle">,
  query?: AdBlogListContext,
): Promise<{ verified: boolean; examType: ExamType | null }> {
  if (!query) return { verified: false, examType: null };
  const hasEditorialText = (article: InfoArticleSummaryDto) =>
    article.family === query.family &&
    (!query.category || article.category === query.category) &&
    Boolean(article.publishedAt && article.metaDescription?.trim());
  const list = await content.listInfoArticles({ ...query, pageSize: BLOG_PAGE_SIZE });
  let verified = list.items.some(hasEditorialText);
  // Featured content is excluded from the list, and appears only on page one in its own category.
  if (!verified && query.page === 1) {
    const featured = await content.getFeaturedArticle(query.family);
    verified = Boolean(featured && hasEditorialText(featured));
  }
  return { verified, examType: verified ? query.family : null };
}
