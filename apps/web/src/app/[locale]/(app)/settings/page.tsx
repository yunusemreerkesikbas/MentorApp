import { setRequestLocale } from "@/i18n/locale";

import { ProfileShell } from "../profile/_components/profile-shell";

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const [{ locale }, { section }] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  return <ProfileShell openProfileEditor={section === "profile"} />;
}
