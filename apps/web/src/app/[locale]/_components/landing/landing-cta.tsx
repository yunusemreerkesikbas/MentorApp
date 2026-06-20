"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@mentor/ui";

/** Final CTA band before footer. */
export function LandingCtaBand() {
  const t = useTranslations("landing.cta");

  return (
    <section className="py-10 lg:py-14">
      <Card className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p
            className="text-xl font-bold"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {t("heading")}
          </p>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/kayit"
          className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none lg:w-auto"
          style={{
            backgroundColor: "var(--color-btn)",
            boxShadow: "var(--shadow-card)",
            fontFamily: "var(--font-body)",
          }}
        >
          {t("button")}
        </Link>
      </Card>
    </section>
  );
}

function LandingFooter() {
  const t = useTranslations("landing.footer");

  return (
    <footer
      className="border-t border-white py-8 text-center text-xs"
      style={{ color: "var(--color-secondary)" }}
    >
      <p>{t("disclaimer")}</p>
      <p className="mt-2">© {new Date().getFullYear()} Mentor</p>
    </footer>
  );
}

export function LandingFooterSection() {
  return <LandingFooter />;
}
