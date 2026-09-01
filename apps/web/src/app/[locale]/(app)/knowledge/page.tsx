import { setRequestLocale } from "@/i18n/locale";
import { Suspense } from "react";
import { KnowledgeContentSkeleton } from "./_components/knowledge-content-skeleton";
import { KnowledgeShell } from "./_components/knowledge-shell";

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<KnowledgeContentSkeleton />}>
      <KnowledgeShell />
    </Suspense>
  );
}
