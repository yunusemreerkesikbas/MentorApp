import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LEGAL_SLUGS, LEGAL_DOCUMENTS } from "@/lib/legal";

/**
 * Legal footer for PUBLIC surfaces only (landing, auth, knowledge, legal). The authenticated app
 * has its own bottom nav — a footer there would fight it, so it is mounted per-surface rather than
 * in the shared locale layout.
 *
 * Link labels come from the legal registry, not from i18n: the document titles already exist there
 * per locale, and duplicating them would let the two drift.
 */
export async function PublicFooter() {
  const translate = await getTranslations("legal");
  const locale = await getLocale();

  return (
    <footer
      className="border-t px-5 py-8 lg:px-8"
      style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 20%, transparent)" }}
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="text-sm font-bold" style={{ color: "var(--color-main)" }}>
          {translate("footer_heading")}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {LEGAL_SLUGS.map((slug) => (
            <li key={slug}>
              <Link
                href={{ pathname: "/legal/[slug]", params: { slug } }}
                className="text-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2"
                style={{ color: "var(--color-secondary)" }}
              >
                {locale === "en" ? LEGAL_DOCUMENTS[slug].en.title : LEGAL_DOCUMENTS[slug].tr.title}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/cookie-preferences"
              className="text-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2"
              style={{ color: "var(--color-secondary)" }}
            >
              {translate("footer_cookie")}
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
