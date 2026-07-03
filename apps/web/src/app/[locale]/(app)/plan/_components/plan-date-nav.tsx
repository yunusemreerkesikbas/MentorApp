"use client";

import type { ReactNode } from "react";
import Calendar from "lucide-react/dist/esm/icons/calendar.mjs";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@mentor/ui";
import { PlanProgress } from "./plan-progress";
import { formatDateLabel, isPastDate, shiftDate, todayIso } from "./plan-utils";

export type PlanDateNavProps = {
  date: string;
  progress?: { done: number; total: number; percent: number };
  onDateChange: (iso: string) => void;
  onOpenCalendar: () => void;
};

/** Day navigator for Liste / Timeline views. */
export function PlanDateNav({
  date,
  progress,
  onDateChange,
  onOpenCalendar,
}: PlanDateNavProps) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const isToday = date === todayIso();
  const isPast = isPastDate(date);
  const primaryLabel = formatDateLabel(date, locale, t("today"), {
    alwaysFull: true,
  });

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <NavIconButton
          label={t("prev_day_aria")}
          onClick={() => onDateChange(shiftDate(date, -1))}
        >
          <ChevronLeft size={20} strokeWidth={2} aria-hidden />
        </NavIconButton>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1">
          {!isToday && !isPast ? (
            <button
              type="button"
              onClick={() => onDateChange(todayIso())}
              className="rounded-full px-2.5 py-0.5 text-xs font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--color-progress-track) 45%, transparent)",
                color: "var(--color-progress)",
                fontFamily: "var(--font-body)",
              }}
            >
              {t("go_today")}
            </button>
          ) : null}
          <p
            className="text-center text-base font-bold leading-tight"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {primaryLabel}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <NavIconButton label={t("calendar_aria")} onClick={onOpenCalendar}>
            <Calendar size={20} strokeWidth={2} aria-hidden />
          </NavIconButton>
          <NavIconButton
            label={t("next_day_aria")}
            onClick={() => onDateChange(shiftDate(date, 1))}
          >
            <ChevronRight size={20} strokeWidth={2} aria-hidden />
          </NavIconButton>
        </div>
      </div>

      {progress && progress.total > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-white/30 pt-3">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span style={{ color: "var(--color-main)" }}>
              {t("progress", { done: progress.done, total: progress.total })}
            </span>
            <span style={{ color: "var(--color-secondary)" }}>
              {t("progress_percent", { percent: progress.percent })}
            </span>
          </div>
          <PlanProgress value={progress.percent} />
        </div>
      ) : null}
    </Card>
  );
}

function NavIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
      style={{ color: "var(--color-main)" }}
      aria-label={label}
    >
      {children}
    </button>
  );
}
