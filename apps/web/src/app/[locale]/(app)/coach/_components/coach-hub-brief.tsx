"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { DailyNextActionKind, TodayPanelResponse } from "@mentor/types";
import { coachingControllerGetToday } from "@mentor/api-client";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { CoachNextActionCard } from "@/components/coach-next-action-card";

interface CoachHubBriefProps {
  onLoaded?: (kind: DailyNextActionKind) => void;
}

/** Rule-based single next step from the existing daily panel endpoint. */
export function CoachHubBrief({ onLoaded }: CoachHubBriefProps) {
  const tCoach = useTranslations("coach");
  const [today, setToday] = useState<TodayPanelResponse | null | undefined>();

  useEffect(() => {
    let active = true;
    coachingControllerGetToday()
      .then((result) => {
        if (!active) return;
        const panel = result as unknown as TodayPanelResponse;
        setToday(panel);
        onLoaded?.(panel.nextAction.kind);
      })
      .catch(() => {
        if (active) setToday(null);
      });
    return () => {
      active = false;
    };
  }, [onLoaded]);

  if (today === undefined) {
    return (
      <SkeletonGroup label={tCoach("loading")}>
        <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
      </SkeletonGroup>
    );
  }

  if (!today) return null;

  return <CoachNextActionCard today={today} surface="coach" />;
}
