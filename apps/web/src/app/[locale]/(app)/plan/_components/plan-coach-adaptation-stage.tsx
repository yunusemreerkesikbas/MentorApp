"use client";

import "./plan-coach-stage.css";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { CoachPlanAdaptationBriefDto } from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { OnboardingStepLayout } from "@/app/[locale]/(onboarding)/_components/onboarding-step-layout";
import type { PlanAdaptationKnownWeek } from "./plan-coach-adaptation-brief-note";
import { PlanCoachStageNotes } from "./plan-coach-stage-notes";
import { STAGE_TIMING, stageNoteIndex, stageNotes, stagePileDepth } from "./plan-coach-stage-scene";
import { PlanCoachStageSky, PlanCoachStageVideo } from "./plan-coach-stage-sky";

export interface PlanCoachStageProgress {
  done: number;
  total: number;
}

/**
 * "Şehrin üstünde" (DESIGN.md §9.1): the wait between asking the coach for a preview and the
 * preview itself. Puhu does magic over the night city while what the coach read drops in as paper
 * notes, one at a time. Nothing here is a made-up figure: every note is the coach's own evidence,
 * and the bar stays one segment short until the answer lands.
 */
export function PlanCoachAdaptationStage({
  input,
  knownWeek,
  brief,
  progress,
  arrived,
  onDone,
  onCancel,
}: {
  input: CoachPlanAdaptationInput;
  knownWeek: PlanAdaptationKnownWeek;
  /** What the coach read. Null when the wizard was skipped or its read failed. */
  brief: CoachPlanAdaptationBriefDto | null;
  /** The wizard's bar as it stood on its last step; null when the scene opens without the wizard. */
  progress: PlanCoachStageProgress | null;
  /** The answer landed: the scene closes itself and then calls `onDone`. */
  arrived: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("plan");
  const reduceMotion = useReducedMotion() ?? false;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tick, setTick] = useState(0);

  // ponytail: no body scroll lock. The scene fills the screen for a few seconds, and a second
  // lock would have to unwind in step with the wizard's underneath. Add one if it ever scrolls.
  useLayoutEffect(() => {
    const node = dialogRef.current!;
    node.showModal();
    return () => node.close();
  }, []);

  // One clock: a new note every line. Reduced motion keeps it, the notes just do not travel.
  useEffect(() => {
    if (arrived) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), STAGE_TIMING.lineMs);
    return () => window.clearInterval(timer);
  }, [arrived]);

  const done = useEffectEvent(onDone);
  useEffect(() => {
    if (!arrived) return;
    if (reduceMotion) {
      done();
      return;
    }
    const timer = window.setTimeout(() => done(), STAGE_TIMING.arrivalMs);
    return () => window.clearTimeout(timer);
  }, [arrived, reduceMotion]);

  const elapsed = tick * STAGE_TIMING.lineMs;
  const notes = stageNotes(brief);
  const plan = input.source === "PLAN";
  const title = arrived
    ? t(plan ? "coach_adaptation_stage_ready" : "coach_adaptation_stage_ready_lighten")
    : t(plan ? "coach_adaptation_stage_title" : "coach_adaptation_stage_title_lighten");
  const slow = !arrived && elapsed >= STAGE_TIMING.slowAfterMs;
  const sub = slow
    ? t("coach_adaptation_stage_slow")
    : (brief?.groundingLine ??
      (knownWeek.pendingCount > 0 ? t("coach_adaptation_stage_sub") : null));

  // What the week is built from, in the student's own numbers.
  const caption = (
    plan
      ? [
          input.studyWeekdays?.length
            ? t("coach_adaptation_stage_days", { count: input.studyWeekdays.length })
            : null,
          input.minutesPerDay != null
            ? t("coach_adaptation_stage_minutes", { count: input.minutesPerDay })
            : null,
          input.focusSubjects?.length
            ? t("coach_adaptation_stage_subjects", { count: input.focusSubjects.length })
            : null,
        ]
      : [
          knownWeek.pendingCount > 0
            ? t("coach_adaptation_known_pending", { count: knownWeek.pendingCount })
            : null,
        ]
  )
    .filter(Boolean)
    .join(" · ");

  return (
    <dialog
      ref={dialogRef}
      className="plan-coach-night fixed inset-0 m-0 h-dvh w-full max-h-none max-w-none overflow-y-auto border-0 p-0"
      aria-label={title}
      aria-busy={!arrived}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <PlanCoachStageSky />
      {/* Positioned, so it paints over the city. */}
      <div className="relative">
        <OnboardingStepLayout
          root="div"
          progress={
            progress
              ? {
                  done: arrived ? progress.total : progress.done,
                  total: progress.total,
                  from: progress.done,
                }
              : null
          }
          skipLabel={t("coach_adaptation_stage_cancel")}
          onSkip={onCancel}
          heading={
            <div className="flex flex-col items-center gap-1.5 text-center">
              <h2 className="text-[28px] font-black leading-[34px] md:text-[32px] md:leading-10">
                {title}
              </h2>
              {/* Room for two lines, so Puhu does not jump when the line changes. */}
              <p
                aria-live="polite"
                className={`min-h-11 max-w-[440px] text-balance text-[15px] font-semibold leading-[22px] md:min-h-6 md:text-base md:leading-6 ${
                  slow ? "text-[var(--pcs-lamp)]" : "text-[var(--color-secondary)]"
                }`}
              >
                {sub}
              </p>
            </div>
          }
          footer={
            caption ? (
              <p className="px-5 pb-7 pt-2 text-center text-sm font-extrabold text-[var(--pcs-caption)] [text-shadow:0_1px_8px_rgba(3,10,24,0.9)] first-letter:uppercase">
                {caption}
              </p>
            ) : null
          }
        >
          <div className="flex flex-col items-center">
            <PlanCoachStageVideo reduceMotion={reduceMotion} />
            <PlanCoachStageNotes
              notes={notes}
              index={stageNoteIndex(elapsed, notes.length)}
              depth={stagePileDepth(elapsed, notes.length)}
              arrived={arrived}
            />
          </div>
        </OnboardingStepLayout>
      </div>
    </dialog>
  );
}
