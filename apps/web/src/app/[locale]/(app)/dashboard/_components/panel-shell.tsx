"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, BookOpen } from "lucide-react";
import type { PlanTaskDto, PlanTaskStatus, QuestProgressView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { CountdownCard } from "@mentor/ui";
import { EconomyQuestsCard } from "@/components/economy-quests-card";
import { FormError } from "@/components/form";
import { PromotionDialog } from "@/components/premium/promotion-dialog";
import { PuhuSpeechModal } from "@/components/puhu-speech-modal";
import { useStreakCelebration } from "@/components/streak-celebration";
import { StreakRescueSuccess } from "@/components/streak-rescue-success";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCloudTransitionReady } from "@/lib/cloud-transition";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorToast } from "@/lib/mentor-toast";
import { CommunityTopicsCard } from "./community-topics-card";
import { CountdownPlaceholder } from "./countdown-placeholder";
import { DailyQuestsCard } from "./daily-quests-card";
import { DashboardContentSkeleton, TodayPathSkeleton } from "./dashboard-content-skeleton";
import { GreetingRow } from "./greeting-row";
import { JourneyCard } from "./journey-card";
import { MembershipCard } from "./membership-card";
import { useMoodCheckin } from "./mood-checkin";
import { MyCoachCard } from "./my-coach-card";
import { PANEL_GRID_CLASS, PANEL_MAIN_CLASS } from "@/components/panel/panel-styles";
import { useWideLayout } from "@/components/panel/use-wide-layout";
import { TodayPathCard } from "./today-path-card";
import { usePanelData } from "./use-panel-data";
import { parseMockDays, useStreakRescue } from "./use-streak-rescue";
import { VisionBoardCard } from "./vision-board-card";
import { WeeklyRecapSlot } from "./weekly-recap-slot";

const REWARDED_QUEST_VISIBLE_REASONS = new Set([
  "ELIGIBLE",
  "COOLDOWN_ACTIVE",
  "DAILY_LIMIT_REACHED",
  "ACTIVE_SESSION_EXISTS",
]);

/** Panel (Anasayfa): "Bugün" hub. Orchestrates; the sections render themselves. */
export function PanelShell() {
  const { status } = useAuth();
  // The app shell renders `/dashboard` during the silent auth refresh (like `/plan`); only the
  // skeleton may paint then, everything below needs the providers mounted after auth.
  if (status === "loading") return <DashboardContentSkeleton />;
  return <PanelContent />;
}

function PanelContent() {
  const t = useTranslations("panel");
  const economyT = useTranslations("economy");
  const moodT = useTranslations("mood");
  const countdownT = useTranslations("countdown");
  const toast = useMentorToast();
  const sheet = useMentorBottomSheet();
  const searchParams = useSearchParams();
  const wide = useWideLayout();
  const { tryCelebrate, previewCelebrate, celebration } = useStreakCelebration();
  const panel = usePanelData();
  const { data, quests, rewardOffer, setRewardOffer, setRewardUnavailable } = panel;
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  // Coming out of onboarding, the clouds hold until the panel behind them is real.
  useCloudTransitionReady(!panel.loading);

  const showRewardedQuest = Boolean(
    rewardOffer && REWARDED_QUEST_VISIBLE_REASONS.has(rewardOffer.reason),
  );
  const openQuests = useCallback(
    (list: QuestProgressView[]) => {
      sheet.show({
        title: economyT("quests_title"),
        layout: "filter",
        size: "wide",
        bodyScroll: false,
        children: (
          <EconomyQuestsCard
            quests={list}
            onDismiss={sheet.dismissNow}
            rewardedAd={
              showRewardedQuest
                ? {
                    onCompleted: () => setRewardUnavailable(false),
                    onOfferChange: setRewardOffer,
                    onUnavailable: () => setRewardUnavailable(true),
                  }
                : undefined
            }
          />
        ),
      });
    },
    [economyT, setRewardOffer, setRewardUnavailable, sheet, showRewardedQuest],
  );
  const rescue = useStreakRescue(panel, openQuests);

  const moodCheckin = useMoodCheckin({
    initial: data?.mood ?? null,
    onSaved: () => void panel.refreshAfterProgress(),
  });

  // Dev/QA: `?mockStreakCelebration=7` opens the celebration without the once-per-day gate.
  const celebrationPreviewed = useRef(false);
  const currentStreak = data?.streak.currentStreak;
  useEffect(() => {
    if (celebrationPreviewed.current) return;
    const days = parseMockDays(searchParams.get("mockStreakCelebration"), currentStreak);
    if (days == null) return;
    celebrationPreviewed.current = true;
    previewCelebrate(days);
  }, [currentStreak, previewCelebrate, searchParams]);

  const setTaskStatus = async (task: PlanTaskDto, status: PlanTaskStatus) => {
    const streakBefore = currentStreak ?? 0;
    setBusyTaskId(task.id);
    try {
      await panel.setTaskStatus(task.id, status);
      if (status === "DONE") {
        toast.show({
          variant: "success",
          title: t("task_done_title"),
          message: t("task_done_message"),
        });
      }
      const next = await panel.refreshAfterProgress();
      if (status === "DONE" && next) tryCelebrate(streakBefore, next.streak.currentStreak);
    } catch (err) {
      toast.show({
        variant: "error",
        title: t("task_update_error_title"),
        message:
          err instanceof ApiClientError || err instanceof Error
            ? err.message
            : t("task_update_error_message"),
      });
    } finally {
      setBusyTaskId(null);
    }
  };

  const greeting = (
    <GreetingRow
      mood={moodCheckin.mood}
      busy={moodCheckin.busy}
      canLighten={data?.tasks.some((task) => task.status === "PENDING") ?? false}
      onPick={(value) => void moodCheckin.pickMood(value)}
    />
  );
  const hero = data ? (
    <TodayPathCard
      data={data}
      quests={quests}
      busyTaskId={busyTaskId}
      onSetStatus={(task, status) => void setTaskStatus(task, status)}
    />
  ) : panel.error ? (
    <div className="flex flex-col items-start gap-3">
      <FormError message={panel.error} />
      <button
        type="button"
        onClick={() => void panel.refreshToday()}
        className="min-h-11 text-sm font-extrabold text-[var(--play-selected-ink)] underline underline-offset-4"
      >
        {t("today_retry")}
      </button>
    </div>
  ) : (
    <TodayPathSkeleton />
  );
  const questsCard = (
    <DailyQuestsCard quests={quests} onOpenAll={() => openQuests(quests ?? [])} />
  );
  const membership = (
    <MembershipCard
      promotionOffers={panel.promotionOffers}
      rewardOffer={rewardOffer}
      rewardUnavailable={panel.rewardUnavailable}
      onOpenQuests={() => openQuests(quests ?? [])}
    />
  );
  const countdown = data ? (
    data.countdown ? (
      <CountdownCard
        daysRemaining={data.countdown.daysRemaining}
        examName={data.countdown.examName}
        examDateLabel={data.countdown.examDateLabel}
        labels={{
          remaining: countdownT("title"),
          dayUnit: countdownT("day_unit"),
          today: countdownT("today"),
        }}
      />
    ) : (
      <CountdownPlaceholder />
    )
  ) : null;
  const recap = data ? <WeeklyRecapSlot data={data} /> : null;
  const journey = <JourneyCard freezeTokens={data?.streak.freezeTokens ?? null} />;

  return (
    <main className={PANEL_MAIN_CLASS}>
      {wide ? (
        <div className={PANEL_GRID_CLASS}>
          <div className="flex min-w-0 flex-col gap-5">
            {greeting}
            {hero}
            {recap}
            <MyCoachCard />
            <CommunityTopicsCard />
          </div>
          <aside className="flex min-w-0 flex-col gap-5">
            {journey}
            {membership}
            {questsCard}
            {countdown}
            <VisionBoardCard />
          </aside>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-5">
          {greeting}
          {hero}
          {questsCard}
          {membership}
          {countdown}
          {recap}
          <MyCoachCard />
          <CommunityTopicsCard />
          <VisionBoardCard />
          {journey}
          <NotebooksLink />
        </div>
      )}

      <PromotionDialog />
      {celebration}
      {rescue.successDays != null ? (
        <StreakRescueSuccess days={rescue.successDays} onClose={rescue.closeSuccess} />
      ) : null}
      <PuhuSpeechModal
        isOpen={moodCheckin.speechModalOpen}
        onClose={moodCheckin.closeSpeechModal}
        isLoading={moodCheckin.speechLoading}
        loadingText={moodT("coach_thinking")}
        text={moodCheckin.speechText}
        actionLabel={moodT("coach_speech_cta")}
        closeAriaLabel={moodT("coach_close_aria")}
      />
    </main>
  );
}

/** Phones have no sidebar entry for notebooks; the panel keeps a way in. */
function NotebooksLink() {
  const t = useTranslations("panel");

  return (
    <Link
      href="/notebooks"
      className="flex min-h-11 items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-card)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] lg:hidden"
    >
      <BookOpen aria-hidden className="size-5 text-[var(--color-accent)]" />
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-[var(--color-main)]">
          {t("notebooks_quick_title")}
        </span>
        <span className="block text-sm text-[var(--color-secondary)]">
          {t("notebooks_quick_copy")}
        </span>
      </span>
      <ArrowRight aria-hidden className="size-4 shrink-0 text-[var(--color-secondary)]" />
    </Link>
  );
}
