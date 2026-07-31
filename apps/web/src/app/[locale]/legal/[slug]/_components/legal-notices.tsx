import { getTranslations } from "next-intl/server";

/**
 * Draft banner. Rendered whenever a document's status is not FINAL, driven by the registry — not by
 * a prop a page could forget to pass. Paired with `robots: noindex`, so unapproved text is both
 * visibly marked and kept out of search.
 */
export async function LegalDraftNotice() {
  const translate = await getTranslations("legal");
  return (
    <div
      role="status"
      className="mt-5 rounded-[var(--radius-card)] px-4 py-3"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-warning, #F59E0B) 14%, transparent)",
        color: "var(--color-main)",
      }}
    >
      <p className="text-sm font-bold">{translate("draft_title")}</p>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--color-secondary)" }}>
        {translate("draft_body")}
      </p>
    </div>
  );
}

/** English pages are an informational courtesy — the Turkish document is the binding one. */
export async function LegalTranslationNotice() {
  const translate = await getTranslations("legal");
  return (
    <p
      className="mt-4 text-sm leading-relaxed"
      style={{ color: "var(--color-secondary)" }}
    >
      {translate("translation_notice")}
    </p>
  );
}
