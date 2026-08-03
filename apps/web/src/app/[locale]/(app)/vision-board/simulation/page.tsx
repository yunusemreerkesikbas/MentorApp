import { setRequestLocale } from "next-intl/server";
import { SimulationShell } from "./_components/simulation-shell";

export default async function PreferenceSimulationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ universityId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  return <SimulationShell universityId={query.universityId ?? ""} />;
}
