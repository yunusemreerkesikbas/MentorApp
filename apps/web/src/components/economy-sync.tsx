"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "@/i18n/navigation";
import { useMentorToast } from "@/lib/mentor-toast";
import { ECONOMY_CHANGED_EVENT, fetchUnseenRewards, markRewardsSeen, notifyCoinCelebration } from "@/lib/economy";
import { refreshEconomySnapshot, resetEconomySnapshot } from "@/lib/economy-store";

/** One reward consumer per authenticated app. Amounts always come from committed ledger rows. */
export function EconomySync() {
  const { user } = useAuth();
  const pathname = usePathname();
  const toast = useMentorToast();
  const t = useTranslations("economy");

  useEffect(() => {
    resetEconomySnapshot();
    return resetEconomySnapshot;
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    let running = false;
    let dirty = false;
    async function sync() {
      dirty = true;
      if (running) return;
      running = true;
      try {
        while (active && dirty) {
          dirty = false;
          await refreshEconomySnapshot();
          if (!active || pathname.startsWith("/coach")) continue;
          let more = true;
          while (active && more) {
            const rewards = await fetchUnseenRewards();
            if (!active || rewards.items.length === 0) break;
            await markRewardsSeen(rewards.items.map((entry) => entry.id));
            if (!active) break;
            for (const entry of rewards.items) {
              if (entry.unit === "COIN") notifyCoinCelebration(entry.amount, entry.title);
              else toast.success({ title: entry.title, message: t("quest_reward_xp", { count: entry.amount }), duration: 3000 });
            }
            more = rewards.total > rewards.items.length;
          }
        }
      } catch {
        // Unacknowledged receipts remain on the server and retry on the next refresh.
      } finally { running = false; }
    }
    const refresh = () => { void sync(); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();
    window.addEventListener(ECONOMY_CHANGED_EVENT, refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      window.removeEventListener(ECONOMY_CHANGED_EVENT, refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [user?.id, pathname, t, toast]);
  return null;
}
