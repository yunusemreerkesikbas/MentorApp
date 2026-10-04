import { getTranslations } from "next-intl/server";

import { ArticleMarkdown } from "@/components/article-markdown";
import type { LegalDoc } from "@/lib/legal";
import { LegalDraftNotice, LegalTranslationNotice } from "@/app/[locale]/legal/[slug]/_components/legal-notices";

export async function LegalDocumentView({ doc, locale }: { doc: LegalDoc; locale: string }) {
  const translate = await getTranslations("legal");
  const content = locale === "en" ? doc.en : doc.tr;
  const updated = new Date(doc.updatedAt).toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8 lg:py-10">
      <h1 className="text-3xl font-bold" style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}>{content.title}</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>{translate("last_updated", { date: updated })}</p>
      {doc.status !== "FINAL" ? <LegalDraftNotice /> : null}
      {locale === "en" ? <LegalTranslationNotice /> : null}
      <article className="mt-7"><ArticleMarkdown body={content.body} format="MARKDOWN" /></article>
    </main>
  );
}
