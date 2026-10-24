"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { LEGAL_DOCUMENTS, LEGAL_SLUGS } from "@/lib/legal";

const LINK_CLASS =
  "rounded-sm underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--color-main)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";

/**
 * Legal links under the settings side column (cookie preferences live in the Uygulama card).
 * Items run inline with a `·` between them so the list wraps cleanly at the column's width.
 */
export function SettingsLegalFooter() {
  const locale = useLocale();
  const translate = useTranslations("legal");

  return (
    // A `nav`, not a `footer`: inside `<aside>` a footer loses its contentinfo landmark.
    <nav className="px-3" aria-label={translate("footer_heading")}>
      <ul className="flex flex-wrap gap-y-1.5 text-xs leading-5 text-[var(--color-secondary)]">
        {LEGAL_SLUGS.map((slug) => (
          <li key={slug}>
            <Link href={{ pathname: "/settings/legal/[slug]", params: { slug } }} className={LINK_CLASS}>
              {locale === "en" ? LEGAL_DOCUMENTS[slug].en.title : LEGAL_DOCUMENTS[slug].tr.title}
            </Link>
            <span aria-hidden className="mx-1.5">·</span>
          </li>
        ))}
        <li>
          <a href="/icon-credits.txt" target="_blank" rel="noreferrer" className={LINK_CLASS}>
            {translate("footer_icon_credits")}
          </a>
        </li>
      </ul>
    </nav>
  );
}
