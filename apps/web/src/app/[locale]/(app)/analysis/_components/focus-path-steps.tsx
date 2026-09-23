"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  CalendarCheck,
  Check,
  Lightbulb,
  PencilLine,
  Play,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import type { FocusStep, FocusStepKey, FocusStepState } from "./focus-path-model";

/** Node sizes and tones are the panel's path (DESIGN.md §6.1), so both screens draw one language. */
const NODE_BASE = "relative grid shrink-0 place-items-center rounded-full";
const NODE_TONE: Record<FocusStepState, string> = {
  done: "size-12 bg-[var(--play-cta)] text-[var(--play-cta-ink)] shadow-[0_4px_0_var(--play-cta-edge)] sm:size-14",
  current:
    "size-16 bg-[var(--play-cta)] text-[var(--play-cta-ink)] shadow-[0_5px_0_var(--play-cta-edge),0_0_0_8px_var(--play-selected)] sm:size-[72px]",
  upcoming:
    "size-12 bg-[var(--play-track)] text-[var(--color-secondary)] shadow-[0_4px_0_color-mix(in_srgb,var(--play-track),var(--color-main)_12%)] sm:size-14",
};
const NODE_DASHED =
  "size-12 border-2 border-dashed border-[color-mix(in_srgb,var(--color-secondary)_45%,transparent)] bg-[var(--color-surface)] text-[var(--color-secondary)] sm:size-14";

const STEP_ICON: Record<FocusStepKey, LucideIcon> = {
  signal: Lightbulb,
  planned: CalendarCheck,
  practiced: RotateCcw,
  measured: PencilLine,
};

/**
 * The improvement loop as the panel draws a day: done nodes filled, the next step big with its
 * "Sıradaki" tip, the rest on the track. Status only; the single action is the ledge below.
 */
export function FocusPathSteps({
  steps,
  meta,
}: {
  steps: FocusStep[];
  meta: Record<FocusStepKey, string | null>;
}) {
  const t = useTranslations("analysis.focus_path");

  return (
    <ol className="flex pt-9" aria-label={t("path_label")}>
      {steps.map((step, index) => {
        const Icon =
          step.state === "done"
            ? Check
            : step.state === "current" && step.key === "practiced"
              ? Play
              : STEP_ICON[step.key];
        return (
          <PathStop
            key={step.key}
            first={index === 0}
            reached={step.state !== "upcoming"}
            current={step.state === "current"}
            title={t(`step_${step.key}`)}
            meta={meta[step.key]}
            state={t(`state_${step.state}`)}
            node={
              <span className={`${NODE_BASE} ${NODE_TONE[step.state]}`} aria-hidden>
                {step.state === "current" ? <NextTip label={t("next")} /> : null}
                <Icon
                  className={step.state === "current" ? "size-7" : "size-6"}
                  strokeWidth={step.state === "done" ? 3 : 2.2}
                  fill={step.state === "current" && Icon === Play ? "currentColor" : "none"}
                />
              </span>
            }
          />
        );
      })}
    </ol>
  );
}

/** Before the first exam: one dashed "İlk deneme" stop, then the loop waiting on the track. */
export function EmptyFocusPath() {
  const t = useTranslations("analysis.focus_path");
  const upcoming: FocusStepKey[] = ["signal", "planned", "practiced"];

  return (
    <ol className="flex pt-9" aria-label={t("path_label")}>
      <PathStop
        first
        reached={false}
        current
        title={t("step_first_exam")}
        meta={t("step_first_exam_meta")}
        state={t("state_current")}
        node={
          <span className={`${NODE_BASE} ${NODE_DASHED}`} aria-hidden>
            <PencilLine className="size-6" strokeWidth={2.2} />
          </span>
        }
      />
      {upcoming.map((key) => {
        const Icon = STEP_ICON[key];
        return (
          <PathStop
            key={key}
            first={false}
            reached={false}
            current={false}
            title={t(`step_${key}`)}
            meta={null}
            state={t("state_upcoming")}
            node={
              <span className={`${NODE_BASE} ${NODE_TONE.upcoming}`} aria-hidden>
                <Icon className="size-6" strokeWidth={2.2} />
              </span>
            }
          />
        );
      })}
    </ol>
  );
}

function NextTip({ label }: { label: string }) {
  return (
    <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-card)] border-2 border-[var(--play-line)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-black tracking-[0.02em] text-[var(--play-selected-ink)]">
      {label}
    </span>
  );
}

/** One stop; it draws the connector from the previous stop, so nothing is measured. */
function PathStop({
  first,
  reached,
  current,
  node,
  title,
  meta,
  state,
}: {
  first: boolean;
  reached: boolean;
  current: boolean;
  node: ReactNode;
  title: string;
  meta: string | null;
  state: string;
}) {
  return (
    <li
      aria-current={current ? "step" : undefined}
      className="relative flex min-w-0 flex-1 flex-col items-center gap-2 px-1 text-center"
    >
      {first ? null : (
        <span
          aria-hidden
          className={`absolute right-1/2 top-[30px] z-0 h-1 w-full rounded-full sm:top-[34px] ${reached ? "bg-[var(--play-cta)]" : "bg-[var(--play-track)]"}`}
        />
      )}
      <div className="relative z-[1] flex h-16 items-center sm:h-[72px]">{node}</div>
      <span className="line-clamp-2 w-full text-caption font-extrabold leading-tight text-[var(--color-main)]">
        {title}
      </span>
      {meta ? (
        <span className="-mt-1 line-clamp-2 w-full text-xs font-semibold leading-tight text-[var(--color-secondary)]">
          {meta}
        </span>
      ) : null}
      <span className="sr-only">{state}</span>
    </li>
  );
}
