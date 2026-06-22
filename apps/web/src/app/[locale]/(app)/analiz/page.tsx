import { setRequestLocale } from "next-intl/server";
import { AnalizShell } from "./_components/analiz-shell";

export default async function AnalizPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AnalizShell />;
}
