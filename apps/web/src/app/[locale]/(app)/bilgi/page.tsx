import { setRequestLocale } from "next-intl/server";
import { BilgiShell } from "./_components/bilgi-shell";

export default async function BilgiPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BilgiShell />;
}
