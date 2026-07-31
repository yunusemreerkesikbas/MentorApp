import { setRequestLocale } from "next-intl/server";
import { HubShell } from "./_components/hub-shell";

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HubShell />;
}
