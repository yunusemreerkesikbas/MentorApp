"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card } from "@mentor/ui";

function SetupStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
        {label}
      </span>
      <span
        className="text-sm font-bold tabular-nums text-white"
        style={{
          fontFamily: "var(--font-heading)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export interface SessionSetupSummaryProps {
  focusMinutes: number;
  breakMinutes: number;
  now: number;
}

/**
 * 3-Stat Liquid Glass Summary Card (Focus, Break, Finish Time).
 */
export function SessionSetupSummary({
  focusMinutes,
  breakMinutes,
  now,
}: SessionSetupSummaryProps) {
  const t = useTranslations("session");
  const locale = useLocale();

  const estimatedFinish = new Date(
    now + (focusMinutes + breakMinutes) * 60_000,
  ).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <Card className="flex w-full items-center px-2 py-3 session-liquid-card">
      <SetupStat
        label={t("summary_focus")}
        value={t("minutes_value", { minutes: focusMinutes })}
      />
      <span aria-hidden className="h-7 w-px shrink-0 bg-white/20" />
      <SetupStat
        label={t("summary_break")}
        value={t("minutes_value", { minutes: breakMinutes })}
      />
      <span aria-hidden className="h-7 w-px shrink-0 bg-white/20" />
      <SetupStat label={t("summary_finish")} value={estimatedFinish} />
    </Card>
  );
}
