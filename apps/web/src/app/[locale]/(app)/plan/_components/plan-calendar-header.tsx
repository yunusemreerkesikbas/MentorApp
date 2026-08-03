"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useLocale, useTranslations } from "next-intl";
import { SegmentPillControl } from "@/components/segment-pill-control";
import { PlanWeekNavButton } from "./plan-week-nav-button";
import {
  formatDateLabel,
  formatMonthTitle,
  formatWeekRangeLabel,
  weekDates,
  type PlanCalendarScale,
} from "./plan-utils";

const SCALES: PlanCalendarScale[] = ["day", "week", "month"];

/** Period title + ‹ › stepping + the Gün/Hafta/Ay segment (reference: calendar toolbar). */
export function PlanCalendarHeader({
  scale,
  selectedDate,
  weekStartDate,
  monthAnchor,
  onScaleChange,
  onStep,
  onToday,
}: {
  scale: PlanCalendarScale;
  selectedDate: string;
  weekStartDate: string;
  monthAnchor: string;
  onScaleChange: (scale: PlanCalendarScale) => void;
  /** −1 / +1 period at the current scale. */
  onStep: (direction: -1 | 1) => void;
  onToday: () => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();

  const title =
    scale === "day"
      ? formatDateLabel(selectedDate, locale, t("today"), { alwaysFull: true })
      : scale === "week"
        ? formatWeekRangeLabel(weekStartDate, weekDates(weekStartDate)[6]!, locale)
        : formatMonthTitle(monthAnchor, locale);

  const scaleItems = SCALES.map((option) => ({
    id: option,
    // A 7-column hour grid is unusable at 375px, so "Hafta" reads as the day agenda
    // on mobile — same state, honest label.
    label:
      option === "week" ? (
        <>
          <span className="lg:hidden">{t("calendar_scale_agenda")}</span>
          <span className="hidden lg:inline">{t("calendar_scale_week")}</span>
        </>
      ) : (
        t(`calendar_scale_${option}`)
      ),
  }));

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-1">
        <h2
          className={`min-w-0 flex-1 text-base font-bold lg:flex-none lg:truncate lg:text-lg ${
            // Hafta on mobile: the date strip above already shows this exact range.
            scale === "week" ? "hidden lg:block" : ""
          }`}
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onToday}
            className="mr-1 min-h-9 cursor-pointer rounded-full px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
            style={{
              color: "var(--color-main)",
              backgroundColor: "var(--color-surface-container)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {t("go_today")}
          </button>
          <PlanWeekNavButton label={t(`calendar_prev_${scale}`)} compact onClick={() => onStep(-1)}>
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          </PlanWeekNavButton>
          <PlanWeekNavButton label={t(`calendar_next_${scale}`)} compact onClick={() => onStep(1)}>
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          </PlanWeekNavButton>
        </div>
      </div>

      <SegmentPillControl
        items={scaleItems}
        value={scale}
        onChange={(id) => onScaleChange(id as PlanCalendarScale)}
        ariaLabel={t("calendar_scale_aria")}
        layoutId="plan-calendar-scale-pill"
        className="md:self-auto"
      />
    </div>
  );
}
