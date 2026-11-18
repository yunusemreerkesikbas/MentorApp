"use client";

import { useEffect, useState } from "react";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { trackSeoLpEvent } from "@/lib/analytics";
import { recordSeoLpSource } from "@/lib/lp-attribution";
import { SeoSignupCta } from "./seo-signup-cta";
import {
  buildDemoWeekPreview,
  type DemoConfig,
  type StudyProgramVariant,
} from "./study-program-lp-presets";

export interface PlanDemoWidgetCopy {
  pill: string;
  scribble: string;
  firstGroupLabel: string;
  hoursLabel: string;
  focusLabel: string;
  note: string;
  saveCta: string;
}

export function PlanDemoWidget({
  variant,
  config,
  copy,
}: {
  variant: StudyProgramVariant;
  config: DemoConfig;
  copy: PlanDemoWidgetCopy;
}) {
  const [fieldId, setFieldId] = useState(config.fields[0]?.id ?? "say");
  const [hourId, setHourId] = useState(config.hours[1]?.id ?? config.hours[0]?.id ?? "2");
  const [focusId, setFocusId] = useState(config.focuses[0]?.id ?? "balanced");

  useEffect(() => {
    recordSeoLpSource(variant);
    trackSeoLpEvent("plan_demo_view", { lp: variant });
  }, [variant]);

  const week = buildDemoWeekPreview(variant, fieldId, hourId, focusId, config.days);

  return (
    <div
      id="plan-demo"
      className="mt-8 rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex min-h-7 items-center rounded-full bg-[var(--landing-pill)] px-3 text-xs font-extrabold text-[var(--landing-pill-ink)]">
          {copy.pill}
        </span>
        <span
          className="text-lg font-bold text-[var(--landing-ink-soft)]"
          style={{ fontFamily: "var(--font-hand), cursive" }}
        >
          {copy.scribble}
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--landing-ink-soft)]">
            {copy.firstGroupLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={copy.firstGroupLabel}>
            {config.fields.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={fieldId === option.id}
                onClick={() => setFieldId(option.id)}
                className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
                  fieldId === option.id
                    ? "border-transparent bg-[var(--landing-ink)] text-[var(--landing-paper)]"
                    : "border-[var(--landing-paper-line)] bg-transparent text-[var(--landing-ink)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--landing-ink-soft)]">
            {copy.hoursLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={copy.hoursLabel}>
            {config.hours.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={hourId === option.id}
                onClick={() => setHourId(option.id)}
                className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
                  hourId === option.id
                    ? "border-transparent bg-[var(--landing-ink)] text-[var(--landing-paper)]"
                    : "border-[var(--landing-paper-line)] bg-transparent text-[var(--landing-ink)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--landing-ink-soft)]">
            {copy.focusLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={copy.focusLabel}>
            {config.focuses.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={focusId === option.id}
                onClick={() => setFocusId(option.id)}
                className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
                  focusId === option.id
                    ? "border-transparent bg-[var(--landing-ink)] text-[var(--landing-paper)]"
                    : "border-[var(--landing-paper-line)] bg-transparent text-[var(--landing-ink)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-7">
        {week.map((item) => (
          <div
            key={item.day}
            className="flex flex-col rounded-xl border border-[var(--landing-paper-line)] bg-[var(--landing-paper)] p-3"
          >
            <span className="text-xs font-black text-[var(--landing-ink)]">{item.day}</span>
            <span className="mt-2 rounded-lg bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--landing-ink)]">
              {item.tasks[0]}
            </span>
            <span className="mt-1.5 rounded-lg bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--landing-ink-soft)]">
              {item.tasks[1]}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-[var(--landing-paper-line)] pt-5 sm:flex-row sm:items-center">
        <p className="text-xs font-semibold text-[var(--landing-ink-soft)]">{copy.note}</p>
        <SeoSignupCta
          source={variant}
          location="demo"
          className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
        >
          {copy.saveCta}
        </SeoSignupCta>
      </div>
    </div>
  );
}
