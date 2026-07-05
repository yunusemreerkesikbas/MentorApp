"use client";

import { useTranslations } from "next-intl";
import { Chip } from "@mentor/ui";

interface AnalizRecordGaugeProps {
  latestNet: number;
  recordNet: number;
  isNewRecord: boolean;
}

/**
 * Semicircle personal-record gauge — values from API only (never FE net calc).
 */
export function AnalizRecordGauge({
  latestNet,
  recordNet,
  isNewRecord,
}: AnalizRecordGaugeProps) {
  const t = useTranslations("analysis.gauge");

  const pct =
    recordNet > 0 ? Math.min(100, Math.round((latestNet / recordNet) * 100)) : 0;
  const gap = Math.max(0, recordNet - latestNet);
  const gapLabel = gap.toFixed(2);

  const cx = 100;
  const cy = 96;
  const r = 72;
  const startX = cx - r;
  const endX = cx + r;
  const arcPath = `M ${startX} ${cy} A ${r} ${r} 0 0 1 ${endX} ${cy}`;
  const circumference = Math.PI * r;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <svg viewBox="0 0 200 110" className="h-[110px] w-full max-w-[240px]" aria-hidden>
        <path
          d={arcPath}
          fill="none"
          stroke="var(--color-progress-track)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={arcPath}
          fill="none"
          stroke="var(--color-progress)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          className="motion-reduce:transition-none"
          style={{ transition: "stroke-dashoffset 0.4s ease-out" }}
        />
      </svg>
      <div className="flex flex-col items-center gap-1 text-center">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {latestNet.toFixed(2)}
        </span>
        {isNewRecord ? (
          <Chip>{t("new_record")}</Chip>
        ) : gap <= 0 ? (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("at_record")}
          </p>
        ) : (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("to_record", { delta: gapLabel })}
          </p>
        )}
      </div>
    </div>
  );
}

export function AnalizRecordGaugeTeaser() {
  const t = useTranslations("analysis.gauge");

  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span
        className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
          color: "var(--color-chip-text)",
        }}
      >
        {t("teaser_title")}
      </span>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("teaser_desc")}
      </p>
    </div>
  );
}
