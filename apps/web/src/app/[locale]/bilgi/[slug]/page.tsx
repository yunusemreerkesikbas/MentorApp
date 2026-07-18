import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchInfoArticleBySlug, infoArticleUrl } from "@/lib/content-api";
import { siteUrl } from "@/lib/forum-public";
import { jsonLdHtml } from "@/lib/json-ld";
import { ArticleContent } from "./_components/article-content";
import { PublicArticleChrome } from "./_components/article-markdown";

export const revalidate = 3600;

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const article = await fetchInfoArticleBySlug(slug);
  if (!article) {
    const translate = await getTranslations("article");
    return { title: translate("not_found_title") };
  }
  const title = article.metaTitle ?? `${article.title} | Mentor Bilgi Merkezi`;
  const description = article.metaDescription ?? undefined;
  const canonical = infoArticleUrl(article.slug);
  const image = article.coverImage
    ? {
        url: article.coverImage.url,
        width: article.coverImage.width,
        height: article.coverImage.height,
        alt: article.coverImage.alt,
      }
    : undefined;
  return {
    title,
    description,
    alternates: { canonical },
    robots: locale === "en" ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      images: image ? [image] : undefined,
      publishedTime: article.publishedAt ?? undefined,
      modifiedTime: article.updatedAt,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image.url] : undefined,
    },
  };
}

export default async function PublicArticlePage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const article = await fetchInfoArticleBySlug(slug);
  if (!article) notFound();

  const verifiedLabel = new Date(article.verifiedAt).toLocaleDateString(
    locale,
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
  const publishedLabel = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const updatedLabel = new Date(article.updatedAt).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const translate = await getTranslations("article");
  const canonical = infoArticleUrl(article.slug);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription ?? undefined,
    image: article.coverImage?.url,
    datePublished: article.publishedAt ?? undefined,
    dateModified: article.updatedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    inLanguage: "tr-TR",
    publisher: { "@type": "Organization", name: "Mentor", url: siteUrl() },
    citation: article.sourceUrl,
    author: article.author
      ? { "@type": "Person", name: article.author.name }
      : undefined,
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: translate("back_home"), item: `${siteUrl()}/tr` },
      { "@type": "ListItem", position: 2, name: translate("back_knowledge"), item: `${siteUrl()}/tr/bilgi` },
      { "@type": "ListItem", position: 3, name: article.title, item: canonical },
    ],
  };

  return (
    <PublicArticleChrome>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd) }}
      />
      <ArticleContent
        article={article}
        verifiedLabel={verifiedLabel}
        publishedLabel={publishedLabel}
        updatedLabel={updatedLabel}
      />
    </PublicArticleChrome>
  );
}
