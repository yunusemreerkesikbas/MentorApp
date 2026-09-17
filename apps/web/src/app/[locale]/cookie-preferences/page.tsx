import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { CookiePreferencesContent } from "@/components/cookie-preferences-content";

export default async function CookiePreferencesPage() {
  const translate = await getTranslations("analyticsConsent");

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-2xl px-5 pt-8 lg:px-8"><Link href="/" className="text-sm font-semibold underline" style={{ color: "var(--color-accent)" }}>{translate("back")}</Link></div>
      <CookiePreferencesContent />
    </div>
  );
}
