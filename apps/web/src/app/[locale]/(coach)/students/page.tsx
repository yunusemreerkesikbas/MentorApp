import { setRequestLocale } from "@/i18n/locale";
import { CoachPageTransition } from "../_components/coach-page-transition";
import { RosterShell } from "./_components/roster-shell";

export default async function CoachStudentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <CoachPageTransition>
      <RosterShell />
    </CoachPageTransition>
  );
}
