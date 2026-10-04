"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, ChevronRight } from "lucide-react";
import type {
  MentorshipCoachOverviewDto,
  MentorshipCohortBriefDto,
  MentorshipInviteCodeDto,
} from "@mentor/types";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import {
  LEDGE,
  LEDGE_FILLED,
  LEDGE_OUTLINE,
  LEDGE_TEXT_LINK,
  PANEL_HERO,
  PANEL_HERO_TITLE,
} from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { firstName } from "@/lib/greeting";
import { dativeOf } from "@/lib/turkish-case";
import { CountPop } from "../../_components/count-pop";
import type { CoachRound } from "./coach-round-model";
import { CoachRoundPath } from "./coach-round-path";
import type { InviteLock } from "./invite-lock";
import { InviteHero } from "./invite-seats";

const CELEBRATED_KEY = "mentor.coach-round-done";

/** The finish's small moment plays once a day, not on every visit to a finished round. */
function useRoundCelebration(complete: boolean, today: string): boolean {
  const [seenToday] = useState(() => {
    try {
      return window.localStorage.getItem(CELEBRATED_KEY) === today;
    } catch {
      return true;
    }
  });
  const celebrate = complete && !seenToday;
  useEffect(() => {
    if (!celebrate) return;
    try {
      window.localStorage.setItem(CELEBRATED_KEY, today);
    } catch {
      /* Private mode: the moment may replay; nothing else depends on it. */
    }
  }, [celebrate, today]);
  return celebrate;
}

/**
 * "Koçun turu", the coach home's hero (DESIGN.md §6.1): who waits today, drawn as the panel's
 * path, with one ledge to the next student. The assistant speaks for a coach whose plan includes it;
 * otherwise the rule line says the same thing without a label.
 */
export function CoachRoundCard({
  round,
  today,
  brief,
  briefBusy,
  busyId,
  onMark,
  overview,
  overviewFailed,
  onRetryOverview,
  inviteLock,
  onCode,
}: {
  round: CoachRound;
  today: string;
  brief: MentorshipCohortBriefDto | null;
  briefBusy: boolean;
  busyId: string | null;
  onMark: (studentId: string, attended: boolean) => void;
  overview: MentorshipCoachOverviewDto | null;
  overviewFailed: boolean;
  onRetryOverview: () => void;
  inviteLock: InviteLock;
  onCode: (code: MentorshipInviteCodeDto) => void;
}) {
  const t = useTranslations("mentorship");
  const celebrate = useRoundCelebration(round.kind === "complete", today);
  const next = round.next;
  const nextName = next ? firstName(next.studentDisplayName) : "";
  const nextFlag = round.nodes.find((node) => node.state === "current")?.flag ?? null;
  const ai = round.kind === "waiting" && !briefBusy && Boolean(brief?.overall);

  const line =
    round.kind === "waiting"
      ? briefBusy
        ? t("round_ai_busy")
        : ai
          ? brief!.overall
          : nextFlag
            ? t("round_line_next", {
                name: nextName,
                hint: t(`flag_${nextFlag}_hint`),
                action: t(`action_${nextFlag}`),
              })
            : t("round_line_next_plain", { name: nextName })
      : t(`round_line_${round.kind}`);

  return (
    <section
      className={`${PANEL_HERO} coach-reveal`}
      aria-labelledby="round-title"
      data-testid="coach-round"
    >
      <CompanionBubble
        puhu={round.kind === "complete" ? "happy" : "host"}
        text={line}
        aiLabel={ai ? t("round_ai_label") : null}
        busy={round.kind === "waiting" && briefBusy}
        reveal
      />
      <h2
        id="round-title"
        className={PANEL_HERO_TITLE}
        aria-label={
          round.kind === "waiting"
            ? t.markup("round_title_waiting", { count: round.waiting, n: (chunks) => chunks })
            : undefined
        }
      >
        {round.kind === "waiting"
          ? t.rich("round_title_waiting", {
              count: round.waiting,
              n: () => <CountPop value={round.waiting} />,
            })
          : t(`round_title_${round.kind}`)}
      </h2>

      {round.nodes.length > 0 ? (
        <CoachRoundPath round={round} busyId={busyId} celebrate={celebrate} onMark={onMark} />
      ) : null}

      {round.kind === "empty" ? (
        <InviteHero
          overview={overview}
          inviteLock={inviteLock}
          onCode={onCode}
          failed={overviewFailed}
          onRetry={onRetryOverview}
        />
      ) : (
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
          {next ? (
            <Link
              href={{ pathname: "/students/[studentId]", params: { studentId: next.studentId } }}
              transitionTypes={["nav-forward"]}
              className={`${LEDGE} ${LEDGE_FILLED}`}
            >
              {t("round_cta", { name: nextName, dative: dativeOf(nextName) })}
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          ) : (
            <Link href="/plan" className={`${LEDGE} ${LEDGE_OUTLINE}`}>
              <CalendarDays className="size-5" aria-hidden />
              {t("round_open_plan")}
            </Link>
          )}
          {round.kind !== "calm" ? (
            <a href="#ogrenciler" className={`${LEDGE_TEXT_LINK} self-center sm:ml-auto`}>
              {t("round_all_students")}
            </a>
          ) : null}
        </div>
      )}

      {round.kind !== "empty" && round.studiedToday > 0 ? (
        <p className="-mt-1 flex items-center gap-2 text-caption font-bold text-[var(--color-secondary)]">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--play-cta)]" />
          {t("round_studied_today", { count: round.studiedToday })}
        </p>
      ) : null}
    </section>
  );
}

/** The round's own loading shape: bubble, title, path, ledge; a status for screen readers. */
export function CoachRoundSkeleton() {
  const t = useTranslations("mentorship");
  return (
    <SkeletonGroup label={t("loading")} className={PANEL_HERO}>
      <div className="flex items-start gap-3 sm:gap-4">
        <Skeleton className="size-[72px] shrink-0 rounded-full" />
        <Skeleton className="h-16 flex-1 rounded-[var(--play-radius)]" />
      </div>
      <Skeleton className="h-7 w-64 rounded-[var(--radius-card)]" />
      <div className="flex gap-6 pt-6">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="size-14 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-14 w-56 rounded-[var(--play-radius)]" />
    </SkeletonGroup>
  );
}
