"use client";

import { useTranslations } from "next-intl";
import { Snowflake } from "lucide-react";
import { JourneyLevelCompact } from "@/components/journey-levels/journey-level-compact";
import { useEconomySnapshot } from "@/lib/economy-store";
import { PANEL_CARD, PANEL_CARD_TITLE } from "./panel-styles";

/**
 * "Yolculuğun": the level and the XP to the next one, plus the freezes that keep a missed day
 * kept. Reads the balance the app already holds (`EconomySync`), so it costs no request; with the
 * economy off there is no balance and the card is simply not there.
 */
export function JourneyCard({ freezeTokens }: { freezeTokens: number | null }) {
  const t = useTranslations("panel");
  const { balance } = useEconomySnapshot();
  if (!balance) return null;

  return (
    <section
      className={`${PANEL_CARD} flex flex-col gap-3`}
      aria-labelledby="journey-card-title"
    >
      <h2 id="journey-card-title" className={PANEL_CARD_TITLE}>
        {t("journey_title")}
      </h2>
      <JourneyLevelCompact level={balance.level} />
      {freezeTokens != null && freezeTokens > 0 ? (
        <p className="flex items-start gap-2 text-caption font-bold leading-snug text-[var(--play-selected-ink)]">
          <Snowflake className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("journey_freezes", { count: freezeTokens })}
        </p>
      ) : null}
    </section>
  );
}
