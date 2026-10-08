"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import {
  LEDGE,
  LEDGE_FILLED,
  LEDGE_TEXT_LINK,
  PANEL_HERO,
  PANEL_HERO_TITLE,
} from "@/components/panel/panel-styles";
import { useFocusingNow } from "./community-presence";

/**
 * "Bugün aklında ne var?": Puhu's rule-based line, the screen's one ledge (share), asking a
 * question as the text link, and who is studying right now when the server has a number to say.
 */
export function HubHero({ quiet }: { quiet: boolean }) {
  const t = useTranslations("community");
  const focusingNow = useFocusingNow();

  return (
    <section className={PANEL_HERO} aria-labelledby="hub-hero-title">
      <CompanionBubble
        puhu={quiet ? "happy" : "encouraging"}
        text={t(quiet ? "hub_bubble_quiet" : "hub_bubble")}
      />
      <h2 id="hub-hero-title" className={PANEL_HERO_TITLE}>
        {t("hub_prompt")}
      </h2>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link
          href={{ pathname: "/community/feed", query: { compose: "post" } }}
          className={`${LEDGE} ${LEDGE_FILLED} w-full sm:w-auto`}
        >
          {t("hub_share")}
        </Link>
        <Link
          href={{ pathname: "/community/feed", query: { compose: "question" } }}
          className={LEDGE_TEXT_LINK}
        >
          {t("hub_ask")}
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
      {focusingNow ? (
        <p className="-mt-1 flex flex-wrap items-center gap-2 text-caption font-bold text-[var(--color-secondary)]">
          <span className="size-2 shrink-0 rounded-full bg-[var(--play-cta)]" aria-hidden />
          {t("hub_focusing_now", { count: focusingNow })}
          <span aria-hidden>·</span>
          <Link
            href="/study-session"
            className="inline-flex min-h-11 items-center font-extrabold text-[var(--play-selected-ink)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {t("hub_join_table")}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
