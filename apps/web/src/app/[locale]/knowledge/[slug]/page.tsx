import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import {
  fetchExamCalendarByFamily,
  fetchInfoArticleBySlug,
  fetchInfoArticlesByFamily,
  infoArticleUrl,
} from "@/lib/content-api";
import { pickMessages } from "@/i18n/scoped-messages";
import { siteUrl } from "@/lib/forum-public";
import { jsonLdHtml } from "@/lib/json-ld";
import {
  buildArticleStructuredData,
  buildBreadcrumbStructuredData,
} from "@/lib/structured-data";
import { ArticleContent } from "./_components/article-content";
import { PublicChrome } from "@/components/public-chrome";
import { PublicFooter } from "@/components/public-footer";

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
  const origin = siteUrl();
  const fallbackImage = `${origin}/mascot/puhu/puhu-default.png`;
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
      siteName: "Mentor",
      locale: locale === "en" ? "en_US" : "tr_TR",
      images: image ? [image] : [{ url: fallbackImage, alt: "Mentor" }],
      publishedTime: article.publishedAt ?? undefined,
      modifiedTime: article.updatedAt,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: [image?.url ?? fallbackImage],
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
  const [translate, messages, relatedPage, calendar] = await Promise.all([
    getTranslations("article"),
    getMessages(),
    fetchInfoArticlesByFamily(article.family, 1, 4, {
      excludeSlug: article.slug,
      revalidate: 3600,
    }),
    fetchExamCalendarByFamily(article.family, { revalidate: 3600 }),
  ]);
  const sameCategory = relatedPage.items.filter(
    (item) => item.category === article.category,
  );
  const related = (sameCategory.length > 0 ? sameCategory : relatedPage.items).slice(
    0,
    3,
  );
  const canonical = infoArticleUrl(article.slug);

  const origin = siteUrl();
  const articleJsonLd = buildArticleStructuredData({
    article,
    canonical,
    siteOrigin: origin,
    publisherLogoUrl: `${origin}/mascot/puhu/puhu-default.png`,
  });
  const breadcrumbJsonLd = buildBreadcrumbStructuredData({
    homeName: "Mentor",
    homeUrl: origin,
    pageName: article.title,
    pageUrl: canonical,
  });

  return (
    <NextIntlClientProvider
      messages={pickMessages(messages, ["article", "knowledge", "ads"])}
    >
      <PublicChrome
        loginLabel={translate("login")}
        panelLabel={translate("panel")}
      >
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
          related={related}
          calendar={calendar}
          locale={locale}
          verifiedLabel={verifiedLabel}
          publishedLabel={publishedLabel}
          updatedLabel={updatedLabel}
        />
        <PublicFooter />
      </PublicChrome>
    </NextIntlClientProvider>
  );
}
