import { setRequestLocale } from "next-intl/server";
import { LandingPage } from "./_components/landing/landing-page";
import { fetchInfoArticlesByFamily } from "@/lib/content-api";
// Metadata is handled by [locale]/layout.tsx generateMetadata (locale-aware).

export const revalidate = 3600;

/** KPSS seed articles for public editorial links on landing (exam-agnostic product, KPSS first seed). */
async function landingEditorialArticles() {
  try {
    const res = await fetchInfoArticlesByFamily("KPSS", 1, 3, {
      revalidate: 3600,
    });
    return res.items;
  } catch {
    return [];
  }
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const articles = await landingEditorialArticles();
  return <LandingPage articles={articles} />;
}
