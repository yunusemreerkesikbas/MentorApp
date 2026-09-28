import { setRequestLocale } from "@/i18n/locale";
import { MyWeeklyReportShell } from "./my-weekly-report-shell";

export default async function MyWeeklyReportPage({
  params,
}: {
  params: Promise<{ locale: string; reportId: string }>;
}) {
  const { locale, reportId } = await params;
  setRequestLocale(locale);
  return <MyWeeklyReportShell reportId={reportId} />;
}
