import { setRequestLocale } from "@/i18n/locale";
import { WeeklyRecapShell } from "./_components/weekly-recap-shell";

export default async function WeeklyRecapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WeeklyRecapShell />;
}
