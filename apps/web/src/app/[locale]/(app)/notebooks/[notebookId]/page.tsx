import { setRequestLocale } from "@/i18n/locale";
import { NotebookShell } from "../../notebook/_components/notebook-shell";

export default async function CustomNotebookPage({
  params,
}: {
  params: Promise<{ locale: string; notebookId: string }>;
}) {
  const { locale, notebookId } = await params;
  setRequestLocale(locale);
  // Keyed by the notebook: its page cache, unsaved pages and editor state belong to that notebook
  // alone, and a shell reused for another one could show, then autosave, the wrong pages.
  return <NotebookShell key={notebookId} notebookId={notebookId} />;
}
