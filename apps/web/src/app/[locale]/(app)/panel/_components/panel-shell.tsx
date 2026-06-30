"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type {
  EconomyBalance,
  PlanTaskDto,
  PlanTaskStatus,
  SessionPresetDto,
  TodayPanelResponse,
} from "@mentor/types";
import { ApiClientError, coachingControllerGetToday, planTaskControllerUpdate } from "@mentor/api-client";
import { CountdownCard } from "@mentor/ui";
import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  Coins,
  Flame,
  Gem,
  HeartPulse,
  Play,
  Snowflake,
} from "lucide-react";

import { PuhuImage } from "@/components/puhu-image";
import { Link } from "@/i18n/navigation";
import { fetchEconomyBalance, isEconomyDisabled } from "@/lib/economy";
import { FormError } from "@/components/form";
import { useMentorToast } from "@/lib/mentor-toast";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";

import { CommunityCard } from "./community-card";
import { CountdownPlaceholder } from "./countdown-placeholder";
import { MoodCheckin } from "./mood-checkin";
import { VisionBoardCard } from "./vision-board-card";

type PanelShellProps = {
  initialData?: TodayPanelResponse;
};

const completedStatuses: PlanTaskStatus[] = ["DONE"];

export function PanelShell({ initialData }: PanelShellProps) {
  const t = useTranslations("panel");
  const countdownT = useTranslations("countdown");
  const toast = useMentorToast();
  const shouldReduceMotion = useReducedMotion();
  const [data, setData] = useState<TodayPanelResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [economyBalance, setEconomyBalance] = useState<EconomyBalance | null>(null);
  const welcomeShownRef = useRef(false);

  const refreshToday = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await coachingControllerGetToday();
      const next = unwrapTodayResponse(response);
      setData(next);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : t("today_refresh_error");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let active = true;

    fetchEconomyBalance()
      .then((balance) => {
        if (active) {
          setEconomyBalance(balance);
        }
      })
      .catch((err: unknown) => {
        if (active && !isEconomyDisabled(err)) {
          setEconomyBalance(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (welcomeShownRef.current) return;
    welcomeShownRef.current = true;
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
              streakDays={data.streak.currentStreak}
              focusMinutes={data.sessionPresets[0]?.focusMinutes ?? 25}
            />
          </motion.div>

          <motion.div variants={staggerItemVariants}>
            <WeeklyStreakCard streakDays={data.streak.currentStreak} freezeCount={data.streak.freezeTokens} />
          </motion.div>

          <motion.div variants={staggerItemVariants}>
            <TodayFocusCard
              key={data.tasks.map((task) => `${task.id}:${task.status}`).join("|")}
              initialTasks={data.tasks}
              sessionPresets={data.sessionPresets}
              doneCount={doneCount}
              onTasksChanged={refreshToday}
            />
          </motion.div>

          <motion.div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]" variants={staggerItemVariants}>
            <MoodCheckin initial={data.mood} />
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
  streakDays,
  focusMinutes,
}: {
  tasks: PlanTaskDto[];
  mood: TodayPanelResponse["mood"];
  streakDays: number;
  focusMinutes: number;
}) {
  const t = useTranslations("panel");
  const doneCount = tasks.filter((task) => completedStatuses.includes(task.status)).length;
  const score = Math.min(99, 72 + (doneCount > 0 ? 8 : 0) + Math.min(streakDays, 5) + (mood?.mood ?? 2) * 2);

  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] bg-[linear-gradient(135deg,#8EA7FF_0%,#B9C8FF_54%,#EEF4FF_100%)] text-white shadow-[var(--shadow-card)]">
      <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_150px] sm:p-6">
        <div className="space-y-3">
          <p className="text-sm font-bold opacity-90">{t("rhythm_title")}</p>
          <div className="flex items-end gap-1">
            <span className="text-6xl font-bold leading-none">{score}</span>
            <span className="pb-2 text-lg font-bold opacity-90">{t("rhythm_score_suffix")}</span>
          </div>
          <p className="max-w-md text-sm font-semibold leading-6 opacity-90">{t("rhythm_copy")}</p>
        </div>

        <div className="mx-auto grid size-36 place-items-center rounded-full bg-white/30 p-3">
          <div className="relative grid size-28 place-items-center rounded-full bg-white shadow-[0_12px_30px_rgba(37,73,150,0.18)]">
            <CompletionRing value={score} />
            <PuhuImage variant="winking" size={54} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-white/40 bg-white text-[var(--color-main)] sm:grid-cols-4">
        <MetricTile label={t("metric_plan")} value={`${doneCount}/${tasks.length}`} icon={<BookOpen className="size-4" />} />
        <MetricTile label={t("metric_focus")} value={`${focusMinutes} dk`} icon={<Play className="size-4" />} />
        <MetricTile label={t("metric_mood")} value={mood ? t(`mood_${mood.mood}`) : t("metric_mood_empty")} icon={<HeartPulse className="size-4" />} />
        <MetricTile label={t("metric_streak")} value={`${streakDays} gün`} icon={<Flame className="size-4" />} />
      </div>
    </article>
  );
}

function CompletionRing({ value }: { value: number }) {
  return (
    <svg className="absolute inset-0 size-full rotate-[-90deg]" viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="44" fill="none" stroke="#E8EEFF" strokeWidth="9" />
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        pathLength={100}
        stroke="var(--color-progress)"
        strokeDasharray={`${value} ${100 - value}`}
        strokeLinecap="round"
        strokeWidth="9"
      />
    </svg>
  );
}

function MetricTile({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-white/70 px-4 py-4 sm:border-l first:sm:border-l-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-progress-track)_45%,white)] text-[var(--color-progress)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold text-[var(--color-secondary)]">{label}</span>
        <span className="block truncate text-base font-bold">{value}</span>
      </span>
    </div>
  );
}

function WeeklyStreakCard({ streakDays, freezeCount }: { streakDays: number; freezeCount: number }) {
  const t = useTranslations("panel");
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
          const isHot = isDone || isToday;
          return (
            <div key={day} className="grid justify-items-center gap-2">
              <span
                className={[
                  "grid size-8 place-items-center",
                  isHot ? "text-[#F97316]" : "text-transparent",
                ].join(" ")}
                aria-hidden
              >
                {isHot ? (
                  <Flame className="size-6 fill-[#F97316] stroke-[#F97316]" />
                ) : (
                  <span className="size-7 rounded-full bg-[#F3F5FA]" />
                )}
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

      <Link
        href="/seans"
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-btn)] px-4 text-sm font-bold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-progress)]"
      >
        {t("streak_grow")}
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
