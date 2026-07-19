import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { fetchPublicQuestionRefs, questionUrl, siteUrl } from "@/lib/forum-public";
import { fetchInfoArticlesByFamily, infoArticleUrl } from "@/lib/content-api";

/** Sitemap: landing + indexable QA questions (TR canonical URLs). Best-effort if the API is down. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl()}${getPathname({ locale: "tr", href: "/" })}`,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
  try {
    const [questions, ...articlePages] = await Promise.allSettled([
      fetchPublicQuestionRefs(),
      ...["KPSS", "YKS", "LGS"].map((family) =>
        fetchInfoArticlesByFamily(family, 1, 100, { revalidate: 3600 }),
      ),
    ]);
    for (const r of questions.status === "fulfilled" ? questions.value : []) {
      entries.push({
        url: questionUrl(r.id),
        lastModified: new Date(r.updatedAt),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    for (const article of articlePages.flatMap((page) =>
      page.status === "fulfilled" ? page.value.items : [],
    )) {
      entries.push({
        url: infoArticleUrl(article.slug),
        lastModified: new Date(article.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  } catch {
    // Unexpected build-time failure → keep the always-valid landing entry.
  }
  return entries;
}
