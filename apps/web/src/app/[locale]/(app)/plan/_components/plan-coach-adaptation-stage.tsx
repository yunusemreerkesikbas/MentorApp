"use client";

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { CoachPlanAdaptationBriefDto } from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { PuhuBubble } from "@/components/onboarding-play/play-heading";
import { PUHU_MOTION_FRAMES } from "@/lib/onboarding-assets";
import { OnboardingStepLayout } from "@/app/[locale]/(onboarding)/_components/onboarding-step-layout";
import {
  planWindowToday,
  type PlanAdaptationKnownWeek,
} from "./plan-coach-adaptation-brief-note";
import { PlanCoachStageBoard } from "./plan-coach-stage-board";
import {
  STAGE_TIMING,
  buildStageScene,
  stageBeat,
  stageGaze,
} from "./plan-coach-stage-scene";

const GAZE_FRAME = {
  left: PUHU_MOTION_FRAMES.gazeLeft,
  right: PUHU_MOTION_FRAMES.gazeRight,
  down: PUHU_MOTION_FRAMES.lookDown,
} as const;

export interface PlanCoachStageProgress {
  done: number;
  total: number;
}

/**
 * "Hafta kuruluyor" (DESIGN.md §9.1): the wait between asking the coach for a preview and the
 * preview itself. The student's own answers are dealt onto the week as blocks that keep changing
 * places while Puhu says what the coach read. Nothing here is a made-up progress figure: the bar
 * stays one segment short until the answer lands.
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
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [days] = useState(planWindowToday);
  const [tick, setTick] = useState(0);

  // ponytail: no body scroll lock. The scene fills the screen for a few seconds, and a second
  // lock would have to unwind in step with the wizard's underneath. Add one if it ever scrolls.
  useLayoutEffect(() => {
    const node = dialogRef.current!;
    node.showModal();
    return () => node.close();
  }, []);

  // One clock for the lines and the blocks; the answer stops it.
  useEffect(() => {
    if (arrived) return;
    const timer = window.setInterval(
      () => setTick((value) => value + 1),
      STAGE_TIMING.beatMs,
    );
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

  const elapsed = tick * STAGE_TIMING.beatMs;
  const scene = buildStageScene({ days, input, knownWeek });
  // Reduced motion keeps the first arrangement; the lines still change, without the travel.
  const beat = reduceMotion ? 0 : tick;
  const slots = stageBeat(scene, beat);

  const title = t(
    input.source === "PLAN"
      ? "coach_adaptation_stage_title"
      : "coach_adaptation_stage_title_lighten",
  );
  // Said once in order, and the last one stays: a live region that kept talking would be noise.
  const lines = brief
    ? [brief.groundingLine, ...brief.evidence.map((item) => item.summary)].filter(
        (line): line is string => Boolean(line),
      )
    : [];
  const line =
    lines[Math.min(Math.floor(elapsed / STAGE_TIMING.lineMs), lines.length - 1)];
  const sub =
    elapsed >= STAGE_TIMING.slowAfterMs
      ? t("coach_adaptation_stage_slow")
      : (line ??
        (knownWeek.pendingCount > 0 ? t("coach_adaptation_stage_sub") : undefined));

  // What the board is built from, in the student's own numbers.
  const caption = (
    input.source === "PLAN"
      ? [
          input.studyWeekdays?.length
            ? t("coach_adaptation_stage_days", {
                count: input.studyWeekdays.length,
              })
            : null,
          input.minutesPerDay != null
            ? t("coach_adaptation_stage_minutes", { count: input.minutesPerDay })
            : null,
          input.focusSubjects?.length
            ? t("coach_adaptation_stage_subjects", {
                count: input.focusSubjects.length,
              })
            : null,
        ]
      : [
          knownWeek.pendingCount > 0
            ? t("coach_adaptation_known_pending", {
                count: knownWeek.pendingCount,
              })
            : null,
        ]
  )
    .filter(Boolean)
    .join(" · ");

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-0 h-dvh w-full max-h-none max-w-none overflow-y-auto border-0 p-0"
      aria-label={title}
      aria-busy={!arrived}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <OnboardingStepLayout
        root="div"
        center
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
          // Room for three lines, so the board does not jump when the line changes.
          <div className="min-h-32">
            <PuhuBubble
              title={title}
              sub={sub}
              idleFrame={
                arrived ? undefined : GAZE_FRAME[stageGaze(scene, slots, beat)]
              }
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4 pb-12">
          <PlanCoachStageBoard
            days={days}
            scene={scene}
            slots={slots}
            arrived={arrived}
          />
          {caption ? (
            <p className="text-center text-sm font-bold text-[var(--color-secondary)] first-letter:uppercase">
              {caption}
            </p>
          ) : null}
        </div>
      </OnboardingStepLayout>
    </dialog>
  );
}
