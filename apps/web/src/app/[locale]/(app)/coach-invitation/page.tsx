import { Suspense } from "react";
import { setRequestLocale } from "@/i18n/locale";
import { CoachInvitationShell } from "./_components/coach-invitation-shell";

export default async function CoachInvitationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // useSearchParams needs a Suspense boundary or the whole route opts out of static rendering.
  return (
    <Suspense>
      <CoachInvitationShell />
    </Suspense>
  );
}
