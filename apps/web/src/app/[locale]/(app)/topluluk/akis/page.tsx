import { setRequestLocale } from "next-intl/server";
import { AkisShell } from "./_components/akis-shell";

export default async function AkisPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AkisShell />;
}
