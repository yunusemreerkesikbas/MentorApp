import { setRequestLocale } from "@/i18n/locale";
import { SavedProfileRedirect } from "./_components/saved-profile-redirect";

export default async function SavedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SavedProfileRedirect />;
}
