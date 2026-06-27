import { setRequestLocale } from "next-intl/server";
import { WelcomeShell } from "./_components/welcome/welcome-shell";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WelcomeShell />;
}
