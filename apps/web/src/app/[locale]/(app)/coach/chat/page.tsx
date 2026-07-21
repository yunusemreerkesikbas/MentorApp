import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { CoachChatShell } from "../_components/coach-chat-shell";
import { CoachChatSkeleton } from "../_components/coach-content-skeleton";

export default async function CoachChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<CoachChatSkeleton />}>
      <CoachChatShell />
    </Suspense>
  );
}
