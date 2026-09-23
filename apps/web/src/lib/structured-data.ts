import type { InfoArticleDto, PublicQuestionView } from "@mentor/types";

interface ArticleStructuredDataInput {
  article: InfoArticleDto;
  canonical: string;
  siteOrigin: string;
  publisherLogoUrl: string;
}

export function buildArticleStructuredData({
  article,
  canonical,
  siteOrigin,
  publisherLogoUrl,
}: ArticleStructuredDataInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    url: canonical,
    headline: article.title,
    description: article.metaDescription ?? undefined,
    image: article.coverImage?.url,
    datePublished: article.publishedAt ?? undefined,
    dateModified: article.updatedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    inLanguage: "tr-TR",
    publisher: {
      "@type": "Organization",
      "@id": `${siteOrigin}/#organization`,
      name: "Mentor",
      url: siteOrigin,
      logo: { "@type": "ImageObject", url: publisherLogoUrl },
    },
    citation: article.sourceUrl,
    author: article.author
      ? { "@type": "Person", name: article.author.name }
      : undefined,
  };
}

interface BreadcrumbStructuredDataInput {
  homeName: string;
  homeUrl: string;
  /** Levels between home and the page (the Blog hub for an article); none for a forum question. */
  trail?: Array<{ name: string; url: string }>;
  pageName: string;
  pageUrl: string;
}

export function buildBreadcrumbStructuredData({
  homeName,
  homeUrl,
  trail = [],
  pageName,
  pageUrl,
}: BreadcrumbStructuredDataInput) {
  const items = [{ name: homeName, url: homeUrl }, ...trail, { name: pageName, url: pageUrl }];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function answerStructuredData(
  answer: PublicQuestionView["answers"][number],
  canonical: string,
) {
  return {
    "@type": "Answer",
    text: answer.body,
    dateCreated: answer.createdAt,
    url: `${canonical}#answer-${answer.id}`,
  };
}

export function buildQuestionStructuredData({
  question,
  canonical,
}: {
  question: PublicQuestionView;
  canonical: string;
}) {
  const accepted = question.answers.find((answer) => answer.isAccepted);
  const suggested = question.answers.filter((answer) => !answer.isAccepted);

  return {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: question.title,
      text: question.body,
      url: canonical,
      dateCreated: question.createdAt,
      answerCount: question.answers.length,
      ...(accepted
        ? { acceptedAnswer: answerStructuredData(accepted, canonical) }
        : {}),
      ...(suggested.length > 0
        ? {
            suggestedAnswer: suggested.map((answer) =>
              answerStructuredData(answer, canonical),
            ),
          }
        : {}),
    },
  };
}
