"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useTransition } from "react";

/**
 * Compact TR | EN language toggle.
 * Uses next-intl's router to switch locale while preserving the current path.
 */
export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [isPending, startTransition] = useTransition();

  function switchLocale(next: string) {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  const button = (loc: string, label: string) => (
    <button
      key={loc}
      type="button"
      onClick={() => switchLocale(loc)}
      disabled={isPending}
      aria-pressed={locale === loc}
      className="text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
      style={{
        color: locale === loc ? "var(--color-main)" : "var(--color-secondary)",
        fontFamily: "var(--font-heading)",
        fontWeight: locale === loc ? 700 : 400,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="flex items-center gap-1"
      aria-label={t("language_toggle_label")}
      role="group"
    >
      {button("tr", "TR")}
      <span style={{ color: "var(--color-secondary)" }} aria-hidden>|</span>
      {button("en", "EN")}
    </div>
  );
}
