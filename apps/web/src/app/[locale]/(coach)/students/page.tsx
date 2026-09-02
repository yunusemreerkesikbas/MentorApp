import { setRequestLocale } from "@/i18n/locale";
import { RosterShell } from "./_components/roster-shell";

export default async function CoachStudentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RosterShell />;
}
