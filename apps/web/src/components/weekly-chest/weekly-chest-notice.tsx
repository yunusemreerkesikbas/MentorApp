"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { ECONOMY_CHANGED_EVENT } from "@/lib/economy";
import { useMentorToast } from "@/lib/mentor-toast";
import { fetchWeeklyChest, readNoticeMemory, writeNoticeMemory } from "@/lib/weekly-chest";
import { ChestArt } from "./chest-art";
import { cannotOpenToday, chestLamps } from "./weekly-chest-model";

/** At most one chest check per this many ms; actions and page changes both fire the event. */
const CHECK_GAP_MS = 2 * 60 * 1000;
const utcToday = () => new Date().toISOString().slice(0, 10);

/**
 * "Haftalık sandığın hazır" away from the panel. Rides the same event as the balance refresh (after
 * a session, a task, a page change), works with the economy off (no receipt then), and tells each
 * ready chest once. On a day when no action can finish the week it stops asking until tomorrow.
 * The panel draws the chest itself, and coach screens are not the student's, so both stay quiet.
 */
export function WeeklyChestNotice() {
  const t = useTranslations("weeklyChest");
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useMentorToast();
  const live = useRef({ pathname, t, toast, router });
  useEffect(() => {
    live.current = { pathname, t, toast, router };
  }, [pathname, t, toast, router]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let active = true;
    let running = false;
    let lastCheck = 0;

    async function check() {
      const { pathname: path } = live.current;
      if (!active || running || path.startsWith("/dashboard") || path.startsWith("/coach")) return;
      if (Date.now() - lastCheck < CHECK_GAP_MS || readNoticeMemory(userId!).quietDay === utcToday()) return;
      running = true;
      lastCheck = Date.now();
      try {
        const chest = await fetchWeeklyChest();
        if (!active) return;
        const memory = readNoticeMemory(userId!);
        if (chest.state === "READY" && memory.noticed !== chest.periodKey) {
          writeNoticeMemory(userId!, { noticed: chest.periodKey });
          const { t: copy, toast: toasts, router: nav } = live.current;
          toasts.show({
            title: copy("notice_title"),
            message: copy("notice_body", { target: chest.target }),
            leading: <ChestArt open={false} lamps={chestLamps(chest)} className="w-11" />,
            duration: 8000,
            action: { label: copy("open"), onClick: () => nav.push({ pathname: "/dashboard", query: { chest: "open" } }) },
          });
        }
        if (cannotOpenToday(chest)) writeNoticeMemory(userId!, { quietDay: chest.today });
      } catch {
        // Best effort: the panel still shows the chest.
      } finally {
        running = false;
      }
    }

    const onChange = () => void check();
    onChange();
    window.addEventListener(ECONOMY_CHANGED_EVENT, onChange);
    return () => {
      active = false;
      window.removeEventListener(ECONOMY_CHANGED_EVENT, onChange);
    };
  }, [user?.id]);

  return null;
}
