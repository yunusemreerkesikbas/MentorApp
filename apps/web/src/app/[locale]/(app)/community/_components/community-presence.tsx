"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { coachingControllerGetToday } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { PANEL_CARD, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";

/** Anonymous "studying now" count from `/coaching/today`; null under the server's privacy threshold. */
export function useFocusingNow(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    coachingControllerGetToday()
      .then((res) => {
        const value = (res as { focusingNow?: number | null }).focusingNow ?? null;
        if (active) setCount(value != null && value > 0 ? value : null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return count;
}

/** The rail's "you are not alone" card (Akış, rooms). No number from the server → no card. */
export function CommunityPresenceCard() {
  const t = useTranslations("community");
  const focusingNow = useFocusingNow();
  if (!focusingNow) return null;

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-1`} aria-labelledby="community-presence-title">
      <p
        id="community-presence-title"
        className="flex items-center gap-2 text-body-sm font-extrabold text-[var(--color-main)]"
      >
        <span className="size-2 shrink-0 rounded-full bg-[var(--play-cta)]" aria-hidden />
        {t("hub_focusing_now", { count: focusingNow })}
      </p>
      <Link href="/study-session" className={`${PANEL_TEXT_LINK} self-start`}>
        {t("hub_join_table")}
        <ChevronRight size={16} aria-hidden />
      </Link>
    </section>
  );
}
