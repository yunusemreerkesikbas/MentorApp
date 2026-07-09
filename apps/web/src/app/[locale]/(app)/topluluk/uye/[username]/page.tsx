import { setRequestLocale } from "next-intl/server";
import { ProfileShell } from "./_components/profile-shell";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale, username } = await params;
  setRequestLocale(locale);
  return <ProfileShell username={username} />;
}
