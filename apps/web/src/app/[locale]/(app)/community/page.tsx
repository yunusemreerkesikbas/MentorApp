import { setRequestLocale } from "next-intl/server";
import { GeneralFeed } from "./_components/general-feed";

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GeneralFeed />;
}
