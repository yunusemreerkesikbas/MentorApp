"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  AdRewardOfferView,
  PlanTaskStatus,
  PromotionOffersView,
  QuestProgressView,
  StreakRescueView,
  TodayPanelResponse,
} from "@mentor/types";
import { AdPlacementId } from "@mentor/types";
import {
  ApiClientError,
  coachingControllerGetToday,
  planTaskControllerUpdate,
} from "@mentor/api-client";
import { fetchRewardOffer } from "@/lib/ads";
import { fetchQuests, fetchStreakRescue, notifyEconomyChanged } from "@/lib/economy";
import { fetchAutoPromotionOffers } from "@/lib/promotions";

function unwrapToday(response: unknown): TodayPanelResponse {
  return ((response as { data?: TodayPanelResponse }).data ??
    response) as TodayPanelResponse;
}

function messageOf(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError || err instanceof Error) return err.message;
  return fallback;
}

/**
 * Everything the panel reads, in one parallel wave on mount.
 *
 * The page used to hold its whole layout behind `if (!data) return`, so every card that fetches for
 * itself (goal board, community, coach, greeting) only started once `/coaching/today` had answered:
 * three waves for one screen. Now the layout mounts at once, today-dependent sections show their
 * own skeleton, and `/coaching/today` is requested exactly once per load.
 */
export function usePanelData() {
  const t = useTranslations("panel");
  const [data, setData] = useState<TodayPanelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quests, setQuests] = useState<QuestProgressView[] | null>(null);
  const [streakRescue, setStreakRescue] = useState<StreakRescueView | null>(null);
  const [rewardOffer, setRewardOffer] = useState<AdRewardOfferView | null>(null);
  const [rewardUnavailable, setRewardUnavailable] = useState(false);
  /** `undefined` = still resolving · `null` = nothing to advertise · view = the offers answer. */
  const [promotionOffers, setPromotionOffers] = useState<
    PromotionOffersView | null | undefined
  >(undefined);

  const refreshToday = useCallback(
    async (opts?: { silent?: boolean }): Promise<TodayPanelResponse | null> => {
      try {
        const next = unwrapToday(await coachingControllerGetToday());
        setData(next);
        setError(null);
        return next;
      } catch (err) {
        if (!opts?.silent) setError(messageOf(err, t("today_refresh_error")));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  // Best-effort feeds: economy or ads off (404) simply hides what depends on them.
  const refreshQuests = useCallback(async () => {
    try {
      setQuests(await fetchQuests());
    } catch {
      setQuests(null);
    }
  }, []);

  const refreshStreakRescue = useCallback(async () => {
    try {
      setStreakRescue(await fetchStreakRescue());
    } catch {
      setStreakRescue(null);
    }
  }, []);

  const refreshRewardOffer = useCallback(async () => {
    try {
      setRewardOffer(await fetchRewardOffer(AdPlacementId.DASHBOARD_REWARDED_COIN));
    } catch {
      setRewardOffer(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Loader state updates happen only after each awaited request (same shape as `plan-shell`).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void Promise.all([refreshToday(), refreshQuests(), refreshStreakRescue(), refreshRewardOffer()]);
    // The offers call is deduped module-side; the entitlement rides the shared subscription read.
    void fetchAutoPromotionOffers().then((offers) => {
      // An empty answer (204) is "nothing to advertise", not "still resolving": `undefined` would
      // hold the membership card back for good.
      if (active) setPromotionOffers(offers ?? null);
    });
    return () => {
      active = false;
    };
  }, [refreshQuests, refreshRewardOffer, refreshStreakRescue, refreshToday]);

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState !== "visible") return;
      void refreshToday({ silent: true });
      void refreshQuests();
      void refreshStreakRescue();
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) refreshIfVisible();
    }
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [refreshQuests, refreshStreakRescue, refreshToday]);

  useEffect(() => {
    if (rewardOffer?.reason !== "COOLDOWN_ACTIVE" || !rewardOffer.cooldownEndsAt) return;
    const delay = new Date(rewardOffer.cooldownEndsAt).getTime() - Date.now();
    const timer = window.setTimeout(() => void refreshRewardOffer(), Math.max(0, delay));
    return () => window.clearTimeout(timer);
  }, [refreshRewardOffer, rewardOffer?.cooldownEndsAt, rewardOffer?.reason]);

  /** After anything that can move the ritual: today, quests and the rescue offer, then the balance. */
  const refreshAfterProgress = useCallback(async () => {
    const [next] = await Promise.all([
      refreshToday({ silent: true }),
      refreshQuests(),
      refreshStreakRescue(),
    ]);
    notifyEconomyChanged();
    return next;
  }, [refreshQuests, refreshStreakRescue, refreshToday]);

  /** Optimistic: the path moves on the tap and rolls back if the write fails (the caller toasts). */
  const setTaskStatus = useCallback(async (taskId: string, status: PlanTaskStatus) => {
    const apply = (to: PlanTaskStatus) =>
      setData((current) =>
        current && {
          ...current,
          tasks: current.tasks.map((task) =>
            task.id === taskId ? { ...task, status: to } : task,
          ),
        },
      );
    apply(status);
    try {
      await planTaskControllerUpdate(taskId, { status });
    } catch (err) {
      apply(status === "DONE" ? "PENDING" : "DONE");
      throw err;
    }
  }, []);

  return {
    data,
    loading,
    error,
    quests,
    streakRescue,
    setStreakRescue,
    rewardOffer,
    setRewardOffer,
    rewardUnavailable,
    setRewardUnavailable,
    promotionOffers,
    refreshToday,
    refreshStreakRescue,
    refreshAfterProgress,
    setTaskStatus,
  };
}

export type PanelData = ReturnType<typeof usePanelData>;
