"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "@/i18n/navigation";
import { useMentorToast } from "@/lib/mentor-toast";
import { ECONOMY_CHANGED_EVENT, ECONOMY_DISABLED_EVENT, fetchUnseenRewards, forgetInviteCode, isEconomyDisabled, markRewardsSeen, notifyCoinCelebration } from "@/lib/economy";
import { disableEconomySnapshot, getEconomySnapshot, refreshEconomySnapshot, resetEconomySnapshot } from "@/lib/economy-store";
import { useAppAvailability } from "@/lib/app-availability";
import { useEconomyEnabled } from "@/lib/use-economy-enabled";

/** One reward consumer per authenticated app. Amounts always come from committed ledger rows. */
export function EconomySync() {
  const { user } = useAuth();
  const availability = useAppAvailability();
  const economyEnabled = useEconomyEnabled();
  const pathname = usePathname();
  const toast = useMentorToast();
  const t = useTranslations("economy");

  const presentation = useRef({ pathname, t, toast });
  const displayed = useRef(new Set<string>());
  useEffect(() => { presentation.current = { pathname, t, toast }; }, [pathname, t, toast]);

  useEffect(() => {
    // Everything the economy layer remembers about the account goes with it: the balance and the
    // invite code (the "Tavsiye et" row reads the latter synchronously, so it must never be a
    // previous account's).
    const forgetAccount = () => {
      resetEconomySnapshot();
      forgetInviteCode();
    };
    displayed.current.clear();
    forgetAccount();
    if (!availability?.economy) disableEconomySnapshot();
    return forgetAccount;
  }, [user?.id, availability?.economy]);

  useEffect(() => {
    window.addEventListener(ECONOMY_DISABLED_EVENT, disableEconomySnapshot);
    return () => window.removeEventListener(ECONOMY_DISABLED_EVENT, disableEconomySnapshot);
  }, []);

  useEffect(() => {
    if (!user?.id || !economyEnabled) return;
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
          if (!active || getEconomySnapshot().enabled === false || presentation.current.pathname.startsWith("/coach")) continue;
          let more = true;
          while (active && more) {
            const rewards = await fetchUnseenRewards();
            if (!active || getEconomySnapshot().enabled === false || rewards.items.length === 0) break;
            for (const entry of rewards.items) {
              if (displayed.current.has(entry.id)) continue;
              displayed.current.add(entry.id);
              if (entry.unit === "COIN") notifyCoinCelebration(entry.amount, entry.title);
              else presentation.current.toast.success({ title: entry.title, message: presentation.current.t("quest_reward_xp", { count: entry.amount }), duration: 3000 });
            }
            await markRewardsSeen(rewards.items.map((entry) => entry.id));
            more = rewards.total > rewards.items.length;
          }
        }
      } catch (error) {
        if (isEconomyDisabled(error)) disableEconomySnapshot();
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
  }, [user?.id, economyEnabled]);

  useEffect(() => { window.dispatchEvent(new Event(ECONOMY_CHANGED_EVENT)); }, [pathname]);
  return null;
}
