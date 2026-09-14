import { setRequestLocale } from "@/i18n/locale";
import { StudentReportShell } from "./_components/student-report-shell";

export default async function CoachStudentPage({
  params,
}: {
  params: Promise<{ locale: string; studentId: string }>;
}) {
  const { locale, studentId } = await params;
  setRequestLocale(locale);
  // Keyed: everything the shell holds (the report, the week's unsent drafts) belongs to one student.
  return <StudentReportShell key={studentId} studentId={studentId} />;
}
