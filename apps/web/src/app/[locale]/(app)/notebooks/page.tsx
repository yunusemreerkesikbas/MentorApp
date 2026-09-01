import { setRequestLocale } from "@/i18n/locale";
import { NotebooksShell } from "./_components/notebooks-shell";

export default async function NotebooksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotebooksShell />;
}
