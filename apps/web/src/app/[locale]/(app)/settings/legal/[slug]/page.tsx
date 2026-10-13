import { notFound } from "next/navigation";

import { LegalDocumentView } from "@/components/legal-document-view";
import { setRequestLocale } from "@/i18n/locale";
import { assertPublishable, getLegalDoc } from "@/lib/legal";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export default async function SettingsLegalPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const doc = getLegalDoc(slug);
  if (!doc) notFound();
  assertPublishable(doc);
  return <LegalDocumentView doc={doc} locale={locale} />;
}
