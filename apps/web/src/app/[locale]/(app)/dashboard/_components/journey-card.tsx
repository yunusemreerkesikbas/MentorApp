"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { ChevronRight, Snowflake } from "lucide-react";
import type { JourneyLevelKey } from "@mentor/types";
import { JourneyLevelCompact } from "@/components/journey-levels/journey-level-compact";
import { JourneySpotlightScene } from "@/components/journey-levels/spotlight/journey-spotlight-scene";
import { useEconomySnapshot } from "@/lib/economy-store";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";

type LevelNameKey = `levels.${JourneyLevelKey}.name`;

/**
 * "Yolculuğun": the level and the XP to the next one, plus the freezes that keep a missed day
 * kept. Reads the balance the app already holds (`EconomySync`), so it costs no request; with the
 * economy off there is no balance and the card is simply not there.
 *
 * Tapping the level row opens the full-screen spotlight theatre (`JourneySpotlightScene`),
 * matching the community member profile interaction.
 */
export function JourneyCard({ freezeTokens }: { freezeTokens: number | null }) {
  const t = useTranslations("panel");
  const tJourney = useTranslations("journey_levels");
  const { balance } = useEconomySnapshot();
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  if (!balance) return null;

  const levelName = tJourney(`levels.${balance.level.key}.name` as LevelNameKey);

  return (
    <>
      <section
        className={`${PANEL_CARD} flex flex-col gap-3`}
        aria-labelledby="journey-card-title"
      >
        <h2 id="journey-card-title" className={PANEL_CARD_TITLE}>
          {t("journey_title")}
        </h2>
        <button
          type="button"
          onClick={() => setSpotlightOpen(true)}
          aria-label={tJourney("spotlight_open", { name: levelName })}
          className="group -m-2 flex flex-col gap-1.5 rounded-[var(--radius-card)] p-2 text-left cursor-pointer transition-colors duration-150 hover:bg-[var(--play-track)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <JourneyLevelCompact
            level={balance.level}
            trailing={
              <ChevronRight
                className="size-3.5 text-[var(--color-secondary)] opacity-50 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-[var(--color-main)]"
                aria-hidden
              />
            }
          />
        </button>
        {freezeTokens != null && freezeTokens > 0 ? (
          <p className="flex items-start gap-2 text-caption font-bold leading-snug text-[var(--play-selected-ink)]">
            <Snowflake className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("journey_freezes", { count: freezeTokens })}
          </p>
        ) : null}
      </section>

      <AnimatePresence>
        {spotlightOpen ? (
          <JourneySpotlightScene
            key="journey-spotlight"
            mode="replay"
            level={balance.level}
            onClose={() => setSpotlightOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
