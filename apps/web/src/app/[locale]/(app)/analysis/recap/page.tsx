import { setRequestLocale } from "@/i18n/locale";
import { WeeklyRecapEntry } from "./_components/weekly-recap-entry";

export default async function WeeklyRecapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WeeklyRecapEntry />;
}
