import { setRequestLocale } from "@/i18n/locale";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { fetchPublicQuestion, questionUrl, siteUrl } from "@/lib/forum-public";
import { jsonLdHtml } from "@/lib/json-ld";
import { buildQuestionStructuredData } from "@/lib/structured-data";

export const revalidate = 3600;

type PageProps = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const q = await fetchPublicQuestion(id);
  if (!q) return { title: "Mentor", robots: { index: false, follow: false } };
  const title = `${q.title} | Mentor Topluluk`;
  const description = q.body.replace(/\s+/g, " ").trim().slice(0, 155);
  const canonical = questionUrl(id);
  const fallbackImage = `${siteUrl()}/mascot/puhu/puhu-default.png`;
  return {
    title,
    description,
    // Only the Turkish page is indexed; EN canonicalizes to TR (content is Turkish).
    robots: { index: locale === "tr", follow: true },
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      siteName: "Mentor",
      locale: locale === "en" ? "en_US" : "tr_TR",
      images: [{ url: fallbackImage, alt: "Mentor" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [fallbackImage],
    },
  };
}

export default async function PublicQuestionPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const q = await fetchPublicQuestion(id);
  if (!q) notFound();

  const t = await getTranslations("community");
  const tAuth = await getTranslations("article");
  const jsonLd = buildQuestionStructuredData({
    question: q,
    canonical: questionUrl(id),
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />
      <header
        className="border-b px-5 py-4 lg:px-8"
        style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 20%, transparent)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            Mentor
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{ color: "var(--color-accent)", fontFamily: "var(--font-heading)" }}
          >
            {tAuth("login")}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8 lg:py-10">
        <article>
          <h1
            className="text-2xl font-bold lg:text-3xl"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {q.title}
          </h1>
          <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed" style={{ color: "var(--color-main)" }}>
            {q.body}
          </p>
        </article>

        <h2
          className="mt-8 mb-4 text-lg font-semibold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("answers_title")}
        </h2>
        <div className="flex flex-col gap-4">
          {q.answers.map((a) => (
            <div
              key={a.id}
              id={`answer-${a.id}`}
              className="rounded-[var(--radius-card)] border border-white p-6"
              style={{ backgroundColor: a.isAccepted ? "#ffffff" : "rgba(255,255,255,0.5)", boxShadow: "var(--shadow-card)" }}
            >
              {a.isAccepted ? (
                <p className="mb-2 text-sm font-semibold" style={{ color: "var(--color-progress)" }}>
                  ✓ {t("accepted")}
                </p>
              ) : null}
              <p className="whitespace-pre-wrap text-base" style={{ color: "var(--color-main)" }}>
                {a.body}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
