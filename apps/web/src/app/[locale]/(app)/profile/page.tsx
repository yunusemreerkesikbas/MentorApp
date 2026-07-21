import { setRequestLocale } from "next-intl/server";
import { ProfileShell } from "./_components/profile-shell";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProfileShell />;
}
