"use client";

import "./plan-demo.css";
import { useEffect, useState } from "react";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { trackSeoLpEvent } from "@/lib/analytics";
import { recordSeoLpSource } from "@/lib/lp-attribution";
import { SeoSignupCta } from "./seo-signup-cta";
import {
  buildDemoWeekPreview,
  type DemoConfig,
  type DemoOption,
  type StudyProgramVariant,
} from "./study-program-lp-presets";

export interface PlanDemoWidgetCopy {
  pill: string;
  firstGroupLabel: string;
  hoursLabel: string;
  focusLabel: string;
  note: string;
  saveCta: string;
}

/** One field of chips: paper pills, `on` in ink. */
function ChipGroup({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: DemoOption[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="plan-field">
      <p className="plan-label">{label}</p>
      <div className="plan-chips" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onPick(option.id)}
            className="plan-chip"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The live plan demo. It sits inside a pinned `PaperNote` (the page titles the note), so it draws
 * no card of its own.
 */
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
    <div id="plan-demo" className="plan-demo">
      <span className="plan-pill">{copy.pill}</span>

      <div className="plan-fields">
        <ChipGroup label={copy.firstGroupLabel} options={config.fields} value={fieldId} onPick={setFieldId} />
        <ChipGroup label={copy.hoursLabel} options={config.hours} value={hourId} onPick={setHourId} />
        <ChipGroup label={copy.focusLabel} options={config.focuses} value={focusId} onPick={setFocusId} />
      </div>

      <div className="plan-week">
        {week.map((item) => (
          <div key={item.day} className="plan-day">
            <span className="plan-day-name">{item.day}</span>
            <span className="plan-task is-first">{item.tasks[0]}</span>
            <span className="plan-task">{item.tasks[1]}</span>
          </div>
        ))}
      </div>

      <div className="plan-foot">
        <p className="plan-note">{copy.note}</p>
        <SeoSignupCta source={variant} location="demo" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
          {copy.saveCta}
        </SeoSignupCta>
      </div>
    </div>
  );
}
