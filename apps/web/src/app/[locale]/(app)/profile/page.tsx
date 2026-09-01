import { assertLocale } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  assertLocale(locale);
  redirect({ href: "/settings", locale });
}
