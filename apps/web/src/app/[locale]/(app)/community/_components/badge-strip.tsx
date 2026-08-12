"use client";
import { Flame, Heart, Moon, Sprout } from "lucide-react";

import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import { CommunityBadgeId } from "@mentor/types";

/** Icon + label + soft color per badge. Positive framing only (§3). */
const BADGE_META: Record<CommunityBadgeId, { icon: ComponentType<{ size?: number }>; bg: string; fg: string; key: string; descriptionKey: string }> = {
  [CommunityBadgeId.MARATHON]: { icon: Flame, bg: "#FAEEDA", fg: "#854F0B", key: "badge_marathon", descriptionKey: "badge_marathon_description" },
  [CommunityBadgeId.NIGHT_OWL]: { icon: Moon, bg: "#EEEDFE", fg: "#3C3489", key: "badge_night_owl", descriptionKey: "badge_night_owl_description" },
  [CommunityBadgeId.MOTIVATOR]: { icon: Heart, bg: "#E1F5EE", fg: "#0F6E56", key: "badge_motivator", descriptionKey: "badge_motivator_description" },
  [CommunityBadgeId.NEWCOMER]: { icon: Sprout, bg: "#EAF3DE", fg: "#3B6D11", key: "badge_newcomer", descriptionKey: "badge_newcomer_description" },
};

export function BadgeStrip({
  badges,
  detailed = false,
  compact = false,
  onDark = false,
}: {
  badges: CommunityBadgeId[];
  detailed?: boolean;
  compact?: boolean;
  onDark?: boolean;
}) {
  const t = useTranslations("community");

  return (
    <div className={`flex flex-col ${compact ? "gap-1.5" : "gap-2"}`}>
      <p
        className="text-xs font-bold"
        style={{ color: onDark ? "rgba(255,255,255,0.82)" : "var(--color-secondary)" }}
      >
        {t("badges_title")}
      </p>
      <div className={detailed ? `grid ${compact ? "gap-1" : "gap-2"}` : "flex flex-wrap gap-1.5"}>
        {badges.map((id) => {
          const meta = BADGE_META[id];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <span
              key={id}
              className={detailed ? `flex items-center ${compact ? "gap-2 py-0.5" : "gap-3 py-1.5"}` : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium"}
              style={detailed ? undefined : { background: meta.bg, color: meta.fg }}
            >
              <span
                className={detailed ? `grid shrink-0 place-items-center rounded-full ${compact ? "size-8" : "size-9"}` : "contents"}
                style={detailed ? { background: meta.bg, color: meta.fg } : undefined}
              >
                <Icon size={detailed ? (compact ? 15 : 17) : 14} aria-hidden="true" />
              </span>
              {detailed ? (
                <span className="min-w-0">
                  <span className={`block text-xs font-bold ${onDark ? "text-white" : "text-[var(--color-main)]"}`}>{t(meta.key as "badge_marathon")}</span>
                  <span className={`mt-0.5 block text-[11px] leading-4 ${onDark ? "text-white/55" : "text-[var(--color-secondary)]"}`}>{t(meta.descriptionKey as "badge_marathon_description")}</span>
                </span>
              ) : t(meta.key as "badge_marathon")}
            </span>
          );
        })}
      </div>
    </div>
  );
}
