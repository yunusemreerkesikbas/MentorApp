import { setRequestLocale } from "next-intl/server";
import { ZoneShell } from "./_components/zone-shell";

export default async function ZonePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <ZoneShell slug={slug} />;
}
