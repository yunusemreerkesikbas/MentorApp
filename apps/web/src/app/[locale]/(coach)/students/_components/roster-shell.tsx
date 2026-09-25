"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  MentorshipCoachOverviewDto,
  MentorshipInviteCodeDto,
  MentorshipRosterRowDto,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { PANEL_GRID_CLASS, PANEL_HERO, PANEL_MAIN_CLASS } from "@/components/panel/panel-styles";
import { useWideLayout } from "@/components/panel/use-wide-layout";
import { useAuth } from "@/lib/auth-context";
import { useCloudTransitionReady } from "@/lib/cloud-transition";
import { todayInIstanbul } from "@/lib/date-time";
import { firstName, greetingKeyForHour } from "@/lib/greeting";
import { useMentorToast } from "@/lib/mentor-toast";
import { fetchCoachRegistrationState, fetchOverview, fetchRoster, setAttention } from "@/lib/mentorship";
import { useSubscription } from "@/lib/subscription-context";
import { withAttention } from "../../_components/attention";
import { saveRoundOrder } from "../../_components/round-order";
import { CoachCommunityCard } from "./coach-community-card";
import { CoachCountdownCard } from "./coach-countdown-card";
import { CoachRoundCard, CoachRoundSkeleton } from "./coach-round-card";
import { buildCoachRound } from "./coach-round-model";
import { FollowupInboxCard } from "./followup-inbox-card";
import { inviteLockOf, type InviteLock } from "./invite-lock";
import { InviteSeatsCard } from "./invite-seats";
import { StudentsCard, type RosterTab } from "./students-card";
import { useCohortBrief } from "./use-cohort-brief";

type Rows = MentorshipRosterRowDto[];

/**
 * The coach's home (DESIGN.md §6.1): the round leads, the whole list follows, the standing facts
 * sit in the rail. The layout draws at once and each section shows its own skeleton; nothing waits
 * on a page gate. Two columns from 1280px, chosen in JS so DOM order is reading order: on a phone
 * the round, the follow-ups and the list come before seats, the exam and the forum.
 */
export function RosterShell() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const wide = useWideLayout();
  const { error: toastError } = useMentorToast();
  const { loading: subscriptionLoading } = useSubscription();
  const { user } = useAuth();
  const today = todayInIstanbul();
  const [tab, setTab] = useState<RosterTab>("ACTIVE");
  const [active, setActive] = useState<Rows | null>(null);
  const [activeFailed, setActiveFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [ended, setEnded] = useState<Rows | null>(null);
  /** The coach's marks, applied at once and kept apart from the rows as loaded (see `StudentsCard`). */
  const [marks, setMarks] = useState<Record<string, MentorshipRosterRowDto>>({});
  const [marking, setMarking] = useState<string | null>(null);
  const [overview, setOverview] = useState<MentorshipCoachOverviewDto | null>(null);
  const [overviewFailed, setOverviewFailed] = useState(false);
  const [overviewRevision, setOverviewRevision] = useState(0);
  const [inviteLock, setInviteLock] = useState<InviteLock>(null);

  const showError = useCallback(
    (err: unknown) =>
      toastError({
        title: common("error_title"),
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      }),
    [toastError, common],
  );

  useEffect(() => {
    let alive = true;
    fetchRoster("ACTIVE")
      .then((page) => {
        if (!alive) return;
        setActive(page.items);
        setActiveFailed(false);
      })
      .catch(() => {
        if (alive) setActiveFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    if (tab !== "ENDED" || ended !== null) return;
    let alive = true;
    fetchRoster("ENDED")
      .then((page) => alive && setEnded(page.items))
      .catch((err: unknown) => {
        if (!alive) return;
        setEnded([]);
        showError(err);
      });
    return () => {
      alive = false;
    };
  }, [tab, ended, showError]);

  useEffect(() => {
    let alive = true;
    // Two reads: the overview is the panel's own, the registration state belongs to the registry.
    fetchCoachRegistrationState()
      .then((state) => alive && setInviteLock(inviteLockOf(state)))
      .catch(() => {
        /* Unknown reason: the card keeps the plain "no code yet" copy rather than guess a lock. */
      });
    fetchOverview()
      .then((next) => {
        if (!alive) return;
        setOverview(next);
        setOverviewFailed(false);
      })
      .catch(() => {
        // The round is the screen; a missing seat card must not blank it, nor spin forever.
        if (alive) setOverviewFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [overviewRevision]);

  const retryOverview = useCallback(() => {
    setOverviewFailed(false);
    setOverviewRevision((value) => value + 1);
  }, []);

  const live = useCallback((row: MentorshipRosterRowDto) => marks[row.studentId] ?? row, [marks]);
  const round = useMemo(
    () => (active === null ? null : buildCoachRound(active.map(live), today)),
    [active, live, today],
  );
  const cohortBrief = useCohortBrief(round?.kind === "waiting");

  useCloudTransitionReady(active !== null || activeFailed);

  // The report's "Sıradaki" walks this order; a report opened any other way has none.
  useEffect(() => {
    if (!round || !active) return;
    const names = new Map(active.map((row) => [row.studentId, firstName(row.studentDisplayName)]));
    saveRoundOrder(round.order.map((studentId) => ({ studentId, name: names.get(studentId) ?? "" })));
  }, [round, active]);

  const mark = useCallback(
    async (studentId: string, attended: boolean) => {
      const base = active?.find((row) => row.studentId === studentId);
      if (!base) return;
      const previous = marks[studentId];
      setMarking(studentId);
      setMarks((prev) => ({ ...prev, [studentId]: withAttention(prev[studentId] ?? base, attended) }));
      try {
        await setAttention(studentId, attended);
      } catch (err) {
        setMarks((prev) => {
          const next = { ...prev };
          if (previous) next[studentId] = previous;
          else delete next[studentId];
          return next;
        });
        showError(err);
      } finally {
        setMarking(null);
      }
    },
    [active, marks, showError],
  );

  const onCode = useCallback(
    (inviteCode: MentorshipInviteCodeDto) =>
      setOverview((prev) => (prev ? { ...prev, inviteCode } : prev)),
    [],
  );

  const hero = activeFailed ? (
    <RosterError onRetry={() => setReload((value) => value + 1)} />
  ) : round && !subscriptionLoading ? (
    <CoachRoundCard
      round={round}
      today={today}
      brief={cohortBrief.brief}
      briefBusy={cohortBrief.busy}
      busyId={marking}
      onMark={(id, attended) => void mark(id, attended)}
      overview={overview}
      overviewFailed={overviewFailed}
      onRetryOverview={retryOverview}
      inviteLock={inviteLock}
      onCode={onCode}
    />
  ) : (
    <CoachRoundSkeleton />
  );
  const students = activeFailed ? null : (
    <StudentsCard
      tab={tab}
      onTab={setTab}
      rows={tab === "ACTIVE" ? active : ended}
      live={live}
      today={today}
      brief={cohortBrief.brief}
      busyId={marking}
      onMark={(id, attended) => void mark(id, attended)}
    />
  );
  const followups = <FollowupInboxCard />;
  // Before the first student the round IS the invitation; a second copy in the rail would repeat it.
  const seats =
    round?.kind === "empty" ? null : (
      <InviteSeatsCard
        overview={overview}
        inviteLock={inviteLock}
        onCode={onCode}
        failed={overviewFailed}
        onRetry={retryOverview}
      />
    );
  const countdown = <CoachCountdownCard examType={user?.examType ?? null} />;
  const community = <CoachCommunityCard />;

  return (
    <main className={PANEL_MAIN_CLASS}>
      <RosterGreeting name={firstName(user?.displayName ?? "")} />
      {wide ? (
        <div className={PANEL_GRID_CLASS}>
          <div className="flex min-w-0 flex-col gap-5">
            {hero}
            {students}
          </div>
          <aside className="flex min-w-0 flex-col gap-5" aria-label={t("roster_rail_label")}>
            {followups}
            {seats}
            {countdown}
            {community}
          </aside>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-5">
          {hero}
          {followups}
          {students}
          {seats}
          {countdown}
          {community}
        </div>
      )}
    </main>
  );
}

/** The page speaking, not a card. Phones already greet in the top bar, so there it is for readers only. */
function RosterGreeting({ name }: { name: string }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="min-w-0">
      <h1 className="sr-only text-display font-extrabold leading-tight tracking-[-0.01em] text-[var(--color-main)] lg:not-sr-only lg:truncate">
        {t(`roster_${greetingKeyForHour()}`, { name })}
      </h1>
      <p className="mt-1 hidden text-sm font-bold text-[var(--color-secondary)] lg:block">{date}</p>
    </div>
  );
}

/** The roster failed to load: said calmly in the hero's place, with the one thing to do about it. */
function RosterError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("mentorship");
  return (
    <section className={PANEL_HERO} role="alert">
      <p className="text-body-sm font-semibold text-[var(--color-body)]">{t("roster_load_failed")}</p>
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={onRetry}>
        {t("roster_retry")}
      </Button>
    </section>
  );
}
