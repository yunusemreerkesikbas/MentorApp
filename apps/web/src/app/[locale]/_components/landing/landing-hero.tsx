"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Chip } from "@mentor/ui";

const primaryLinkClass =
  "flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none sm:w-fit";

const secondaryLinkClass =
  "flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none sm:w-fit";

/** Hero — companionship positioning, calm Nuton typography. */
export function LandingHero() {
  const t = useTranslations("landing.hero");

  return (
    <section className="flex flex-col gap-6 py-8 lg:py-12">
      <Chip>{t("chip")}</Chip>
      <h1
        className="text-4xl font-bold leading-tight lg:text-5xl"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {t("title")}
      </h1>
      <p
        className="max-w-xl text-lg leading-relaxed"
        style={{ color: "var(--color-secondary)" }}
      >
        {t("description")}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href="/kayit"
          className={primaryLinkClass}
          style={{
            backgroundColor: "var(--color-btn)",
            boxShadow: "var(--shadow-card)",
            fontFamily: "var(--font-body)",
          }}
        >
          {t("cta_start")}
        </Link>
        <Link
          href="/giris"
          className={secondaryLinkClass}
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
            boxShadow: "var(--shadow-card)",
            backgroundColor: "rgba(255,255,255,0.5)",
            border: "1px solid #ffffff",
          }}
        >
          {t("cta_login")}
        </Link>
      </div>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("tagline")}
      </p>
    </section>
  );
}
