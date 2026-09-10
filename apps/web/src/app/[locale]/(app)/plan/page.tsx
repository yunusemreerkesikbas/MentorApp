import { setRequestLocale } from "@/i18n/locale";
import { RoleAwarePlanShell } from "./_components/role-aware-plan-shell";

export default async function PlanPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RoleAwarePlanShell />;
}
