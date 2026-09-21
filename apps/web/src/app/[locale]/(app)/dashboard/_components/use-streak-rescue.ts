"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { QuestProgressView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { notifyEconomyChanged, purchaseStreakRescue } from "@/lib/economy";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import type { PanelData } from "./use-panel-data";

const STREAK_RESCUE_PROMPT_KEY = "mentor_streak_rescue_prompt";

/** Dev/QA preview params (`?mockStreakCelebration=7`, `?mockStreakRescueSuccess=1`). */
export function parseMockDays(raw: string | null, currentStreak: number | undefined): number | null {
  if (raw == null || raw === "" || raw === "0" || raw === "false") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Math.max(currentStreak ?? 0, 1);
}

/**
 * Coin-bought streak freeze. When the free monthly freezes are spent and a single gap is buyable,
 * the panel asks once per break day (sessionStorage) — there is no standing freeze chrome.
 */
export function useStreakRescue(
  panel: PanelData,
  openQuests: (quests: QuestProgressView[]) => void,
) {
  const t = useTranslations("panel");
  const toast = useMentorToast();
  const { promo } = useMentorDialog();
  const searchParams = useSearchParams();
  const { data, quests, streakRescue, setStreakRescue, refreshToday, refreshStreakRescue } = panel;
  const currentStreak = data?.streak.currentStreak;
  const [override, setOverride] = useState<number | null>();
  const promptedForRef = useRef<string | null>(null);
  // Read inside the prompt without re-running it every time the quest list refreshes.
  const questsRef = useRef(quests);
  useEffect(() => {
    questsRef.current = quests;
  }, [quests]);

  const mockDays = parseMockDays(searchParams.get("mockStreakRescueSuccess"), currentStreak);
  const successDays = override === undefined ? mockDays : override;

  const rescue = useCallback(async () => {
    try {
      await purchaseStreakRescue();
      setStreakRescue(null);
      const next = await refreshToday({ silent: true });
      notifyEconomyChanged();
      setOverride(Math.max(next?.streak.currentStreak ?? currentStreak ?? 1, 1));
    } catch (err) {
      toast.error({
        title: t("streak_rescue_error_title"),
        message:
          err instanceof ApiClientError ? err.message : t("streak_rescue_error_message"),
      });
      await refreshStreakRescue();
    }
  }, [currentStreak, refreshStreakRescue, refreshToday, setStreakRescue, t, toast]);

  useEffect(() => {
    if (!streakRescue?.eligible || !streakRescue.date) return;
    const breakDate = streakRescue.date;
    const storageKey = `${STREAK_RESCUE_PROMPT_KEY}:${breakDate}`;
    if (promptedForRef.current === breakDate) return;
    promptedForRef.current = breakDate;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "1");

    let cancelled = false;
    const offer = streakRescue;
    void (async () => {
      if (!offer.canAfford) {
        const result = await promo({
          title: t("streak_rescue_insufficient_title"),
          message: t("streak_rescue_insufficient", { cost: offer.cost }),
          primaryLabel: t("streak_rescue_insufficient_cta"),
          linkLabel: t("streak_rescue_insufficient_ok"),
          puhuVariant: "encouraging",
        });
        const list = questsRef.current;
        if (!cancelled && result === "primary" && list?.length) openQuests(list);
        return;
      }
      const result = await promo({
        title: t("streak_rescue_modal_title"),
        message: `${t("streak_rescue_hint")} ${t("streak_rescue_confirm", { cost: offer.cost })}`,
        primaryLabel: t("streak_rescue_cta"),
        linkLabel: t("streak_rescue_later"),
        puhuVariant: "encouraging",
      });
      if (!cancelled && result === "primary") await rescue();
    })();

    return () => {
      cancelled = true;
    };
  }, [openQuests, promo, rescue, streakRescue, t]);

  return { successDays, closeSuccess: () => setOverride(null) };
}
