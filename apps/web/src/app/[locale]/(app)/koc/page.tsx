import { setRequestLocale } from "next-intl/server";
import { KocHub } from "./_components/koc-hub";

export default async function KocPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <KocHub />;
}
