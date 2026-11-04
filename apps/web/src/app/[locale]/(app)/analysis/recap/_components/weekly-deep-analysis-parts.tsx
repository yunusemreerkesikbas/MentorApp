"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { WeeklyDeepAnalysisDto } from "@mentor/types";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";

export const EYEBROW = "text-sm font-extrabold text-[var(--color-secondary)]";

const CHIP = "inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-sm font-extrabold tabular-nums";
const CHIP_UP = `${CHIP} bg-[color-mix(in_srgb,var(--color-success)_14%,var(--color-surface))] text-[var(--color-success)]`;
// A drop is grey, never red: a week down is not a failure (AGENTS.md §0 tone).
const CHIP_DOWN = `${CHIP} bg-[var(--play-track)] text-[var(--color-secondary)]`;
export const SUCCESS_CHIP = CHIP_UP;
export const MUTED_CHIP = `${CHIP} border border-dashed border-[var(--play-line)] text-[var(--color-secondary)]`;

/** "+2" / "−2" with a true minus, the same in every chip. */
export function signed(n: number, text: string) {
  return `${n > 0 ? "+" : "−"}${text}`;
}

export function DeltaChip({ delta, className = "", children }: { delta: number; className?: string; children: ReactNode }) {
  const Icon = delta > 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`${delta > 0 ? CHIP_UP : CHIP_DOWN} ${className}`}>
    <Icon className="size-3.5" strokeWidth={3} aria-hidden />{children}
  </span>;
}

/** Previous week drawn lighter than this week on the same track, so the two read apart by lightness. */
const PREVIOUS_FILL = "bg-[color-mix(in_srgb,var(--color-progress)_40%,var(--play-track))]";

export function WeeklyDeepAnalysisRhythm({ metrics, className = "" }: { metrics: WeeklyDeepAnalysisDto["metrics"]; className?: string }) {
  const t = useTranslations("analysis.report");
  if (!metrics.length) return null;
  return <section className={`${PANEL_CARD} flex flex-col gap-4 ${className}`} aria-labelledby="deep-rhythm-title">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="deep-rhythm-title" className={PANEL_CARD_TITLE}>{t("rhythm")}</h2>
      <span className="flex gap-3 text-caption text-[var(--color-secondary)]" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><i className={`size-2.5 rounded-full ${PREVIOUS_FILL}`} />{t("legend_previous")}</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-[var(--color-progress)]" />{t("legend_current")}</span>
      </span>
    </div>
    <ul className="flex flex-col gap-5">{metrics.map((m) => {
      const value = (count: number) => t(`metric_value_${m.id}`, { count });
      const max = Math.max(m.current, m.previous ?? 0, 1);
      const label = t(`metric_${m.id}`);
      return <li key={m.id} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-sm font-extrabold text-[var(--color-main)]">{label}</h3>
          {m.delta ? <DeltaChip delta={m.delta}>{signed(m.delta, value(Math.abs(m.delta)))}</DeltaChip> : null}
          <span className="min-w-16 whitespace-nowrap text-right text-xl font-black tabular-nums text-[var(--color-main)]">{value(m.current)}</span>
        </div>
        <div role="img" className="flex flex-col gap-1.5" aria-label={m.previous === null
          ? t("metric_aria_new", { label, current: value(m.current) })
          : t("metric_aria", { label, current: value(m.current), previous: value(m.previous) })}>
          {m.previous !== null ? <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--play-track)]">
            <span className={`block h-full rounded-full ${PREVIOUS_FILL}`} style={{ width: `${(m.previous / max) * 100}%` }} />
          </span> : null}
          <span className="block h-2 overflow-hidden rounded-full bg-[var(--play-track)]">
            <span className="block h-full rounded-full bg-[var(--color-progress)]" style={{ width: `${(m.current / max) * 100}%` }} />
          </span>
        </div>
        <p className="text-caption tabular-nums text-[var(--color-secondary)]">
          {m.previous === null ? t("previous_missing") : t("previous_value", { value: value(m.previous) })}
        </p>
      </li>;
    })}</ul>
  </section>;
}
