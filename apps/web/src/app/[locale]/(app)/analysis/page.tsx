import { setRequestLocale } from "@/i18n/locale";
import { AnalysisShell } from "./_components/analysis-shell";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AnalysisShell />;
}
