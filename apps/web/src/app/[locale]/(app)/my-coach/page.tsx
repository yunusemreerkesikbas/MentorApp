import { setRequestLocale } from "@/i18n/locale";
import { MyCoachShell } from "./_components/my-coach-shell";

export default async function MyCoachPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyCoachShell />;
}
