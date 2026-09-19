import { CookiePreferencesContent } from "@/components/cookie-preferences-content";
import { setRequestLocale } from "@/i18n/locale";

export default async function SettingsCookiePreferencesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CookiePreferencesContent />;
}
