import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { usePathname } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildCelebrationQueue,
  createRewardSync,
  didStreakCreditToday,
  isCoach,
  isHeldChestReceipt,
  rewardPresentation,
} from "@mentor/core";
import type { AchievementCelebrationDto, JourneyLevelCelebrationView } from "@mentor/types";
import { AchievementScene, CoinScene, LevelScene } from "../components/celebrations/scenes.js";
import { StreakScene } from "../components/celebrations/streak-scene.js";
import { fetchTodayPanel } from "../lib/coaching-api.js";
import {
  fetchUnseenAchievements,
  fetchUnseenLevelCelebrations,
  fetchUnseenRewards,
  markAchievementsCelebrated,
  markLevelCelebrated,
  markRewardsSeen,
} from "../lib/rewards-api.js";
import { useAuth } from "./auth-provider.js";
import { useTranslations } from "./i18n-provider.js";
import { useToast } from "./toast-provider.js";

interface CelebrationContextValue {
  /** Ask the server what is still unseen; call after anything that can earn a reward. */
  refresh: () => void;
  /** A scene is on screen; anything else that wants the stage (Puhu's reply) waits. */
  active: boolean;
}

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

/**
 * The app's one celebration queue (the web's notification shell + `EconomySync`). The server keeps
 * every reward "unseen" until a client shows it, so this only has to ask, play one scene at a
 * time, and acknowledge: Coin first, then achievements in the order they were earned, level-ups
 * last (`buildCelebrationQueue`). Everyday XP and the daily Coin are a toast, never a scene.
 * The day's first streak credit is the one scene the server does not queue; it is read off "today".
 *
 * Nothing plays over a running study session; it waits for the student to come back.
 */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations("celebration");
  const [achievements, setAchievements] = useState<AchievementCelebrationDto[]>([]);
  const [levels, setLevels] = useState<JourneyLevelCelebrationView[]>([]);
  const [coin, setCoin] = useState<{ amount: number; label?: string } | null>(null);
  const [streakDays, setStreakDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useRef(new Set<string>());
  // The sync outlives renders; it reads the current toast and copy through this ref.
  const present = useRef({ toast, t });
  present.current = { toast, t };

  const userId = user && !isCoach(user) ? user.id : null;

  // One run per signed-in account: `refresh` asks the server, `stop` silences a run that is
  // still in flight when the account changes.
  const { refresh, stop } = useMemo(() => {
    if (!userId) return { refresh: () => {}, stop: () => {} };
    let active = true;
    const sync = createRewardSync(
      {
        refreshBalance: () => queryClient.invalidateQueries({ queryKey: ["economy", "balance"] }),
        canPresent: () => true,
        fetchUnseen: fetchUnseenRewards,
        // The chest's Coin waits for its opening scene, which acknowledges it on open.
        isHeld: (entry) => isHeldChestReceipt(entry, Date.now()),
        present: (entry) => {
          if (shown.current.has(entry.id)) return false;
          shown.current.add(entry.id);
          const kind = rewardPresentation(entry);
          if (kind === "CELEBRATION") {
            // Several grants landing together read as one celebration, like the web's batch.
            setCoin((current) => ({
              amount: (current?.amount ?? 0) + entry.amount,
              label: entry.title,
            }));
          } else {
            present.current.toast.show(
              present.current.t(kind === "COIN_TOAST" ? "reward_coin_toast" : "reward_xp_toast", {
                title: entry.title,
                count: entry.amount,
              }),
            );
          }
          return true;
        },
        markSeen: markRewardsSeen,
      },
      () => active,
    );
    const run = () => {
      void Promise.allSettled([fetchUnseenAchievements(), fetchUnseenLevelCelebrations()]).then(
        ([achievementResult, levelResult]) => {
          if (!active) return;
          if (achievementResult.status === "fulfilled") setAchievements(achievementResult.value);
          if (levelResult.status === "fulfilled") setLevels(levelResult.value);
        },
      );
      // Unacknowledged receipts stay on the server and come back on the next refresh.
      sync().catch(() => {});
    };
    return {
      refresh: run,
      stop: () => {
        active = false;
      },
    };
  }, [queryClient, userId]);

  useEffect(() => {
    shown.current.clear();
    setAchievements([]);
    setLevels([]);
    setCoin(null);
    setStreakDays(null);
    return stop;
  }, [stop]);

  // Ask on entry, on every screen change, and when the app comes back to the front.
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  // The streak scene needs no wiring per screen: every counting action (a finished task on the
  // Panel or the Plan, a study session) already refreshes "today", so growth is seen here.
  const today = useQuery({
    queryKey: ["coaching", "today"],
    queryFn: fetchTodayPanel,
    enabled: userId !== null,
  });
  const streakNow = today.data?.streak.currentStreak;
  const streakSeen = useRef<number | null>(null);
  useEffect(() => {
    // The first value after sign-in is the baseline, never a celebration.
    if (streakNow === undefined) {
      streakSeen.current = null;
      return;
    }
    const before = streakSeen.current;
    streakSeen.current = streakNow;
    if (before !== null && didStreakCreditToday(before, streakNow)) setStreakDays(streakNow);
  }, [streakNow]);

  const queue = useMemo(() => buildCelebrationQueue(achievements, levels), [achievements, levels]);
  const current = queue[0];

  const closeCurrent = useCallback(async () => {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (current.type === "achievement") {
        await markAchievementsCelebrated(current.celebration.items.map((item) => item.id));
        setAchievements((items) => items.filter((item) => item !== current.celebration));
      } else {
        await markLevelCelebrated(current.celebration.id);
        setLevels((items) => items.filter((item) => item.id !== current.celebration.id));
      }
    } catch {
      setError(present.current.t("achievement_close_error"));
    } finally {
      setBusy(false);
    }
  }, [busy, current]);

  // A focus session and the weekly story play to the end undisturbed; leaving them refreshes.
  const hold = pathname.includes("study-session") || pathname.includes("weekly-recap");

  // One scene at a time. The streak answers the action the student just took, so it goes first;
  // but a scene already on screen is never swapped for one that arrived later.
  const ready = { streak: streakDays !== null, coin: coin !== null, queue: current !== undefined };
  const onStage = useRef<keyof typeof ready | null>(null);
  const scene = hold
    ? null
    : onStage.current && ready[onStage.current]
      ? onStage.current
      : ready.streak
        ? "streak"
        : ready.coin
          ? "coin"
          : ready.queue
            ? "queue"
            : null;
  if (!hold) onStage.current = scene;

  const active = scene !== null;
  const value = useMemo(() => ({ refresh, active }), [refresh, active]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {scene === "streak" && streakDays !== null ? (
        <StreakScene days={streakDays} onClose={() => setStreakDays(null)} />
      ) : scene === "coin" && coin ? (
        <CoinScene amount={coin.amount} label={coin.label} onClose={() => setCoin(null)} />
      ) : scene !== "queue" ? null : current?.type === "achievement" ? (
        <AchievementScene
          key={current.celebration.items.map((item) => item.id).join(":")}
          celebration={current.celebration}
          busy={busy}
          error={error}
          onContinue={() => void closeCurrent()}
        />
      ) : current?.type === "journey-level" ? (
        <LevelScene
          key={current.celebration.id}
          celebration={current.celebration}
          busy={busy}
          error={error}
          onContinue={() => void closeCurrent()}
        />
      ) : null}
    </CelebrationContext.Provider>
  );
}

export function useCelebrations(): CelebrationContextValue {
  const context = useContext(CelebrationContext);
  if (!context) throw new Error("useCelebrations must be used within <CelebrationProvider>");
  return context;
}
