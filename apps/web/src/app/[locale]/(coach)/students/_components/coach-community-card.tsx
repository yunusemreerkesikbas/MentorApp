"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Users } from "lucide-react";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { listZones } from "@/lib/forum";

/**
 * The forum from the coach's side: where their students ask, and where roadmap §5 builds their
 * standing. A plain card, not the student's promo strip: a coach needs the door, not the pitch.
 * Drawn only once the forum answers, so a switched-off forum leaves no dead door behind.
 */
export function CoachCommunityCard() {
  const t = useTranslations("mentorship");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    listZones()
      .then(() => alive && setOpen(true))
      .catch(() => {
        /* Forum off or unreachable: the rail simply has one card fewer. */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!open) return null;

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-2.5`} aria-labelledby="coach-community-title">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-10 place-items-center rounded-[var(--radius-card)] bg-[var(--play-well-violet)] text-[var(--color-chip-text)]"
        >
          <Users className="size-5" />
        </span>
        <h2 id="coach-community-title" className={PANEL_CARD_TITLE}>
          {t("coach_community_title")}
        </h2>
      </div>
      <p className="text-body-sm leading-relaxed text-[var(--color-body)]">{t("coach_community_body")}</p>
      <Link href="/community" className={`${PANEL_TEXT_LINK} self-start`}>
        {t("coach_community_link")}
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
