import { setRequestLocale } from "@/i18n/locale";
import { WeeklyReportPrintShell } from "./weekly-report-print-shell";

export default async function WeeklyReportPrintPage({
  params,
}: {
  params: Promise<{ locale: string; studentId: string; reportId: string }>;
}) {
  const { locale, studentId, reportId } = await params;
  setRequestLocale(locale);
  return <WeeklyReportPrintShell studentId={studentId} reportId={reportId} />;
}
