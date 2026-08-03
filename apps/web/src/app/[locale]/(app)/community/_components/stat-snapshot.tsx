"use client";
import { Flame, Zap } from "lucide-react";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { CommunityLevelView } from "@mentor/types";

/** One metric cell — filled icon chip + label above, big value below. */
function Cell({
  icon,
  label,
  value,
  iconBg,
  iconFg,
  tint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  iconBg: string;
  iconFg: string;
  tint: string;
}) {
  return (
    <div
      className="rounded-2xl p-3.5"
      style={{ background: tint, border: "1px solid color-mix(in srgb, var(--color-main) 5%, transparent)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{ background: iconBg, color: iconFg }}
        >
          {icon}
        </span>
        <span className="text-[12px] font-medium" style={{ color: "var(--color-secondary)" }}>
          {label}
        </span>
      </div>
      <p
        className="mt-2 text-[24px] font-bold leading-none tabular-nums"
        style={{ color: "var(--color-main)" }}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Streak + XP snapshot + level progress. Streak is economy-independent (always shown); the XP cell
 * and level bar render only when the economy is on (`xp`/`level` non-null) — graceful degradation.
 */
export function StatSnapshot({
  streak,
  xp,
  level,
}: {
  streak: number;
  xp: number | null;
  level: CommunityLevelView | null;
}) {
  const t = useTranslations("community");
  const locale = useLocale();
  const hasXp = xp !== null;
  const pct =
    level && level.nextAt ? Math.min(100, Math.round((level.xp / level.nextAt) * 100)) : 100;

  return (
    <div className="flex flex-col gap-3">
      <div className={hasXp ? "grid grid-cols-2 gap-3" : "grid grid-cols-1"}>
        <Cell
          icon={<Flame size={15} aria-hidden="true" />}
          label={t("stat_streak")}
          value={t("stat_streak_days", { count: streak })}
          iconBg="var(--color-star)"
          iconFg="var(--color-main)"
          tint="color-mix(in srgb, var(--color-star) 9%, white)"
        />
        {hasXp && (
          <Cell
            icon={<Zap size={15} aria-hidden="true" />}
            label={t("stat_xp")}
            value={xp!.toLocaleString(locale)}
            iconBg="var(--color-progress)"
            iconFg="var(--color-main)"
            tint="color-mix(in srgb, var(--color-progress) 9%, white)"
          />
        )}
      </div>

      {level && (
        <div className="flex flex-col gap-1.5">
          <div
            className="flex items-center justify-between text-[12px]"
            style={{ color: "var(--color-secondary)" }}
          >
            <span>
              {t("level_label", { tier: level.tier })} — {t(`level_${level.tier}` as "level_1")}
            </span>
            {level.nextAt && (
              <span>
                {level.xp} / {level.nextAt}
              </span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "#ececec" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, background: "var(--color-progress)" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
