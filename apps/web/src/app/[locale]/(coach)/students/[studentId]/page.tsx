import { setRequestLocale } from "@/i18n/locale";
import { CoachPageTransition } from "../../_components/coach-page-transition";
import { StudentReportShell } from "./_components/student-report-shell";

export default async function CoachStudentPage({
  params,
}: {
  params: Promise<{ locale: string; studentId: string }>;
}) {
  const { locale, studentId } = await params;
  setRequestLocale(locale);
  // Keyed by the student, so "Sıradaki" is an exit and an enter, not an update in place.
  return (
    <CoachPageTransition key={studentId}>
      <StudentReportShell studentId={studentId} />
    </CoachPageTransition>
  );
}
