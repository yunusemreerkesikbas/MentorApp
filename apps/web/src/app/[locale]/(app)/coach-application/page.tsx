import { setRequestLocale } from "@/i18n/locale";
import { CoachApplicationShell } from "./_components/coach-application-shell";

export default async function CoachApplicationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CoachApplicationShell />;
}
