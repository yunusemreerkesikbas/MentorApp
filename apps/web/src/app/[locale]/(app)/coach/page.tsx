import { setRequestLocale } from "next-intl/server";
import { CoachHub } from "./_components/coach-hub";

export default async function CoachPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CoachHub />;
}
