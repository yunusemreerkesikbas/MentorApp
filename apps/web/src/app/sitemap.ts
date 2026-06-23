import type { MetadataRoute } from "next";
import { fetchPublicQuestionRefs, questionUrl, siteUrl } from "@/lib/forum-public";

/** Sitemap: landing + indexable QA questions (TR canonical URLs). Best-effort if the API is down. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${siteUrl()}/tr`, changeFrequency: "weekly", priority: 1 },
  ];
  try {
    const refs = await fetchPublicQuestionRefs();
    for (const r of refs) {
      entries.push({
        url: questionUrl(r.id),
        lastModified: new Date(r.updatedAt),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    // API unreachable at build/revalidate → ship the landing entry only.
  }
  return entries;
}
