import { setRequestLocale } from "@/i18n/locale";
import { MessageShell } from "./_components/message-shell";

export default async function MessagePage({
  params,
}: {
  params: Promise<{ locale: string; threadId: string }>;
}) {
  const { locale, threadId } = await params;
  setRequestLocale(locale);
  return <MessageShell threadId={threadId} />;
}
