"use client";

import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import Flame from "lucide-react/dist/esm/icons/flame.mjs";
import Moon from "lucide-react/dist/esm/icons/moon.mjs";
import Heart from "lucide-react/dist/esm/icons/heart.mjs";
import Sprout from "lucide-react/dist/esm/icons/sprout.mjs";
import { CommunityBadgeId } from "@mentor/types";

/** Icon + label + soft color per badge. Positive framing only (§3). */
const BADGE_META: Record<CommunityBadgeId, { icon: ComponentType<{ size?: number }>; bg: string; fg: string; key: string }> = {
  [CommunityBadgeId.MARATHON]: { icon: Flame, bg: "#FAEEDA", fg: "#854F0B", key: "badge_marathon" },
  [CommunityBadgeId.NIGHT_OWL]: { icon: Moon, bg: "#EEEDFE", fg: "#3C3489", key: "badge_night_owl" },
  [CommunityBadgeId.MOTIVATOR]: { icon: Heart, bg: "#E1F5EE", fg: "#0F6E56", key: "badge_motivator" },
  [CommunityBadgeId.NEWCOMER]: { icon: Sprout, bg: "#EAF3DE", fg: "#3B6D11", key: "badge_newcomer" },
};

export function BadgeStrip({ badges }: { badges: CommunityBadgeId[] }) {
  const t = useTranslations("community");

  return (
    <div className="flex flex-col gap-2">
      <p
        className="text-[11px] font-semibold uppercase"
        style={{ color: "var(--color-secondary)", letterSpacing: "0.08em" }}
      >
        {t("badges_title")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {badges.map((id) => {
          const meta = BADGE_META[id];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium"
              style={{ background: meta.bg, color: meta.fg }}
            >
              <Icon size={14} aria-hidden="true" />
              {t(meta.key as "badge_marathon")}
            </span>
          );
        })}
      </div>
    </div>
  );
}
