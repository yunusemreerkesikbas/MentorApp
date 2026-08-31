import { describe, expect, it } from "vitest";
import type { InfoArticleDto, PublicQuestionView } from "@mentor/types";
import {
  buildArticleStructuredData,
  buildBreadcrumbStructuredData,
  buildQuestionStructuredData,
} from "./structured-data";

const article: InfoArticleDto = {
  slug: "kpss-basvuru",
  title: "KPSS başvurusu nasıl yapılır?",
  family: "KPSS",
  category: "APPLICATION",
  metaTitle: null,
  metaDescription: "Doğrulanmış KPSS başvuru rehberi.",
  publishedAt: "2026-01-10T09:00:00.000Z",
  source: "ÖSYM",
  sourceUrl: "https://www.osym.gov.tr",
  verifiedAt: "2026-01-12T09:00:00.000Z",
  verifiedBy: "editor",
  updatedAt: "2026-01-12T09:00:00.000Z",
  author: { name: "Mentor Editör", title: null, bio: null },
  coverImage: {
    url: "https://cdn.example/kpss.webp",
    alt: "KPSS başvuru ekranı",
    width: 1200,
    height: 630,
  },
  body: "Başvuru rehberi",
  bodyFormat: "MARKDOWN",
  galleryImages: [],
  isFeatured: false,
  featuredUntil: null,
};

describe("structured data", () => {
  it("builds an article with a stable publisher identity and canonical URL", () => {
    expect(
      buildArticleStructuredData({
        article,
        canonical: "https://mentor.example/bilgi/kpss-basvuru",
        siteOrigin: "https://mentor.example",
        publisherLogoUrl: "https://mentor.example/mascot/puhu/puhu-default.png",
      }),
    ).toMatchObject({
      "@type": "Article",
      url: "https://mentor.example/bilgi/kpss-basvuru",
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": "https://mentor.example/bilgi/kpss-basvuru",
      },
      publisher: {
        "@type": "Organization",
        "@id": "https://mentor.example/#organization",
        name: "Mentor",
        url: "https://mentor.example",
        logo: {
          "@type": "ImageObject",
          url: "https://mentor.example/mascot/puhu/puhu-default.png",
        },
      },
    });
  });

  it("builds a two-level public breadcrumb without the protected knowledge hub", () => {
    expect(
      buildBreadcrumbStructuredData({
        homeName: "Mentor",
        homeUrl: "https://mentor.example",
        pageName: article.title,
        pageUrl: "https://mentor.example/bilgi/kpss-basvuru",
      }).itemListElement,
    ).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Mentor",
        item: "https://mentor.example",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: article.title,
        item: "https://mentor.example/bilgi/kpss-basvuru",
      },
    ]);
  });

  it("adds dates and stable anchors to QAPage answers without inventing authors", () => {
    const question: PublicQuestionView = {
      id: "question-1",
      title: "Deneme analizi nasıl yapılır?",
      body: "Yanlışlarımı nasıl sınıflandırmalıyım?",
      createdAt: "2026-02-01T10:00:00.000Z",
      answers: [
        {
          id: "answer-1",
          body: "Önce konu ve hata türüne göre ayır.",
          isAccepted: true,
          createdAt: "2026-02-02T10:00:00.000Z",
        },
      ],
    };

    const result = buildQuestionStructuredData({
      question,
      canonical: "https://mentor.example/forum/soru/question-1",
    });

    expect(result.mainEntity).toMatchObject({
      "@type": "Question",
      url: "https://mentor.example/forum/soru/question-1",
      dateCreated: "2026-02-01T10:00:00.000Z",
      acceptedAnswer: {
        "@type": "Answer",
        url: "https://mentor.example/forum/soru/question-1#answer-answer-1",
        dateCreated: "2026-02-02T10:00:00.000Z",
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/author/i);
  });
});
