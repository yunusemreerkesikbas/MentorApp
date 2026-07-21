import { setRequestLocale } from "next-intl/server";
import { KnowledgeShell } from "./_components/knowledge-shell";

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <KnowledgeShell />;
}
