"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type {
  AdRewardOfferView,
  PlanTaskDto,
  PlanTaskStatus,
  QuestProgressView,
  SessionPresetDto,
  StreakRescueView,
  TodayPanelResponse,
} from "@mentor/types";
import { AdPlacementId } from "@mentor/types";
import {
  ApiClientError,
  coachingControllerGetToday,
  planTaskControllerUpdate,
} from "@mentor/api-client";
import { Chip, CountdownCard } from "@mentor/ui";
import {
  ArrowRight,
  BookOpen,
  Check,
  HeartPulse,
  ListChecks,
  Play,
  Sparkles,
} from "lucide-react";

import { EconomyQuestsCard } from "@/components/economy-quests-card";
import { TopBanner, type TopBannerItem } from "@/components/top-banner";
import { CoachNextActionCard } from "@/components/coach-next-action-card";
import { PuhuImage } from "@/components/puhu-image";
import { WeeklyRecapTeaser } from "@/components/weekly-recap-teaser";
import { Link } from "@/i18n/navigation";
import {
  fetchQuests,
  fetchStreakRescue,
  notifyCoinCelebration,
  notifyEconomyChanged,
  purchaseStreakRescue,
} from "@/lib/economy";
import {
  findNewlyCompletedQuests,
  formatRewardSummary,
} from "@/lib/economy-quest-utils";
import { FormError } from "@/components/form";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";
import { fetchRewardOffer } from "@/lib/ads";
import { PremiumCampaignBanner } from "@/components/premium/premium-campaign-banner";
import { WelcomeGiftDialog } from "@/components/premium/welcome-gift-dialog";
import { PremiumLockNudge } from "@/components/premium/premium-lock-nudge";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { useDailyGreeting } from "@/lib/use-daily-greeting";
import { useStreakCelebration } from "@/components/streak-celebration";
import { StreakRescueSuccess } from "@/components/streak-rescue-success";
import {
  getWeeklyRecapTeaserState,
  type WeeklyRecapTeaserState,
} from "@/lib/weekly-recap";

import { CommunityCard } from "./community-card";
import { CountdownPlaceholder } from "./countdown-placeholder";
import { useMoodCheckin } from "./mood-checkin";
import { SoftPromoShell } from "./soft-promo-shell";
import { VisionBoardCard } from "./vision-board-card";
import {
  formatWeekdayShort,
  shiftDate,
  todayIso,
} from "@/app/[locale]/(app)/plan/_components/plan-utils";

type PanelShellProps = {
  initialData?: TodayPanelResponse;
};

const completedStatuses: PlanTaskStatus[] = ["DONE"];
const getWeeklyRecapServerSnapshot = (): WeeklyRecapTeaserState => "hidden";
const REWARDED_QUEST_VISIBLE_REASONS = new Set([
  "ELIGIBLE",
  "COOLDOWN_ACTIVE",
  "DAILY_LIMIT_REACHED",
  "ACTIVE_SESSION_EXISTS",
]);

function subscribeWeeklyRecapStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function PanelShell({ initialData }: PanelShellProps) {
  const t = useTranslations("panel");
  const economyT = useTranslations("economy");
  const adsT = useTranslations("ads");
  const countdownT = useTranslations("countdown");
  const toast = useMentorToast();
  const { promo } = useMentorDialog();
  const sheet = useMentorBottomSheet();
  const { tryCelebrate, previewCelebrate, celebration } =
    useStreakCelebration();
  const searchParams = useSearchParams();
  const mockCelebrationPreviewed = useRef(false);
  const [rescueSuccessOverride, setRescueSuccessDays] = useState<
    number | null
  >();
  const shouldReduceMotion = useReducedMotion();
  const [data, setData] = useState<TodayPanelResponse | null>(
    initialData ?? null,
  );
  const mockRescueSuccess = searchParams.get("mockStreakRescueSuccess");
  const parsedMockRescueDays = Number.parseInt(mockRescueSuccess ?? "", 10);
  const mockRescueSuccessDays =
    mockRescueSuccess != null &&
    mockRescueSuccess !== "" &&
    mockRescueSuccess !== "0" &&
    mockRescueSuccess !== "false"
      ? Number.isFinite(parsedMockRescueDays) && parsedMockRescueDays > 0
        ? parsedMockRescueDays
        : Math.max(data?.streak.currentStreak ?? 0, 1)
      : null;
  const rescueSuccessDays =
    rescueSuccessOverride === undefined
      ? mockRescueSuccessDays
      : rescueSuccessOverride;
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [streakRescue, setStreakRescue] = useState<StreakRescueView | null>(
    null,
  );
  const [quests, setQuests] = useState<QuestProgressView[] | null>(null);
  const [rewardOffer, setRewardOffer] = useState<AdRewardOfferView | null>(null);
  const [rewardUnavailable, setRewardUnavailable] = useState(false);
  const [openedWeeklyRecap, setOpenedWeeklyRecap] = useState<string | null>(
    null,
  );
  const questsRef = useRef<QuestProgressView[] | null>(null);
  const rescuePromptedForDateRef = useRef<string | null>(null);
  const WELCOME_TOAST_KEY = "mentor_panel_welcome_date";
  const STREAK_RESCUE_PROMPT_KEY = "mentor_streak_rescue_prompt";
  const weeklyRecapStartDate = data?.weeklyRecapPeriod?.startDate ?? null;
  const weeklyRecapStatus = data?.weeklyRecapPeriod?.status ?? null;
  const storedWeeklyRecapState = useSyncExternalStore(
    subscribeWeeklyRecapStorage,
    useCallback(
      () =>
        weeklyRecapStartDate != null && weeklyRecapStatus != null
          ? getWeeklyRecapTeaserState(
              window.localStorage,
              weeklyRecapStartDate,
              weeklyRecapStatus,
            )
          : "hidden",
      [weeklyRecapStartDate, weeklyRecapStatus],
    ),
    getWeeklyRecapServerSnapshot,
  );
  const weeklyRecapState =
    openedWeeklyRecap === weeklyRecapStartDate &&
    storedWeeklyRecapState === "new"
      ? "replay"
      : storedWeeklyRecapState;
  const showWeeklyRecap = weeklyRecapState !== "hidden";

  const refreshRewardOffer = useCallback(async () => {
    try {
      const offer = await fetchRewardOffer(AdPlacementId.DASHBOARD_REWARDED_COIN);
      setRewardOffer(offer);
      return offer;
    } catch {
      setRewardOffer(null);
      return null;
    }
  }, []);

  const handleRewardCompleted = useCallback((rewardCoin: number) => {
    setRewardUnavailable(false);
    toast.success({
      title: adsT("rewarded.success", { count: rewardCoin }),
      duration: 3000,
    });
  }, [adsT, toast]);
  const handleRewardUnavailable = useCallback(() => setRewardUnavailable(true), []);
  const handleRewardOfferChange = useCallback((offer: AdRewardOfferView) => {
    setRewardOffer(offer);
  }, []);
  const showRewardedQuest = Boolean(
    rewardOffer && REWARDED_QUEST_VISIBLE_REASONS.has(rewardOffer.reason),
  );

  const openQuestsSheet = useCallback(
    (list: QuestProgressView[]) => {
      sheet.show({
        title: economyT("quests_title"),
        layout: "filter",
        bodyScroll: false,
        children: (
          <EconomyQuestsCard
            quests={list}
            onDismiss={sheet.dismissNow}
            rewardedAd={
              showRewardedQuest
                ? {
                    onCompleted: handleRewardCompleted,
                    onOfferChange: handleRewardOfferChange,
                    onUnavailable: handleRewardUnavailable,
                  }
                : undefined
            }
          />
        ),
      });
    },
    [
      economyT,
      handleRewardCompleted,
      handleRewardOfferChange,
      handleRewardUnavailable,
      sheet,
      showRewardedQuest,
    ],
  );

  // Best-effort: economy off / error → no rescue modal.
  const refreshStreakRescue = useCallback(async () => {
    try {
      setStreakRescue(await fetchStreakRescue());
    } catch {
      setStreakRescue(null);
    }
  }, []);

  const refreshQuests = useCallback(
    async (options?: {
      announceRewards?: boolean;
      refreshBalance?: boolean;
    }) => {
      try {
        const nextQuests = await fetchQuests();
        const completedNow = options?.announceRewards
          ? findNewlyCompletedQuests(questsRef.current, nextQuests)
          : [];
        questsRef.current = nextQuests;
        setQuests(nextQuests);

        if (completedNow.length > 0) {
          const coinEarned = completedNow.reduce(
            (sum, quest) =>
              quest.rewardUnit === "COIN" ? sum + quest.rewardAmount : sum,
            0,
          );
          if (coinEarned > 0) {
            notifyCoinCelebration(coinEarned);
          }
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
          notifyEconomyChanged();
        }
      }
    },
    [economyT, t, toast],
  );

  const refreshToday = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const response = await coachingControllerGetToday();
        const next = unwrapTodayResponse(response);
        setData(next);
        if (!opts?.silent) setError(null);
        return next;
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
        return null;
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [t],
  );

  const refreshRitualAndRewards = useCallback(
    async (opts?: { celebrateStreakFrom?: number }) => {
      const next = await refreshToday();
      await refreshQuests({ announceRewards: true, refreshBalance: true });
      await refreshStreakRescue();
      if (opts?.celebrateStreakFrom != null && next) {
        tryCelebrate(opts.celebrateStreakFrom, next.streak.currentStreak);
      }
    },
    [refreshQuests, refreshStreakRescue, refreshToday, tryCelebrate],
  );

  const currentStreak = data?.streak.currentStreak;
  const handleStreakRescue = useCallback(async () => {
    try {
      await purchaseStreakRescue();
      setStreakRescue(null);
      const next = await refreshToday({ silent: true });
      notifyEconomyChanged();
      setRescueSuccessDays(
        Math.max(
          next?.streak.currentStreak ?? currentStreak ?? 1,
          1,
        ),
      );
    } catch (err) {
      toast.error({
        title: t("streak_rescue_error_title"),
        message:
          err instanceof ApiClientError
            ? err.message
            : t("streak_rescue_error_message"),
      });
      await refreshStreakRescue();
    }
  }, [currentStreak, refreshStreakRescue, refreshToday, t, toast]);

  const moodCheckin = useMoodCheckin({
    initial: data?.mood ?? null,
    onSaved: () => {
      void refreshRitualAndRewards();
    },
  });

  // Dev/QA: `?mockStreakCelebration=7` (or `1`) opens the celebration without the once-per-day gate.
  useEffect(() => {
    if (mockCelebrationPreviewed.current) return;
    const raw = searchParams.get("mockStreakCelebration");
    if (raw == null || raw === "" || raw === "0" || raw === "false") return;
    mockCelebrationPreviewed.current = true;
    const parsed = Number.parseInt(raw, 10);
    const days =
      Number.isFinite(parsed) && parsed > 0
        ? parsed
        : Math.max(data?.streak.currentStreak ?? 0, 1);
    previewCelebrate(days);
  }, [data?.streak.currentStreak, previewCelebrate, searchParams]);

  useEffect(() => {
    let active = true;

    fetchQuests()
      .then((nextQuests) => {
        if (!active) return;
        questsRef.current = nextQuests;
        setQuests(nextQuests);
      })
      .catch(() => {
        if (active) {
          questsRef.current = null;
          setQuests(null);
        }
      });
    fetchStreakRescue()
      .then((state) => {
        if (active) setStreakRescue(state);
      })
      .catch(() => {
        if (active) setStreakRescue(null);
      });
    fetchRewardOffer(AdPlacementId.DASHBOARD_REWARDED_COIN)
      .then((offer) => {
        if (active) setRewardOffer(offer);
      })
      .catch(() => {
        if (active) setRewardOffer(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (rewardOffer?.reason !== "COOLDOWN_ACTIVE" || !rewardOffer.cooldownEndsAt) return;
    const delay = new Date(rewardOffer.cooldownEndsAt).getTime() - Date.now();
    const timer = window.setTimeout(() => void refreshRewardOffer(), Math.max(0, delay));
    return () => window.clearTimeout(timer);
  }, [refreshRewardOffer, rewardOffer?.cooldownEndsAt, rewardOffer?.reason]);

  // When free monthly freezes are exhausted and a single gap is buyable, prompt once per
  // break-day (sessionStorage) — no persistent freeze chrome on the rhythm card.
  useEffect(() => {
    if (!streakRescue?.eligible || !streakRescue.date) return;

    const breakDate = streakRescue.date;
    const storageKey = `${STREAK_RESCUE_PROMPT_KEY}:${breakDate}`;
    if (rescuePromptedForDateRef.current === breakDate) return;
    if (
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(storageKey)
    ) {
      rescuePromptedForDateRef.current = breakDate;
      return;
    }

    rescuePromptedForDateRef.current = breakDate;
    sessionStorage.setItem(storageKey, "1");

    let cancelled = false;
    const offer = streakRescue;
    const questList = questsRef.current;

    void (async () => {
      if (!offer.canAfford) {
        const result = await promo({
          title: t("streak_rescue_insufficient_title"),
          message: t("streak_rescue_insufficient", { cost: offer.cost }),
          primaryLabel: t("streak_rescue_insufficient_cta"),
          linkLabel: t("streak_rescue_insufficient_ok"),
          puhuVariant: "encouraging",
        });
        if (cancelled || result !== "primary" || !questList?.length) return;
        openQuestsSheet(questList);
        return;
      }

      const result = await promo({
        title: t("streak_rescue_modal_title"),
        message: `${t("streak_rescue_hint")} ${t("streak_rescue_confirm", { cost: offer.cost })}`,
        primaryLabel: t("streak_rescue_cta"),
        linkLabel: t("streak_rescue_later"),
        puhuVariant: "encouraging",
      });
      if (cancelled || result !== "primary") return;
      await handleStreakRescue();
    })();

    return () => {
      cancelled = true;
    };
  }, [handleStreakRescue, openQuestsSheet, promo, streakRescue, t]);

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
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : t("today_refresh_error");
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
      void refreshStreakRescue();
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
  }, [refreshToday, refreshQuests, refreshStreakRescue]);

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-4 sm:px-8 lg:px-10 lg:py-8">
        <p className="text-sm text-[var(--color-secondary)]">{t("loading")}</p>
        {error ? <FormError message={error} /> : null}
      </main>
    );
  }

  const doneCount = data.tasks.filter((task) =>
    completedStatuses.includes(task.status),
  ).length;
  const topBannerItems: TopBannerItem[] =
    rewardOffer?.eligible && rewardOffer.adUnitPath && !rewardUnavailable
      ? [
          {
            id: "rewarded-coin",
            message: adsT("top_banner.message", {
              count: rewardOffer.rewardCoin * rewardOffer.dailyRemaining,
            }),
            action: {
              kind: "button",
              label: adsT("top_banner.cta"),
              onSelect: () => openQuestsSheet(quests ?? []),
            },
          },
        ]
      : rewardOffer?.reason === "PREMIUM_AD_FREE"
        ? [
            {
              id: "daily-tasks",
              message: adsT("top_banner.daily_tasks_message"),
              action: {
                kind: "button",
                label: adsT("top_banner.cta"),
                onSelect: () => openQuestsSheet(quests ?? []),
              },
            },
          ]
        : [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-4 sm:px-8 lg:px-10 lg:py-8">
      <TopBanner
        closeLabel={adsT("top_banner.close")}
        items={topBannerItems}
      />
      <motion.div
        className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.85fr)]"
        variants={staggerListVariants}
        initial={shouldReduceMotion ? false : "initial"}
        animate={shouldReduceMotion ? undefined : "animate"}
      >
        <section className="min-w-0 space-y-5">
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
          {moodCheckin.reflecting ||
          moodCheckin.reflection ||
          moodCheckin.reflectionLocked ? (
            <motion.div variants={staggerItemVariants}>
              <MoodCoachNote
                reflecting={moodCheckin.reflecting}
                reflection={moodCheckin.reflection}
                locked={moodCheckin.reflectionLocked}
              />
            </motion.div>
          ) : null}
          {moodCheckin.mood != null && moodCheckin.mood <= 2 ? (
            <motion.div variants={staggerItemVariants}>
              <Link
                href={{
                  pathname: "/plan",
                  query: { coach: "adapt", source: "mood" },
                }}
                className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-card)] border bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2"
                style={{
                  borderColor: "var(--color-progress-track)",
                  color: "var(--color-main)",
                }}
              >
                {t("coach_adaptation_mood_cta")}
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Link>
            </motion.div>
          ) : null}

          {showWeeklyRecap && data.weeklyRecapPeriod ? (
            <motion.div variants={staggerItemVariants}>
              <WeeklyRecapTeaser
                period={data.weeklyRecapPeriod}
                status={data.weeklyRecapPeriod.status}
                source="dashboard"
                examId={data.weeklyRecapPeriod.examId}
                examType={data.countdown?.examType}
                compact
                viewState={weeklyRecapState === "replay" ? "replay" : "new"}
                onOpen={() =>
                  setOpenedWeeklyRecap(
                    data.weeklyRecapPeriod?.startDate ?? null,
                  )
                }
              />
            </motion.div>
          ) : null}

          <motion.div variants={staggerItemVariants}>
            <TodayFocusCard
              key={data.tasks
                .map((task) => `${task.id}:${task.status}`)
                .join("|")}
              initialTasks={data.tasks}
              sessionPresets={data.sessionPresets}
              doneCount={doneCount}
              quests={quests}
              streakDays={data.streak.currentStreak}
              onTasksChanged={refreshRitualAndRewards}
            />
          </motion.div>

          <motion.div variants={staggerItemVariants}>
            <CoachNextActionCard today={data} surface="dashboard" />
          </motion.div>

          <motion.div variants={staggerItemVariants} className="lg:hidden">
            <Link
              href="/notebooks"
              className="flex min-h-11 items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-card)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <BookOpen
                aria-hidden
                className="size-5 text-[var(--color-accent)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[var(--color-main)]">
                  {t("notebooks_quick_title")}
                </span>
                <span className="block text-sm text-[var(--color-secondary)]">
                  {t("notebooks_quick_copy")}
                </span>
              </span>
              <ArrowRight
                aria-hidden
                className="size-4 shrink-0 text-[var(--color-secondary)]"
              />
            </Link>
          </motion.div>
        </section>

        <aside className="min-w-0 space-y-5">
          <motion.div variants={staggerItemVariants}>
            {data.countdown ? (
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
            )}
          </motion.div>
          <PremiumCampaignBanner />
          <WelcomeGiftDialog />
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
      {celebration}
      {rescueSuccessDays != null ? (
        <StreakRescueSuccess
          days={rescueSuccessDays}
          onClose={() => setRescueSuccessDays(null)}
        />
      ) : null}
    </main>
  );
}

function MoodCoachNote({
  reflecting,
  reflection,
  locked,
}: {
  reflecting: boolean;
  reflection: string | null;
  locked: boolean;
}) {
  const t = useTranslations("mood");
  const { openPaywall } = usePremiumPaywall();

  if (reflecting) {
    return (
      <p
        className="text-sm"
        role="status"
        style={{ color: "var(--color-secondary)" }}
      >
        {t("coach_thinking")}
      </p>
    );
  }

  if (reflection) {
    return (
      <div className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-card)]">
        <Chip size="sm" className="inline-flex w-fit items-center gap-1">
          <Sparkles aria-hidden size={11} />
          {t("coach_chip")}
        </Chip>
        <p className="text-sm" style={{ color: "var(--color-body)" }}>
          {reflection}
        </p>
      </div>
    );
  }

  if (locked) {
    return (
      <PremiumLockNudge
        label={t("premium_nudge")}
        onClick={() => openPaywall({ sourceFeature: "mood.reflection" })}
      />
    );
  }

  return null;
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
  const { openPaywall } = usePremiumPaywall();
  const { greeting: dailyGreeting, locked: greetingLocked } =
    useDailyGreeting();
  const doneCount = tasks.filter((task) =>
    completedStatuses.includes(task.status),
  ).length;
  const hasEffort = doneCount > 0 || streakDays > 0;
  const displayMood = moodValue ?? mood?.mood ?? null;

  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_120px] sm:p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--color-main)]">
            {t("rhythm_title")}
          </h2>
          <ExpandableRhythmCopy text={dailyGreeting ?? t("rhythm_copy")} />
          {greetingLocked ? (
            <PremiumLockNudge
              label={t("premium_greeting_nudge")}
              onClick={() => openPaywall({ sourceFeature: "daily.greeting" })}
            />
          ) : null}
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

        <div className="mx-auto grid size-24 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-progress-track)_45%,var(--color-surface))]">
          <PuhuImage variant="winking" size={54} />
        </div>
      </div>

      <div className="border-t border-[color-mix(in_srgb,var(--color-main)_8%,transparent)] px-5 py-4 sm:px-6">
        <StreakWeekIcons streakDays={streakDays} />
      </div>

      <div className="grid grid-cols-2 border-t border-[color-mix(in_srgb,var(--color-main)_8%,transparent)] sm:grid-cols-4">
        <MetricTile
          label={t("metric_plan")}
          value={`${doneCount}/${tasks.length}`}
          icon={<BookOpen className="size-4" />}
        />
        <MetricTile
          label={t("metric_focus")}
          value={t("metric_focus_value", { minutes: focusMinutes })}
          icon={<Play className="size-4" />}
        />
        <MetricTile
          label={t("metric_mood")}
          value={
            displayMood != null
              ? t(`mood_${displayMood}`)
              : t("metric_mood_empty")
          }
          icon={<HeartPulse className="size-4" />}
          onClick={onMoodClick}
          actionLabel={t("metric_mood_action")}
        />
        <MetricTile
          label={t("metric_streak")}
          value={t("metric_streak_value", { count: streakDays })}
          icon={<StreakFlameIcon size={18} />}
          wellTone="streak"
        />
      </div>
    </article>
  );
}

/** Collapses long premium AI greetings behind “Daha fazla göster” / “Daha az göster”. */
function ExpandableRhythmCopy({ text }: { text: string }) {
  const t = useTranslations("panel");
  const reduceMotion = useReducedMotion();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null);
  const [fullHeight, setFullHeight] = useState<number | null>(null);

  // Collapse when the greeting text changes — adjust during render, not in an effect.
  const [renderedText, setRenderedText] = useState(text);
  if (renderedText !== text) {
    setRenderedText(text);
    setExpanded(false);
  }

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const full = el.scrollHeight;
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 28;
    const collapsed = Math.round(lineHeight * 3);

    setFullHeight(full);
    setCollapsedHeight(collapsed);
    setNeedsToggle(full > collapsed + 1);
  }, [text]);

  const targetHeight = expanded
    ? (fullHeight ?? "auto")
    : (collapsedHeight ?? "auto");

  return (
    <div className="max-w-md space-y-1">
      <motion.div
        initial={false}
        animate={{ height: needsToggle ? targetHeight : "auto" }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
        }
        className="relative overflow-hidden"
      >
        <p
          ref={textRef}
          className="text-base leading-7 text-[var(--color-body)]"
        >
          {text}
        </p>
        {!expanded && needsToggle ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[var(--color-surface)] to-transparent"
          />
        ) : null}
      </motion.div>
      {needsToggle ? (
        <button
          type="button"
          className="min-h-9 text-sm font-bold text-[var(--color-main)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t("rhythm_show_less") : t("rhythm_show_more")}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Next-7 calendar days: **today on the left**, then tomorrow → … (forward).
 * Future cells stay ghost; today is lit from `currentStreak` (filled if > 0, ring if 0).
 */
function StreakWeekIcons({ streakDays }: { streakDays: number }) {
  const t = useTranslations("panel");
  const locale = useLocale();
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, index) => {
    const iso = shiftDate(today, index);
    return { iso, label: formatWeekdayShort(iso, locale) };
  });

  return (
    <div
      className="flex items-center justify-between gap-1"
      role="img"
      aria-label={t("metric_streak_value", { count: streakDays })}
    >
      {days.map((day, index) => {
        const isToday = index === 0;
        const isDone = isToday && streakDays > 0;
        const todayRing = isToday && streakDays === 0;
        return (
          <div
            key={day.iso}
            className="grid min-w-0 flex-1 justify-items-center gap-1.5"
          >
            <StreakDayGlyph done={isDone} today={todayRing} />
            <span
              className={[
                "text-[10px] font-bold uppercase tracking-wide sm:text-xs",
                isToday
                  ? "text-[var(--color-streak)]"
                  : "text-[var(--color-secondary)]",
              ].join(" ")}
              aria-hidden
            >
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Soft well tuned to `flame.png` (coral tip `#F3705A`, yellow core `#FFD15C`).
 * Idle days keep a ghost flame (low opacity) so the week reads as one row.
 */
function StreakDayGlyph({ done, today }: { done: boolean; today: boolean }) {
  const lit = done || today;

  return (
    <span
      className={[
        "grid size-9 place-items-center rounded-full sm:size-10",
        done
          ? "bg-[linear-gradient(165deg,color-mix(in_srgb,var(--color-streak-core)_55%,var(--color-surface))_0%,var(--color-streak-soft)_100%)] shadow-[0_2px_12px_color-mix(in_srgb,var(--color-streak)_32%,transparent)]"
          : today
            ? "border-[1.5px] border-[var(--color-streak)] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--color-streak-core)_40%,var(--color-surface))_0%,var(--color-streak-soft)_100%)]"
            : "bg-[color-mix(in_srgb,var(--color-surface-container)_70%,var(--color-surface))]",
      ].join(" ")}
      aria-hidden
    >
      <StreakFlameIcon size={20} ghost={!lit} />
    </span>
  );
}

function StreakFlameIcon({
  size,
  ghost = false,
}: {
  size: number;
  ghost?: boolean;
}) {
  return (
    <Image
      src="/img/flame.png"
      alt=""
      width={size}
      height={size}
      className={[
        "select-none",
        ghost
          ? "opacity-[0.22] grayscale-[0.35]"
          : "drop-shadow-[0_1px_2px_color-mix(in_srgb,var(--color-streak)_25%,transparent)]",
      ].join(" ")}
      draggable={false}
    />
  );
}

function MetricTile({
  label,
  value,
  icon,
  onClick,
  actionLabel,
  wellTone = "progress",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  onClick?: () => void;
  actionLabel?: string;
  wellTone?: "progress" | "streak";
}) {
  const wellClass =
    wellTone === "streak"
      ? "bg-[linear-gradient(165deg,color-mix(in_srgb,var(--color-streak-core)_45%,var(--color-surface))_0%,var(--color-streak-soft)_100%)] text-[var(--color-streak)]"
      : "bg-[color-mix(in_srgb,var(--color-progress-track)_45%,var(--color-surface))] text-[var(--color-progress)]";

  const content = (
    <>
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-full ${wellClass}`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold text-[var(--color-secondary)]">
          {label}
        </span>
        <span className="block truncate text-base font-bold text-[var(--color-main)]">
          {value}
        </span>
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={actionLabel ?? label}
        className="flex w-full items-center gap-3 border-[color-mix(in_srgb,var(--color-main)_8%,transparent)] px-4 py-4 text-left transition hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus-ring)] sm:border-l first:sm:border-l-0"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 border-[color-mix(in_srgb,var(--color-main)_8%,transparent)] px-4 py-4 sm:border-l first:sm:border-l-0">
      {content}
    </div>
  );
}

function TodayFocusCard({
  initialTasks,
  sessionPresets,
  doneCount,
  quests,
  streakDays,
  onTasksChanged,
}: {
  initialTasks: PlanTaskDto[];
  sessionPresets: SessionPresetDto[];
  doneCount: number;
  quests: QuestProgressView[] | null;
  streakDays: number;
  onTasksChanged: (opts?: { celebrateStreakFrom?: number }) => Promise<void>;
}) {
  const t = useTranslations("panel");
  const toast = useMentorToast();
  const [tasks, setTasks] = useState(initialTasks);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const totalCount = tasks.length;
  const firstTask = tasks[0] ?? null;
  const completion =
    totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
  const activePreset = sessionPresets[0];

  const toggleTask = async (task: PlanTaskDto) => {
    const nextStatus: PlanTaskStatus =
      task.status === "DONE" ? "PENDING" : "DONE";
    const previousTasks = tasks;
    setPendingTaskId(task.id);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, status: nextStatus } : item,
      ),
    );

    try {
      await planTaskControllerUpdate(task.id, { status: nextStatus });
      if (nextStatus === "DONE") {
        toast.show({
          variant: "success",
          title: t("task_done_title"),
          message: t("task_done_message"),
        });
        await onTasksChanged({ celebrateStreakFrom: streakDays });
      } else {
        await onTasksChanged();
      }
    } catch (err) {
      setTasks(previousTasks);
      toast.show({
        variant: "error",
        title: t("task_update_error_title"),
        message:
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : t("task_update_error_message"),
      });
    } finally {
      setPendingTaskId(null);
    }
  };

  return (
    <SoftPromoShell
      className="p-5 sm:p-6"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-progress-track) 38%, var(--color-surface))",
      }}
    >
      <span
        className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full opacity-35"
        style={{
          background:
            "color-mix(in srgb, var(--color-progress) 20%, transparent)",
        }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -bottom-14 right-8 size-28 rounded-full opacity-30"
        style={{
          background:
            "color-mix(in srgb, var(--color-progress-track) 50%, transparent)",
        }}
        aria-hidden
      />

      <div className="relative z-[1]">
        {quests ? <RitualQuestStrip quests={quests} /> : null}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              className="text-xl font-bold text-[var(--color-main)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {t("today_focus_title")}
            </h2>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-secondary)]">
              <BookOpen className="size-4 shrink-0" aria-hidden />
              {t("today_focus_progress", {
                done: doneCount,
                total: totalCount,
              })}
            </p>
          </div>
          <Link
            className="text-sm font-bold text-[var(--color-main)] underline underline-offset-4"
            href="/plan"
          >
            {t("plan_edit")}
          </Link>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-surface)_70%,transparent)]">
          <div
            className="h-full rounded-full bg-[var(--color-progress)] transition-[width]"
            style={{ width: `${completion}%` }}
          />
        </div>

        {firstTask ? (
          <button
            type="button"
            className="mt-4 flex w-full items-center gap-3 rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-surface)_80%,transparent)] p-4 text-left shadow-[var(--shadow-card)] transition hover:bg-[var(--color-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pendingTaskId === firstTask.id}
            onClick={() => void toggleTask(firstTask)}
          >
            <span
              className={[
                "grid size-7 shrink-0 place-items-center rounded-md border",
                firstTask.status === "DONE"
                  ? "border-[var(--color-progress)] bg-[var(--color-progress)] text-[var(--color-btn-label)]"
                  : "border-[var(--color-secondary)] bg-[var(--color-surface)]",
              ].join(" ")}
              aria-hidden
            >
              {firstTask.status === "DONE" ? (
                <Check className="size-4" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold text-[var(--color-main)]">
                {firstTask.title}
              </span>
              {firstTask.subject ? (
                <span className="mt-1 inline-flex rounded-full bg-[color-mix(in_srgb,var(--color-progress-track)_45%,var(--color-surface))] px-2 py-0.5 text-xs font-bold text-[var(--color-progress)]">
                  {firstTask.subject}
                </span>
              ) : null}
            </span>
          </button>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {sessionPresets.slice(0, 2).map((preset) => (
            <span
              key={preset.id}
              className="rounded-full bg-[color-mix(in_srgb,var(--color-surface)_80%,transparent)] px-3 py-1 text-xs font-bold text-[var(--color-secondary)]"
            >
              {preset.focusMinutes} dk
            </span>
          ))}
        </div>

        <Link
          href="/study-session"
          className="mt-5 inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-full bg-[var(--color-surface)] px-5 text-base font-bold text-[var(--color-main)] shadow-[var(--shadow-card)] transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <Play className="size-4 fill-current" aria-hidden />
          {activePreset
            ? t("start_focus_with_minutes", {
                minutes: activePreset.focusMinutes,
              })
            : t("today_focus_continue")}
        </Link>
      </div>
    </SoftPromoShell>
  );
}

/** Compact economy quest row inside the ritual card — opens the quests sheet. */
function RitualQuestStrip({ quests }: { quests: QuestProgressView[] }) {
  const t = useTranslations("panel");
  const economyT = useTranslations("economy");
  const sheet = useMentorBottomSheet();
  const dailyQuests = quests.filter(
    (quest) => quest.category === "daily_ritual",
  );
  if (dailyQuests.length === 0) return null;

  const completed = dailyQuests.filter((quest) => quest.completed).length;
  const nextQuest =
    dailyQuests.find((quest) => !quest.completed && quest.action) ??
    quests.find(
      (quest) =>
        quest.category === "onboarding" && !quest.completed && quest.action,
    ) ??
    null;

  function showQuests() {
    sheet.show({
      title: economyT("quests_title"),
      layout: "filter",
      bodyScroll: false,
      children: (
        <EconomyQuestsCard quests={quests} onDismiss={sheet.dismissNow} />
      ),
    });
  }

  return (
    <button
      type="button"
      onClick={showQuests}
      aria-label={t("quests_banner_open")}
      className="mb-4 flex w-full min-w-0 items-center gap-3 rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-surface)_75%,transparent)] px-3 py-2.5 text-left shadow-[var(--shadow-card)] transition hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-progress-track)_55%,var(--color-surface))] text-[var(--color-progress)]">
        <ListChecks className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-[var(--color-secondary)]">
          {t("ritual_quest_label")}
        </span>
        <span className="mt-0.5 block truncate text-sm font-bold text-[var(--color-main)]">
          {nextQuest?.title ?? t("quests_banner_done")}
        </span>
        <span className="mt-0.5 block text-xs font-semibold text-[var(--color-secondary)]">
          {t("quests_banner_progress", {
            completed,
            total: dailyQuests.length,
          })}
        </span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-[var(--color-secondary)]"
        aria-hidden
      />
    </button>
  );
}

function unwrapTodayResponse(response: unknown): TodayPanelResponse {
  return ((response as { data?: TodayPanelResponse }).data ??
    response) as TodayPanelResponse;
}
