import { setRequestLocale } from "next-intl/server";
import { KocShell } from "./_components/koc-shell";

export default async function KocPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <KocShell />;
}
