import { setRequestLocale } from "@/i18n/locale";
import { NotebookShell } from "../../notebook/_components/notebook-shell";

export default async function CustomNotebookPage({
  params,
}: {
  params: Promise<{ locale: string; notebookId: string }>;
}) {
  const { locale, notebookId } = await params;
  setRequestLocale(locale);
  return <NotebookShell notebookId={notebookId} />;
}
