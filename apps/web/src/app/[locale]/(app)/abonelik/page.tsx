import { setRequestLocale } from "next-intl/server";
import { AbonelikShell } from "./_components/abonelik-shell";

export default async function AbonelikPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AbonelikShell />;
}
