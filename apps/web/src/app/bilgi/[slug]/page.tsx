import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchInfoArticleBySlug } from "../../../lib/content-api";
import { ArticleContent } from "./_components/article-content";
import { PublicArticleChrome } from "./_components/article-markdown";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchInfoArticleBySlug(slug);
  if (!article) return { title: "Makale bulunamadı | Mentor" };
  const title = article.metaTitle ?? `${article.title} | Mentor Bilgi Merkezi`;
  const description = article.metaDescription ?? undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
  };
}

export default async function PublicArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await fetchInfoArticleBySlug(slug);
  if (!article) notFound();

  const verifiedLabel = new Date(article.verifiedAt).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    datePublished: article.publishedAt ?? undefined,
    dateModified: article.verifiedAt,
    author: { "@type": "Organization", name: article.source },
  };

  return (
    <PublicArticleChrome>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticleContent article={article} verifiedLabel={verifiedLabel} />
    </PublicArticleChrome>
  );
}
