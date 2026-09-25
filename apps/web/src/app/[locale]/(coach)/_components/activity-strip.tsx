import { useFormatter, useTranslations } from "next-intl";
import {
  ACTIVITY_TONE_CLASS,
  activityTone,
  seriesDates,
  summarizeActivity,
  type ActivityTone,
} from "./activity-tone";

const CELL = "size-3 shrink-0 rounded-[var(--radius-card)]";

/**
 * A student's recent days of focus, oldest first and today last (DESIGN.md §6.1). One sentence
 * carries the numbers for a screen reader; the cells are its drawing, and a cell's title is a
 * pointer convenience, never the only place its minutes live.
 */
export function ActivityStrip({
  minutes,
  today,
}: {
  minutes: readonly number[];
  /** Europe/Istanbul `yyyy-mm-dd`: the day the last entry stands for. */
  today: string;
}) {
  const t = useTranslations("mentorship");
  const format = useFormatter();
  const dates = seriesDates(minutes.length, today);
  const { activeDays, totalMinutes } = summarizeActivity(minutes);

  return (
    <span
      role="img"
      aria-label={t("activity_strip_label", {
        days: minutes.length,
        activeDays,
        minutes: totalMinutes,
      })}
      className="flex shrink-0 gap-1"
    >
      {minutes.map((value, index) => (
        <span
          key={dates[index]}
          title={t("activity_cell", {
            date: format.dateTime(new Date(`${dates[index]}T00:00:00.000Z`), {
              weekday: "short",
              day: "numeric",
              month: "short",
              timeZone: "UTC",
            }),
            minutes: value,
          })}
          className={`${CELL} ${ACTIVITY_TONE_CLASS[activityTone(value)]}`}
        />
      ))}
    </span>
  );
}

const LEGEND = [
  { tone: 0, key: "activity_legend_none" },
  { tone: 1, key: "activity_legend_low" },
  { tone: 2, key: "activity_legend_mid" },
  { tone: 3, key: "activity_legend_high" },
] as const satisfies readonly { tone: ActivityTone; key: string }[];

/** A day that has not come: a frame, never a zero. */
export const FUTURE_CELL_CLASS = "border-2 border-dashed border-[var(--play-line)]";

/**
 * The key to every strip or grid beside it. Hidden from screen readers: each drawing says its own
 * numbers. `futureLabel` adds the frame a grid draws for the days still to come.
 */
export function ActivityLegend({ title, futureLabel }: { title?: string; futureLabel?: string }) {
  const t = useTranslations("mentorship");
  return (
    <p
      aria-hidden
      className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption font-bold text-[var(--color-secondary)]"
    >
      {title ? <span className="font-extrabold">{title}</span> : null}
      {LEGEND.map(({ tone, key }) => (
        <span key={tone} className="inline-flex items-center gap-1.5">
          <span className={`${CELL} ${ACTIVITY_TONE_CLASS[tone]}`} />
          {t(key)}
        </span>
      ))}
      {futureLabel ? (
        <span className="inline-flex items-center gap-1.5">
          <span className={`${CELL} ${FUTURE_CELL_CLASS}`} />
          {futureLabel}
        </span>
      ) : null}
    </p>
  );
}
