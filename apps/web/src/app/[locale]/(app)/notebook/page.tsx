import { setRequestLocale } from "@/i18n/locale";
import { NotebookFocusReview } from "./_components/notebook-focus-review";
import { NotebookShell } from "./_components/notebook-shell";

/** Mistake notebook ("yanlış defteri") — its own route, reached from the nav. */
export default async function NotebookPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (await searchParams).review === "focus" ? <NotebookFocusReview /> : <NotebookShell />;
}
