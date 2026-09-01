import { setRequestLocale } from "@/i18n/locale";
import { QuestionShell } from "./_components/question-shell";

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ locale: string; threadId: string }>;
}) {
  const { locale, threadId } = await params;
  setRequestLocale(locale);
  return <QuestionShell threadId={threadId} />;
}
