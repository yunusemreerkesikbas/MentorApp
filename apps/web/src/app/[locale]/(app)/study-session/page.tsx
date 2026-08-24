import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { SessionContentSkeleton } from "./_components/session-content-skeleton";
import { StudySessionShell } from "./_components/study-session-shell";

export default async function StudySessionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<SessionContentSkeleton />}>
      <StudySessionShell />
    </Suspense>
  );
}
