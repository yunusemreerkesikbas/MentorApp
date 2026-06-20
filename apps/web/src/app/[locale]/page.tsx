import { LandingPage } from "./_components/landing/landing-page";
import { fetchInfoArticlesByFamily } from "@/lib/content-api";
// Metadata is handled by [locale]/layout.tsx generateMetadata (locale-aware).

/** KPSS seed articles for public editorial links on landing (exam-agnostic product, KPSS first seed). */
async function landingEditorialArticles() {
  try {
    const res = await fetchInfoArticlesByFamily("KPSS", 1, 3);
    return res.items;
  } catch {
    return [];
  }
}

export default async function Home() {
  const articles = await landingEditorialArticles();
  return <LandingPage articles={articles} />;
}
