import { setRequestLocale } from "next-intl/server";
import { FeedShell } from "./_components/feed-shell";

export default async function FeedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FeedShell />;
}
