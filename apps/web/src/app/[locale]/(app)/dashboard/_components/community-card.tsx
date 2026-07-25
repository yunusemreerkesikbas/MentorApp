"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PuhuImage } from "@/components/puhu-image";
import { isForumDisabled, listZones } from "@/lib/forum";
import { SoftPromoShell } from "./soft-promo-shell";

/**
 * Panel entry to the community — PromoSoft surface + Puhu (DESIGN.md §8.4).
 * Flag-aware: hidden when forum is off. Best-effort; never blocks the panel.
 */
export function CommunityCard() {
  const t = useTranslations("community");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    listZones()
      .then(() => active && setVisible(true))
      .catch((err: unknown) => {
        if (active && !isForumDisabled(err)) {
          setVisible(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (!visible) return null;

  return (
    <SoftPromoShell
      className="p-5 sm:p-6"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-progress-track) 68%, white)",
      }}
    >
      <span
        className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full opacity-50"
        style={{
          background:
            "color-mix(in srgb, var(--color-progress) 28%, transparent)",
        }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -bottom-12 left-1/3 size-28 rounded-full opacity-40"
        style={{ background: "color-mix(in srgb, #9BC1FB 35%, transparent)" }}
        aria-hidden
      />

      <div className="relative z-[1] grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0 max-w-md">
          <h2
            className="text-xl font-bold text-[var(--color-main)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("panel_card_title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-body)] text-pretty">
            {t("panel_card_desc")}
          </p>
          <Link
            href="/community"
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[var(--color-main)] shadow-[var(--shadow-card)] transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("panel_card_cta")}
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mx-auto grid place-items-center sm:mx-0 sm:justify-self-end">
          <PuhuImage variant="happy" size={96} className="drop-shadow-sm" />
        </div>
      </div>
    </SoftPromoShell>
  );
}
