"use client";

import { useLocale, useTranslations } from "next-intl";

export interface SessionSetupSummaryProps {
  focusMinutes: number;
  breakMinutes: number;
  now: number;
}

/**
 * What pressing "Başla" will do, in one line: focus, break, and when it ends. It used to be a
 * three-cell card with an uppercase caption over every number, which made a sentence look like a
 * dashboard. "bitiş 11:38" rather than "11:38'de biter": the Turkish suffix after a clock time
 * changes with how the minute is read, and one template cannot get it right for every minute.
 */
export function SessionSetupSummary({ focusMinutes, breakMinutes, now }: SessionSetupSummaryProps) {
  const t = useTranslations("session");
  const locale = useLocale();

  const finish = new Date(now + (focusMinutes + breakMinutes) * 60_000).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <p className="text-center text-body-sm font-semibold tabular-nums text-[var(--color-secondary)]">
      {t.rich("summary_line", {
        focus: focusMinutes,
        breakMin: breakMinutes,
        finish,
        b: (chunks) => <span className="font-extrabold text-[var(--color-main)]">{chunks}</span>,
      })}
    </p>
  );
}
