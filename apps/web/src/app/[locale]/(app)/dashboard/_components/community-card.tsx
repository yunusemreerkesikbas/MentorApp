"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { isForumDisabled, listZones } from "@/lib/forum";

/**
 * Panel entry to the community — flag-aware: probes the forum and renders nothing when
 * `forum.enabled` is off (mirrors the EconomySection probe). Best-effort; never blocks the panel.
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
          // transient error: stay hidden (the dedicated /community screen surfaces real errors)
          setVisible(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (!visible) return null;

  return (
    <Card>
      <h2
        className="text-lg font-semibold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {t("panel_card_title")}
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("panel_card_desc")}
      </p>
      <Link
        href="/community"
        className="mt-4 inline-flex min-h-[44px] items-center text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-body)" }}
      >
        {t("panel_card_cta")} →
      </Link>
    </Card>
  );
}
