import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/** `/coach` → new-chat landing on `/coach/chat` (history opens from the chat header). */
export default async function CoachPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect({ href: "/coach/chat", locale });
}
