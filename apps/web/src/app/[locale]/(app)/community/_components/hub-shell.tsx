"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ForumHubView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { trackCommunityEvent } from "@/lib/analytics";
import { getForumHub, isForumDisabled } from "@/lib/forum";
import {
  PANEL_CARD,
  PANEL_GRID_CLASS,
  PANEL_MAIN_CLASS,
  PANEL_QUIET_LINK,
} from "@/components/panel/panel-styles";
import { SessionBuddyCard } from "../../study-session/_components/session-buddy-card";
import { HubDiscussions } from "./hub-discussions";
import { HubHero } from "./hub-hero";
import { HubSupporters, HubTrends } from "./hub-rail";
import { HubRooms } from "./hub-rooms";
import { HubWaitingQuestions } from "./hub-waiting-questions";

type HubState =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; hub: ForumHubView };

/**
 * Keşfet, the community's home ("Bugün toplulukta"), on the panel's frame: the hero with the one
 * ledge, then waiting questions, where you left off and rooms; the rail holds the people beside
 * you. Every section loads on its own and stays out until it has something true to say.
 */
export function HubShell() {
  const t = useTranslations("community");
  const [state, setState] = useState<HubState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getForumHub()
      .then((hub) => {
        if (!active) return;
        setState({ status: "ready", hub });
        trackCommunityEvent("community_hub_view", { surface: "community" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isForumDisabled(error)) setState({ status: "disabled" });
        else {
          setState({
            status: "error",
            message: error instanceof ApiClientError ? error.body.message : t("error"),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [t]);

  if (state.status === "disabled" || state.status === "error") {
    return (
      <main className={PANEL_MAIN_CLASS}>
        <section className={`${PANEL_CARD} mx-auto mt-10 flex max-w-md flex-col items-center gap-2 text-center`}>
          <h1 className="text-xl font-extrabold text-[var(--color-main)]">
            {state.status === "disabled" ? t("soon_title") : t("hub_error_title")}
          </h1>
          <p className="text-body-sm font-semibold text-[var(--color-secondary)]">
            {state.status === "disabled" ? t("soon_desc") : state.message}
          </p>
          {state.status === "error" ? (
            <button type="button" className={PANEL_QUIET_LINK} onClick={() => window.location.reload()}>
              {t("refresh")}
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  const hub = state.status === "ready" ? state.hub : null;
  const quiet = hub !== null && !hub.featured && hub.continueDiscussions.length === 0;

  return (
    <main className={PANEL_MAIN_CLASS}>
      {/* Phones: the top bar names the place, so the heading stays for screen readers only. */}
      <h1 className="sr-only text-display font-extrabold tracking-[-0.01em] text-[var(--color-main)] lg:not-sr-only">
        {t("hub_today_title")}
      </h1>
      <div className={PANEL_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-5">
          <HubHero quiet={quiet} />
          <HubWaitingQuestions />
          {hub ? (
            <>
              <HubDiscussions hub={hub} />
              <HubRooms zones={hub.recommendedZones} />
            </>
          ) : (
            <SkeletonGroup label={t("loading")} className="flex flex-col gap-5">
              <Skeleton className="h-72 w-full rounded-[var(--radius-card)]" />
              <Skeleton className="h-40 w-full rounded-[var(--radius-card)]" />
            </SkeletonGroup>
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-5" aria-label={t("hub_rail_label")}>
          <SessionBuddyCard className={`${PANEL_CARD} flex flex-col gap-3`} partnerOnly />
          {hub ? <HubSupporters people={hub.supporters} /> : null}
          {hub ? <HubTrends tags={hub.trendingTags} /> : null}
        </aside>
      </div>
    </main>
  );
}
