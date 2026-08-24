import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/** `/seans/gecmis` folded into the session sidebar — keep the URL for old bookmarks. */
export default async function StudySessionGecmisPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect({ href: "/study-session", locale });
}
