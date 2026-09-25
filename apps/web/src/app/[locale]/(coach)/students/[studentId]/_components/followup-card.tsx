"use client";

import { ChevronRight, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CoachFollowups } from "@/components/mentorship/coach-followups-card";
import { FollowupPageState } from "@/components/mentorship/followup-page-state";
import { FollowupResponseTag } from "@/components/mentorship/followup-tags";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { useFollowupDue } from "../../../_components/followup-due";

/** The rail is a glance, not the history: two open records, then the panel. */
const RAIL_ITEMS = 2;

/**
 * "Takip" beside the student's week: the open records with where each one stands, and two ways
 * into the panel. Drawn only once the feature is known to be on, like the roster's inbox, so a coach
 * without it never sees a card flash in and vanish.
 */
export function FollowupCard({
  resource,
  onCreate,
  onOpenHistory,
}: {
  resource: CoachFollowups;
  onCreate: () => void;
  onOpenHistory: () => void;
}) {
  const t = useTranslations("mentorship");
  const due = useFollowupDue();
  if (resource.enabled !== true) return null;

  const total = resource.data?.total ?? 0;
  // ponytail: reads the page the history is on; a coach paging the panel sees the rail follow.
  const open = (resource.data?.items ?? []).filter((item) => item.status === "OPEN").slice(0, RAIL_ITEMS);

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-1`} aria-labelledby="followup-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="followup-title" className={PANEL_CARD_TITLE}>
          {t("followup_recent_title")}
        </h2>
        <button type="button" className={`${PANEL_TEXT_LINK} cursor-pointer`} onClick={onCreate}>
          <Plus className="size-4" aria-hidden />
          {t("followup_new")}
        </button>
      </div>
      <FollowupPageState loading={resource.loading} error={resource.error} retry={resource.reload}>
        {open.length === 0 ? (
          <p className="text-body-sm font-semibold text-[var(--color-body)]">
            {total > 0 ? t("followup_none_open") : t("followup_rail_empty")}
          </p>
        ) : (
          <ul className="flex flex-col">
            {open.map((item) => (
              <li key={item.id} className="border-t border-[var(--play-line)] first:border-t-0">
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="flex w-full cursor-pointer flex-col gap-1.5 rounded-[var(--radius-card)] py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <span className="text-sm font-extrabold leading-snug text-[var(--color-main)]">{item.title}</span>
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {item.sharedDecision !== null ? <FollowupResponseTag response={item.response} /> : null}
                    <span className="text-caption font-semibold text-[var(--color-secondary)]">
                      {due(item.followUpDate)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {total > 0 ? (
          <button type="button" className={`${PANEL_TEXT_LINK} cursor-pointer self-start`} onClick={onOpenHistory}>
            {t("followup_all", { count: total })}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        ) : null}
      </FollowupPageState>
    </section>
  );
}
