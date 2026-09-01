import { setRequestLocale } from "@/i18n/locale";
import { TrendsShell } from "./_components/trends-shell";

export default async function TrendsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TrendsShell />;
}
