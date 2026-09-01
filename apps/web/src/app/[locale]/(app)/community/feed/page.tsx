import { setRequestLocale } from "@/i18n/locale";
import { Suspense } from "react";
import { FeedShell } from "./_components/feed-shell";

export default async function FeedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <FeedShell />
    </Suspense>
  );
}
