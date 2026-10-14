"use client";

import { useTranslations } from "next-intl";
import type { PublicProfile } from "@mentor/types";
import { JourneyLevelProfile } from "@/components/journey-levels/journey-level-profile";
import { PANEL_CARD } from "@/components/panel/panel-styles";
import { BadgeStrip } from "../../../_components/badge-strip";

/** The journey (Gece Yolculuğu level; XP numbers for the owner only) and the badges, on a panel card. */
export function ProfileProgressPanel({ profile, isOwner }: { profile: PublicProfile; isOwner: boolean }) {
  const t = useTranslations("community");
  const level = profile.level;

  return (
    <section className={`profile-progress-panel ${PANEL_CARD} text-[var(--color-main)]`}>
      {level ? (
        <JourneyLevelProfile level={level} isOwner={isOwner} />
      ) : (
        <>
          <h2 className="text-base font-extrabold">{t("profile_progress_title")}</h2>
          <p className="mt-3 text-body-sm font-semibold text-[var(--color-secondary)]">{t("profile_progress_unavailable")}</p>
        </>
      )}

      {profile.badges.length > 0 ? (
        <div className="profile-badge-panel mt-4 border-t border-[var(--color-border)] pt-3">
          <BadgeStrip badges={profile.badges} detailed compact ownerView={isOwner} />
        </div>
      ) : null}
    </section>
  );
}
