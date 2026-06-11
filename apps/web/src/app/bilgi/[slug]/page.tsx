import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@mentor/ui";
import { fetchInfoArticleBySlug } from "../../../lib/content-api";
import { ArticleBackNav } from "./_components/article-back-nav";
import { ArticleMarkdown, PublicArticleChrome } from "./_components/article-markdown";
import { ArticleTrustFooter } from "./_components/article-trust-footer";

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
      <article className="mx-auto max-w-3xl px-5 py-8 lg:px-8 lg:py-10">
        <ArticleBackNav />

        <header className="mb-6">
          <h1
            className="text-2xl font-bold lg:text-3xl"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {article.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--color-secondary)" }}>
            Kaynak:{" "}
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
              style={{ color: "var(--color-secondary)" }}
            >
              {article.source} ↗
            </a>
            <span>· Son doğrulama: {verifiedLabel}</span>
          </div>
        </header>

        <Card solid>
          <ArticleMarkdown body={article.body} />
        </Card>

        <ArticleTrustFooter />
      </article>
    </PublicArticleChrome>
  );
}
