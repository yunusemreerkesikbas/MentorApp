import { setRequestLocale } from "next-intl/server";
import { ProfilShell } from "./_components/profil-shell";

export default async function ProfilPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProfilShell />;
}
