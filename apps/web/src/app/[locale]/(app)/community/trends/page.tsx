import { setRequestLocale } from "next-intl/server";
import { TrendsShell } from "./_components/trends-shell";

export default async function TrendsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TrendsShell />;
}
