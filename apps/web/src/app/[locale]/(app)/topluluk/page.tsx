import { setRequestLocale } from "next-intl/server";
import { ToplulukShell } from "./_components/topluluk-shell";

export default async function ToplulukPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ToplulukShell />;
}
