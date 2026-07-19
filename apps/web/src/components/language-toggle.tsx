"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useTransition } from "react";

/**
 * Compact TR | EN language toggle.
 * Uses next-intl's router to switch locale while preserving the current path.
 */
export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("nav");
  const [isPending, startTransition] = useTransition();

  function switchLocale(next: Locale) {
    startTransition(() => {
      const query = Object.fromEntries(searchParams.entries());
      const href =
        searchParams.size > 0 ? { pathname, query } : { pathname };
      // next-intl resolves this concrete runtime pathname; dynamic params are not available here.
      // @ts-expect-error -- locale switching intentionally passes the current concrete pathname.
      router.replace(href, { locale: next });
    });
  }

  const button = (loc: Locale, label: string) => (
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
