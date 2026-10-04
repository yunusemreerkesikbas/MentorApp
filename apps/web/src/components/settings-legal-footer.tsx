"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { LEGAL_DOCUMENTS, LEGAL_SLUGS } from "@/lib/legal";

export function SettingsLegalFooter() {
  const locale = useLocale();
  const translate = useTranslations("legal");

  return (
    <footer className="mx-auto w-full max-w-6xl px-5 pb-8 lg:px-8 lg:pb-10" aria-label={translate("footer_heading")}>
      <div className="border-t border-[var(--color-border)] pt-4">
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--color-secondary)]">
          {LEGAL_SLUGS.map((slug) => (
            <li key={slug}>
              <Link href={{ pathname: "/settings/legal/[slug]", params: { slug } }} className="underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--color-main)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none">
                {locale === "en" ? LEGAL_DOCUMENTS[slug].en.title : LEGAL_DOCUMENTS[slug].tr.title}
              </Link>
            </li>
          ))}
          <li><Link href="/settings/cookie-preferences" className="underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--color-main)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none">{translate("footer_cookie")}</Link></li>
        </ul>
      </div>
    </footer>
  );
}
