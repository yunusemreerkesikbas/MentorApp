import { setRequestLocale } from "next-intl/server";
import { PlanShell } from "./_components/plan-shell";

export default async function PlanPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlanShell />;
}
