import { setRequestLocale } from "next-intl/server";
import { SavedProfileRedirect } from "./_components/saved-profile-redirect";

export default async function SavedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SavedProfileRedirect />;
}
