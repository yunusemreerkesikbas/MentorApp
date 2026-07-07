import { setRequestLocale } from "next-intl/server";
import { SavedShell } from "./_components/saved-shell";

export default async function SavedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SavedShell />;
}
