import { setRequestLocale } from "next-intl/server";
import { NotebookShell } from "./_components/notebook-shell";

/** Mistake notebook ("yanlış defteri") — its own route, reached from the nav. */
export default async function NotebookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotebookShell />;
}
