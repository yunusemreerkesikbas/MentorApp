import { setRequestLocale } from "@/i18n/locale";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { siteUrl } from "@/lib/forum-public";
import { LEGAL_SLUGS, assertPublishable, getLegalDoc } from "@/lib/legal";
import { PublicChrome } from "@/components/public-chrome";
import { PublicFooter } from "@/components/public-footer";
import { LegalDocumentView } from "@/components/legal-document-view";

export const revalidate = 3600;

type PageProps = { params: Promise<{ locale: string; slug: string }> };

/** Every document × locale is prerendered — which is also what runs `assertPublishable` at build. */
export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const doc = getLegalDoc(slug);
  if (!doc) return {};

  const content = locale === "en" ? doc.en : doc.tr;
  const canonical = `${siteUrl()}${getPathname({ locale: "tr", href: { pathname: "/legal/[slug]", params: { slug } } })}`;
  // Unapproved text must not be indexed; the EN rendering is a courtesy translation, so it stays
  // out of the index too (same rule the knowledge pages already apply).
  const noindex = doc.status !== "FINAL" || locale === "en";
  return {
    title: `${content.title} | Mentor`,
    alternates: { canonical },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

export default async function LegalPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  // Build-time guard: a FINAL document that still carries `{{` placeholders fails the build here.
  assertPublishable(doc);

  const chrome = await getTranslations("article");

  return (
    <PublicChrome
      loginLabel={chrome("login")}
      panelLabel={chrome("panel")}
      blogLabel={chrome("blog")}
    >
      <LegalDocumentView doc={doc} locale={locale} />
      <PublicFooter />
    </PublicChrome>
  );
}
