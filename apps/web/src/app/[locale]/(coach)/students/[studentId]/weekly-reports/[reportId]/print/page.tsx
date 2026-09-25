import { setRequestLocale } from "@/i18n/locale";
import { COACH_PAGE_FRAME } from "../../../../../_components/coach-page-frame";
import { WeeklyReportPrintShell } from "./weekly-report-print-shell";

export default async function WeeklyReportPrintPage({
  params,
}: {
  params: Promise<{ locale: string; studentId: string; reportId: string }>;
}) {
  const { locale, studentId, reportId } = await params;
  setRequestLocale(locale);
  return (
    <div className={COACH_PAGE_FRAME}>
      <WeeklyReportPrintShell studentId={studentId} reportId={reportId} />
    </div>
  );
}
