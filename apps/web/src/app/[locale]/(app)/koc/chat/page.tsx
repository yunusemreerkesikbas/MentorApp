import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { KocChatShell } from "../_components/koc-chat-shell";
import { KocChatSkeleton } from "../_components/koc-content-skeleton";

export default async function KocChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<KocChatSkeleton />}>
      <KocChatShell />
    </Suspense>
  );
}
