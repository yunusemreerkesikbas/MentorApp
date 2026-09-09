import { setRequestLocale } from "@/i18n/locale";
import { CoachProfileShell } from "./_components/coach-profile-shell";

/**
 * The coach's own profile — the two lines a student reads on the consent screen (APP-090).
 *
 * It used to live at `/koc-basvurusu` inside `(app)`, sharing a screen with the registration form.
 * That was right while a coach still walked the student surface; now that `(app)`'s ritual is
 * closed to them, the two halves split by who reaches them: the form stays there for somebody who
 * is not a coach yet, and the editor moved here, where the rest of a coach's world already is.
 */
export default async function CoachProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CoachProfileShell />;
}
