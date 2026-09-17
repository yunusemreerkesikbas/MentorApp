import { notFound } from "next/navigation";

import { LegalDocumentView } from "@/components/legal-document-view";
import { setRequestLocale } from "@/i18n/locale";
import { LEGAL_SLUGS, assertPublishable, getLegalDoc } from "@/lib/legal";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export default async function SettingsLegalPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const doc = getLegalDoc(slug);
  if (!doc) notFound();
  assertPublishable(doc);
  return <LegalDocumentView doc={doc} locale={locale} />;
}
