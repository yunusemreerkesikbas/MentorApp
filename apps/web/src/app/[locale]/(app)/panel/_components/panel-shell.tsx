"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type {
  EconomyBalance,
  PlanTaskDto,
  PlanTaskStatus,
  QuestProgressView,
  SessionPresetDto,
  StreakRescueView,
  TodayPanelResponse,
} from "@mentor/types";
import { ApiClientError, coachingControllerGetToday, planTaskControllerUpdate } from "@mentor/api-client";
import { CountdownCard } from "@mentor/ui";
import {
  BarChart3,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  Coins,
  Flame,
  Gem,
  HeartPulse,
  ListChecks,
  Play,
  Snowflake,
} from "lucide-react";

import { EconomyQuestsCard } from "@/components/economy-quests-card";
import { PuhuImage } from "@/components/puhu-image";
import { Link } from "@/i18n/navigation";
import {
  fetchEconomyBalance,
  fetchQuests,
  fetchStreakRescue,
  isEconomyDisabled,
  purchaseStreakRescue,
} from "@/lib/economy";
import {
  findNewlyCompletedQuests,
  formatRewardSummary,
} from "@/lib/economy-quest-utils";
import { FormError } from "@/components/form";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorToast } from "@/lib/mentor-toast";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";
import { useDailyGreeting } from "@/lib/use-daily-greeting";

import { CommunityCard } from "./community-card";
import { CountdownPlaceholder } from "./countdown-placeholder";
import { useMoodCheckin } from "./mood-checkin";
import { VisionBoardCard } from "./vision-board-card";

type PanelShellProps = {
  initialData?: TodayPanelResponse;
};

const completedStatuses: PlanTaskStatus[] = ["DONE"];

export function PanelShell({ initialData }: PanelShellProps) {
  const t = useTranslations("panel");
  const economyT = useTranslations("economy");
  const countdownT = useTranslations("countdown");
  const toast = useMentorToast();
  const shouldReduceMotion = useReducedMotion();
  const [data, setData] = useState<TodayPanelResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [economyBalance, setEconomyBalance] = useState<EconomyBalance | null>(null);
  const [streakRescue, setStreakRescue] = useState<StreakRescueView | null>(null);
  const [quests, setQuests] = useState<QuestProgressView[] | null>(null);
  const questsRef = useRef<QuestProgressView[] | null>(null);
  const WELCOME_TOAST_KEY = "mentor_panel_welcome_date";

  const refreshEconomyBalance = useCallback(async () => {
    try {
      setEconomyBalance(await fetchEconomyBalance());
    } catch (err) {
      if (!isEconomyDisabled(err)) {
        setEconomyBalance(null);
      }
    }
  }, []);

  // Best-effort: economy off / error → no rescue offer, card renders as before.
  const refreshStreakRescue = useCallback(async () => {
    try {
      setStreakRescue(await fetchStreakRescue());
    } catch {
      setStreakRescue(null);
    }
  }, []);

  const refreshQuests = useCallback(async (options?: { announceRewards?: boolean; refreshBalance?: boolean }) => {
    try {
      const nextQuests = await fetchQuests();
      const completedNow = options?.announceRewards
        ? findNewlyCompletedQuests(questsRef.current, nextQuests)
        : [];
      questsRef.current = nextQuests;
      setQuests(nextQuests);

      if (completedNow.length > 0) {
        const rewardSummary = formatRewardSummary(completedNow, economyT);
        if (!rewardSummary) return;
        toast.success({
          title:
            completedNow.length === 1
              ? t("quest_reward_single_title")
              : t("quest_reward_multi_title"),
          message: t("quest_reward_message", {
            reward: rewardSummary,
          }),
          duration: 3000,
        });
      }
    } catch {
      questsRef.current = null;
      setQuests(null);
    } finally {
      if (options?.refreshBalance) {
        await refreshEconomyBalance();
      }
    }
  }, [economyT, refreshEconomyBalance, t, toast]);

  const refreshToday = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await coachingControllerGetToday();
      const next = unwrapTodayResponse(response);
      setData(next);
      if (!opts?.silent) setError(null);
    } catch (err) {
      if (!opts?.silent) {
        const message =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : t("today_refresh_error");
        setError(message);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [t]);

  const refreshRitualAndRewards = useCallback(async () => {
    await refreshToday();
    await refreshQuests({ announceRewards: true, refreshBalance: true });
  }, [refreshQuests, refreshToday]);

  const handleStreakRescue = useCallback(async () => {
    try {
      await purchaseStreakRescue();
      setStreakRescue(null);
      toast.success({
        title: t("streak_rescue_success_title"),
        message: t("streak_rescue_success_message"),
        duration: 4000,
      });
      await refreshToday({ silent: true });
      await refreshEconomyBalance();
    } catch (err) {
      toast.error({
        title: t("streak_rescue_error_title"),
        message: err instanceof ApiClientError ? err.message : t("streak_rescue_error_message"),
      });
      await refreshStreakRescue();
    }
  }, [refreshEconomyBalance, refreshStreakRescue, refreshToday, t, toast]);

  const moodCheckin = useMoodCheckin({
    initial: data?.mood ?? null,
    onSaved: () => {
      void refreshRitualAndRewards();
    },
  });

  useEffect(() => {
    let active = true;

    fetchQuests()
      .then((nextQuests) => {
        if (!active) return null;
        questsRef.current = nextQuests;
        setQuests(nextQuests);
        return fetchEconomyBalance().catch(() => null);
      })
      .catch(() => {
        if (active) {
          questsRef.current = null;
          setQuests(null);
        }
        return fetchEconomyBalance().catch(() => null);
      })
      .then((balance) => {
        if (active && balance) {
          setEconomyBalance(balance);
        }
      });
    fetchStreakRescue()
      .then((state) => {
        if (active) setStreakRescue(state);
      })
      .catch(() => {
        if (active) setStreakRescue(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (sessionStorage.getItem(WELCOME_TOAST_KEY) === today) return;
    sessionStorage.setItem(WELCOME_TOAST_KEY, today);
    toast.show({
      variant: "info",
      title: t("welcome_toast_title"),
      message: t("welcome_toast_message"),
    });
  }, [t, toast]);

  useEffect(() => {
    if (initialData) return;
    let active = true;

    coachingControllerGetToday()
      .then((response) => {
        if (active) {
          setData(unwrapTodayResponse(response));
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message =
          err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : t("today_refresh_error");
        setError(message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [initialData, t]);

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState !== "visible") return;
      void refreshToday({ silent: true });
      void refreshQuests();
    }
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) refreshIfVisible();
    }
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [refreshToday, refreshQuests]);

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-4 sm:px-8 lg:px-10 lg:py-8">
        <PanelTopBar balance={economyBalance} />
        <p className="text-sm text-[var(--color-secondary)]">{t("loading")}</p>
        {error ? <FormError message={error} /> : null}
      </main>
    );
  }

  const doneCount = data.tasks.filter((task) => completedStatuses.includes(task.status)).length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-4 sm:px-8 lg:px-10 lg:py-8">
      <PanelTopBar balance={economyBalance} name={data.greetingName} />

      <motion.div
        className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.85fr)]"
        variants={staggerListVariants}
        initial={shouldReduceMotion ? false : "initial"}
        animate={shouldReduceMotion ? undefined : "animate"}
      >
        <section className="space-y-5">
          <motion.div variants={staggerItemVariants}>
            <DailyRhythmCard
              tasks={data.tasks}
              mood={data.mood}
              moodValue={moodCheckin.mood}
              streakDays={data.streak.currentStreak}
              focusMinutes={data.sessionPresets[0]?.focusMinutes ?? 25}
              onMoodClick={moodCheckin.openMoodDialog}
            />
          </motion.div>

          {quests ? (
            <motion.div variants={staggerItemVariants}>
              <PanelQuestBanner quests={quests} />
            </motion.div>
          ) : null}

          <motion.div variants={staggerItemVariants}>
            <WeeklyStreakCard
              streakDays={data.streak.currentStreak}
              freezeCount={data.streak.freezeTokens}
              rescue={streakRescue}
              onRescue={handleStreakRescue}
            />
          </motion.div>

          <motion.div variants={staggerItemVariants}>
            <TodayFocusCard
              key={data.tasks.map((task) => `${task.id}:${task.status}`).join("|")}
              initialTasks={data.tasks}
              sessionPresets={data.sessionPresets}
              doneCount={doneCount}
              onTasksChanged={refreshRitualAndRewards}
            />
          </motion.div>

          <motion.div variants={staggerItemVariants}>
            <CoachShortcutsCard />
          </motion.div>
        </section>

        <aside className="space-y-5">
          <motion.div variants={staggerItemVariants}>
            {data.countdown ? (
              <CountdownCard
                daysRemaining={data.countdown.daysRemaining}
                examName={data.countdown.examName}
                examDateLabel={data.countdown.examDateLabel}
                source={{ label: data.countdown.source, url: data.countdown.sourceUrl }}
                labels={{
                  remaining: countdownT("title"),
                  dayUnit: countdownT("day_unit"),
                  today: countdownT("today"),
                  sourcePrefix: countdownT("source_prefix"),
                }}
              />
            ) : (
              <CountdownPlaceholder />
            )}
          </motion.div>
          <motion.div variants={staggerItemVariants}>
            <VisionBoardCard />
          </motion.div>
          <motion.div variants={staggerItemVariants}>
            <CommunityCard />
          </motion.div>
        </aside>
      </motion.div>

      {loading ? <p className="sr-only">{t("loading")}</p> : null}
      {error ? <FormError message={error} /> : null}
    </main>
  );
}

function PanelQuestBanner({ quests }: { quests: QuestProgressView[] }) {
  const panelT = useTranslations("panel");
  const economyT = useTranslations("economy");
  const sheet = useMentorBottomSheet();
  const dailyQuests = quests.filter((quest) => quest.category === "daily_ritual");
  if (dailyQuests.length === 0) return null;

  const completed = dailyQuests.filter((quest) => quest.completed).length;
  const percent = Math.round((completed / dailyQuests.length) * 100);
  const nextQuest =
    dailyQuests.find((quest) => !quest.completed && quest.action) ??
    quests.find((quest) => quest.category === "onboarding" && !quest.completed && quest.action) ??
    null;

  function showQuests() {
    sheet.show({
      title: economyT("quests_title"),
      layout: "filter",
      bodyScroll: false,
      children: <EconomyQuestsCard quests={quests} onDismiss={sheet.dismissNow} />,
    });
  }

  return (
    <article className="rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
      <button
        type="button"
        aria-label={panelT("quests_banner_open")}
        className="flex min-h-12 w-full items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        onClick={showQuests}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-black/[0.04] text-[var(--color-main)]">
          <ListChecks className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase text-[var(--color-secondary)]">
            {economyT("quests_daily_section")}
          </span>
          <span className="mt-1 block truncate text-base font-extrabold text-[var(--color-main)]">
            {nextQuest?.title ?? panelT("quests_banner_done")}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-black/[0.04] px-3 py-1 text-xs font-extrabold tabular-nums text-[var(--color-secondary)]">
          {completed}/{dailyQuests.length}
        </span>
        <ArrowRight className="size-4 shrink-0 text-[var(--color-main)]" aria-hidden />
      </button>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-progress-track)]">
        <div
          className="h-full rounded-full bg-[var(--color-progress)] transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </article>
  );
}

function PanelTopBar({ balance, name }: { balance: EconomyBalance | null; name?: string }) {
  const t = useTranslations("panel");
  const title = name ? t(greetingKeyForHour(), { name }) : t("greeting_fallback");

  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius-card)] bg-white px-3 shadow-[var(--shadow-card)] sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-progress-track)_55%,white)]">
          <PuhuImage variant="happy" size={28} />
        </span>
        <p className="truncate text-lg font-bold text-[var(--color-main)]">{title}</p>
      </div>

      <div className="flex items-center gap-2">
        <EconomyPill balance={balance} />
      </div>
    </div>
  );
}

function EconomyPill({ balance }: { balance: EconomyBalance | null }) {
  const t = useTranslations("panel");
  const confirmed = balance?.coinConfirmed ?? 0;
  const xp = balance?.xp ?? 0;

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-xs font-bold text-[var(--color-main)] shadow-[0_3px_10px_rgba(37,73,150,0.08)]"
      aria-label={t("earned_rights_label")}
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--color-progress-track)_40%,white)] px-2 py-1">
        <Gem className="size-3.5 text-[var(--color-progress)]" aria-hidden />
        {formatCompact(confirmed)}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,#FCD34D_30%,white)] px-2 py-1">
        <Coins className="size-3.5 text-[#B7791F]" aria-hidden />
        {formatCompact(xp)}
      </span>
    </div>
  );
}

function DailyRhythmCard({
  tasks,
  mood,
  moodValue,
  streakDays,
  focusMinutes,
  onMoodClick,
}: {
  tasks: PlanTaskDto[];
  mood: TodayPanelResponse["mood"];
  moodValue: number | null;
  streakDays: number;
  focusMinutes: number;
  onMoodClick: () => void;
}) {
  const t = useTranslations("panel");
  // Premium: the coach's daily greeting (cached per user+day) replaces the static line;
  // free / error keeps the calm fallback copy.
  const dailyGreeting = useDailyGreeting();
  const doneCount = tasks.filter((task) => completedStatuses.includes(task.status)).length;
  const hasEffort = doneCount > 0 || streakDays > 0;
  const displayMood = moodValue ?? mood?.mood ?? null;

  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]">
      <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_120px] sm:p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--color-main)]">{t("rhythm_title")}</h2>
          <p className="max-w-md text-base leading-7 text-[var(--color-body)]">
            {dailyGreeting ?? t("rhythm_copy")}
          </p>
          {hasEffort ? (
            <p className="text-sm font-semibold text-[var(--color-secondary)]">
              {t("rhythm_summary", {
                done: doneCount,
                total: tasks.length,
                streak: streakDays,
              })}
            </p>
          ) : null}
        </div>

        <div className="mx-auto grid size-24 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-progress-track)_45%,white)]">
          <PuhuImage variant="winking" size={54} />
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-black/5 sm:grid-cols-4">
        <MetricTile label={t("metric_plan")} value={`${doneCount}/${tasks.length}`} icon={<BookOpen className="size-4" />} />
        <MetricTile
          label={t("metric_focus")}
          value={t("metric_focus_value", { minutes: focusMinutes })}
          icon={<Play className="size-4" />}
        />
        <MetricTile
          label={t("metric_mood")}
          value={displayMood != null ? t(`mood_${displayMood}`) : t("metric_mood_empty")}
          icon={<HeartPulse className="size-4" />}
          onClick={onMoodClick}
          actionLabel={t("metric_mood_action")}
        />
        <MetricTile
          label={t("metric_streak")}
          value={t("metric_streak_value", { count: streakDays })}
          icon={<Flame className="size-4 text-[var(--color-progress)]" />}
        />
      </div>
    </article>
  );
}

function MetricTile({
  label,
  value,
  icon,
  onClick,
  actionLabel,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-progress-track)_45%,white)] text-[var(--color-progress)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold text-[var(--color-secondary)]">{label}</span>
        <span className="block truncate text-base font-bold">{value}</span>
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={actionLabel ?? label}
        className="flex w-full items-center gap-3 border-black/5 px-4 py-4 text-left transition hover:bg-black/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus-ring)] sm:border-l first:sm:border-l-0"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 border-black/5 px-4 py-4 sm:border-l first:sm:border-l-0">
      {content}
    </div>
  );
}

function WeeklyStreakCard({
  streakDays,
  freezeCount,
  rescue,
  onRescue,
}: {
  streakDays: number;
  freezeCount: number;
  rescue: StreakRescueView | null;
  onRescue: () => Promise<void>;
}) {
  const t = useTranslations("panel");
  // Two-tap confirm: first tap arms ("emin misin?"), second tap spends. No extra dialog infra.
  const [rescueArmed, setRescueArmed] = useState(false);
  const [rescueBusy, setRescueBusy] = useState(false);
  const handleRescueClick = async () => {
    if (!rescueArmed) {
      setRescueArmed(true);
      return;
    }
    setRescueBusy(true);
    try {
      await onRescue();
    } finally {
      setRescueBusy(false);
      setRescueArmed(false);
    }
  };
  const days = [
    t("week_mon"),
    t("week_tue"),
    t("week_wed"),
    t("week_thu"),
    t("week_fri"),
    t("week_sat"),
    t("week_sun"),
  ];
  const completedCount = Math.min(Math.max(streakDays - 1, 0), 6);
  const todayIndex = Math.min(completedCount, 6);

  return (
    <article className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-main)]">{t("streak_title")}</h2>
          <p className="mt-1 text-sm text-[var(--color-secondary)]">{t("streak_helper")}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-progress-track)_45%,white)] px-3 py-1.5 text-xs font-bold text-[var(--color-progress)]">
          <Snowflake className="size-3.5" aria-hidden />
          {t("freeze_short", { count: freezeCount })}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const isDone = index < completedCount;
          const isToday = index === todayIndex;
          const showFlame = isDone || isToday;
          return (
            <div key={day} className="grid justify-items-center gap-2">
              <span
                className={[
                  "grid size-8 place-items-center rounded-full",
                  isDone
                    ? "bg-[var(--color-progress)]"
                    : isToday
                      ? "border-2 border-[var(--color-progress)] bg-[color-mix(in_srgb,var(--color-progress-track)_45%,white)]"
                      : "bg-[color-mix(in_srgb,var(--color-progress-track)_30%,white)]",
                ].join(" ")}
                aria-hidden
              >
                {showFlame ? (
                  <Flame
                    className={[
                      "size-5",
                      isDone
                        ? "fill-white stroke-white"
                        : "fill-[var(--color-progress)] stroke-[var(--color-progress)]",
                    ].join(" ")}
                  />
                ) : null}
              </span>
              <span
                className={[
                  "text-xs",
                  isToday ? "font-bold text-[var(--color-main)]" : "font-medium text-[var(--color-secondary)]",
                ].join(" ")}
              >
                {day}
              </span>
            </div>
          );
        })}
      </div>

      {rescue?.eligible ? (
        <div className="mt-4 rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-progress-track)_35%,white)] p-4">
          <p className="text-sm font-medium text-[var(--color-main)]">{t("streak_rescue_hint")}</p>
          {rescue.canAfford ? (
            <button
              type="button"
              onClick={() => void handleRescueClick()}
              disabled={rescueBusy}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-card)] bg-[var(--color-progress)] px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              <Snowflake className="size-4" aria-hidden />
              {rescueArmed
                ? t("streak_rescue_confirm", { cost: rescue.cost })
                : t("streak_rescue_cta", { cost: rescue.cost })}
            </button>
          ) : (
            <p className="mt-2 text-sm text-[var(--color-secondary)]">
              {t("streak_rescue_insufficient", { cost: rescue.cost })}
            </p>
          )}
        </div>
      ) : null}

      <Link
        href="/seans"
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] border border-black/10 bg-white px-4 text-sm font-bold text-[var(--color-main)] transition hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        {t("streak_session_cta")}
      </Link>
    </article>
  );
}

function TodayFocusCard({
  initialTasks,
  sessionPresets,
  doneCount,
  onTasksChanged,
}: {
  initialTasks: PlanTaskDto[];
  sessionPresets: SessionPresetDto[];
  doneCount: number;
  onTasksChanged: () => Promise<void>;
}) {
  const t = useTranslations("panel");
  const toast = useMentorToast();
  const [tasks, setTasks] = useState(initialTasks);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const totalCount = tasks.length;
  const firstTask = tasks[0] ?? null;
  const completion = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
  const activePreset = sessionPresets[0];

  const toggleTask = async (task: PlanTaskDto) => {
    const nextStatus: PlanTaskStatus = task.status === "DONE" ? "PENDING" : "DONE";
    const previousTasks = tasks;
    setPendingTaskId(task.id);
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item)));

    try {
      await planTaskControllerUpdate(task.id, { status: nextStatus });
      if (nextStatus === "DONE") {
        toast.show({
          variant: "success",
          title: t("task_done_title"),
          message: t("task_done_message"),
        });
      }
      await onTasksChanged();
    } catch (err) {
      setTasks(previousTasks);
      toast.show({
        variant: "error",
        title: t("task_update_error_title"),
        message:
          err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : t("task_update_error_message"),
      });
    } finally {
      setPendingTaskId(null);
    }
  };

  return (
    <article className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-main)]">{t("today_focus_title")}</h2>
          <p className="mt-1 text-sm text-[var(--color-secondary)]">
            {t("today_focus_progress", { done: doneCount, total: totalCount })}
          </p>
        </div>
        <Link className="text-sm font-bold text-[var(--color-main)] underline underline-offset-4" href="/plan">
          {t("plan_edit")}
        </Link>
      </div>

      <div className="mt-4 h-2 rounded-full bg-[var(--color-progress-track)]">
        <div
          className="h-full rounded-full bg-[var(--color-progress)] transition-[width]"
          style={{ width: `${completion}%` }}
        />
      </div>

      {firstTask ? (
        <button
          type="button"
          className="mt-4 flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-black/10 bg-white p-4 text-left transition hover:border-[var(--color-progress)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-progress)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pendingTaskId === firstTask.id}
          onClick={() => void toggleTask(firstTask)}
        >
          <span
            className={[
              "grid size-7 shrink-0 place-items-center rounded-md border",
              firstTask.status === "DONE" ? "border-[var(--color-progress)] bg-[var(--color-progress)] text-white" : "border-[var(--color-secondary)] bg-white",
            ].join(" ")}
            aria-hidden
          >
            {firstTask.status === "DONE" ? <Check className="size-4" /> : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-bold text-[var(--color-main)]">{firstTask.title}</span>
            {firstTask.subject ? (
              <span className="mt-1 inline-flex rounded-full bg-[color-mix(in_srgb,var(--color-progress-track)_45%,white)] px-2 py-0.5 text-xs font-bold text-[var(--color-progress)]">
                {firstTask.subject}
              </span>
            ) : null}
          </span>
        </button>
      ) : (
        <div className="mt-4 rounded-[var(--radius-card)] border border-dashed border-black/20 p-4 text-sm text-[var(--color-secondary)]">
          {t("today_focus_empty")}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {sessionPresets.slice(0, 2).map((preset) => (
          <span
            key={preset.id}
            className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-[var(--color-secondary)]"
          >
            {preset.focusMinutes} dk
          </span>
        ))}
      </div>

      <Link
        href="/seans"
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-card)] bg-[var(--color-btn)] px-4 text-base font-bold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-progress)]"
      >
        <Play className="size-4 fill-current" aria-hidden />
        {activePreset ? t("start_focus_with_minutes", { minutes: activePreset.focusMinutes }) : t("start_focus")}
      </Link>
    </article>
  );
}

function CoachShortcutsCard() {
  const t = useTranslations("panel");
  const tChat = useTranslations("coach_chat");
  const studySeed = encodeURIComponent(tChat("suggestion_1"));
  const shortcuts = [
    {
      href: `/koc/chat?seed=${studySeed}`,
      label: t("coach_shortcut_study"),
      icon: <Brain className="size-4" aria-hidden />,
    },
    { href: "/plan", label: t("coach_shortcut_plan"), icon: <CalendarDays className="size-4" aria-hidden /> },
    { href: "/analiz", label: t("coach_shortcut_analysis"), icon: <BarChart3 className="size-4" aria-hidden /> },
  ];

  return (
    <article className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-lg font-bold text-[var(--color-main)]">{t("coach_shortcuts_title")}</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--color-secondary)]">{t("coach_shortcuts_subtitle")}</p>
      <div className="mt-4 grid gap-2">
        {shortcuts.map((shortcut) => (
          <Link
            key={shortcut.label}
            href={shortcut.href}
            className="flex min-h-11 items-center gap-3 rounded-[var(--radius-card)] border border-black/10 px-3 text-sm font-bold text-[var(--color-main)] transition hover:border-[var(--color-progress)] hover:bg-[color-mix(in_srgb,var(--color-progress-track)_25%,white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-progress)]"
          >
            <span className="grid size-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-progress-track)_40%,white)] text-[var(--color-progress)]">
              {shortcut.icon}
            </span>
            {shortcut.label}
          </Link>
        ))}
      </div>
    </article>
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

function greetingKeyForHour(): "greeting_morning" | "greeting_day" | "greeting_evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "greeting_morning";
  if (hour < 18) return "greeting_day";
  return "greeting_evening";
}

function unwrapTodayResponse(response: unknown): TodayPanelResponse {
  return ((response as { data?: TodayPanelResponse }).data ?? response) as TodayPanelResponse;
}
