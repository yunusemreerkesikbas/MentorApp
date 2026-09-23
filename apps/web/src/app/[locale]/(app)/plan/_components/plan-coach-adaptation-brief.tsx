"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  CoachPlanAdaptationBriefDto,
  ExamType,
  ExamVariant,
} from "@mentor/types";
import { coachPlanAdaptationSchema, type CoachPlanAdaptationInput } from "@mentor/validation";
import { Button } from "@mentor/ui";
import { PlayFooter } from "@/components/onboarding-play/play-footer";
import { PuhuBubble } from "@/components/onboarding-play/play-heading";
import { useExamSubjectTaxonomy } from "@/lib/use-exam-subject-taxonomy";
import { OnboardingDirectionProvider } from "@/app/[locale]/(onboarding)/_components/onboarding-direction";
import { OnboardingStepLayout } from "@/app/[locale]/(onboarding)/_components/onboarding-step-layout";
import {
  PLAN_ADAPTATION_SUBJECT_CAP,
  formatKnownBrief,
  isMinuteChoice,
  seedBriefSubjects,
  type PlanAdaptationKnownWeek,
} from "./plan-coach-adaptation-brief-note";
import {
  BriefDaysStep,
  BriefMinutesStep,
  BriefNoteStep,
  BriefSubjectsStep,
} from "./plan-coach-adaptation-brief-steps";

export interface PlanAdaptationBriefProfile {
  examType: ExamType | null;
  examVariant: ExamVariant | null;
  dailyFocusGoalMinutes: number | null;
}

const BRIEF_STEPS = ["days", "minutes", "subjects", "note"] as const;

export function PlanCoachAdaptationBrief({
  knownWeek,
  brief,
  profile,
  onComplete,
  onClose,
}: {
  knownWeek: PlanAdaptationKnownWeek;
  /** The coach's reading of the student's data; null while loading or when it failed. */
  brief: CoachPlanAdaptationBriefDto | null;
  profile: PlanAdaptationBriefProfile;
  onComplete: (input: CoachPlanAdaptationInput) => void;
  onClose: () => void;
}) {
  const t = useTranslations("plan");
  const tExam = useTranslations("profile.exam_settings");
  const taxonomy = useExamSubjectTaxonomy();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const suggestion = brief?.suggestion ?? null;

  // The student's answer always wins; until there is one, the coach's reading fills the blank.
  const [daysOverride, setDaysOverride] = useState<number | null | undefined>(undefined);
  const days = daysOverride !== undefined ? daysOverride : (suggestion?.days ?? null);
  const goalMinutes = isMinuteChoice(profile.dailyFocusGoalMinutes)
    ? profile.dailyFocusGoalMinutes
    : null;
  const suggestedMinutes = suggestion?.minutesPerDay ?? null;
  const rhythmMinutes =
    goalMinutes === null && isMinuteChoice(suggestedMinutes) ? suggestedMinutes : null;
  const [minutesOverride, setMinutesOverride] = useState<number | null | undefined>(undefined);
  const minutes = minutesOverride !== undefined ? minutesOverride : (goalMinutes ?? rhythmMinutes);
  const coachSubjects = suggestion?.focusSubjects;
  const suggested = useMemo(
    () => new Set((coachSubjects ?? []).map((name) => name.toLocaleLowerCase("tr-TR"))),
    [coachSubjects],
  );
  const seededSubjects = useMemo(
    () =>
      taxonomy.loaded
        ? seedBriefSubjects(
            taxonomy.subjects.map((subject) => subject.name),
            coachSubjects?.length ? coachSubjects : knownWeek.subjects,
          )
        : [],
    [taxonomy.loaded, taxonomy.subjects, coachSubjects, knownWeek.subjects],
  );
  const [subjectOverride, setSubjectOverride] = useState<string[] | null>(null);
  const subjects = subjectOverride ?? seededSubjects;
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const steps = useMemo(
    () =>
      BRIEF_STEPS.filter(
        (step) => step !== "subjects" || !taxonomy.loaded || taxonomy.subjects.length > 0,
      ),
    [taxonomy.loaded, taxonomy.subjects.length],
  );
  const safeIndex = Math.min(index, steps.length - 1);
  const step = steps[safeIndex] ?? "days";

  const exam = profile.examType
    ? profile.examVariant
      ? `${profile.examType} · ${tExam(`variant.${profile.examVariant}`)}`
      : profile.examType
    : null;
  const known = formatKnownBrief({
    exam,
    goal:
      profile.dailyFocusGoalMinutes != null
        ? t("coach_adaptation_known_goal", { count: profile.dailyFocusGoalMinutes })
        : null,
    pending:
      knownWeek.pendingCount > 0
        ? t("coach_adaptation_known_pending", { count: knownWeek.pendingCount })
        : null,
  });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function go(next: number) {
    setDirection(next > safeIndex ? 1 : -1);
    setIndex(next);
    setError(null);
  }

  function submit(freeNote: string) {
    const trimmed = freeNote.trim();
    const focusSubjects = subjects.slice(0, PLAN_ADAPTATION_SUBJECT_CAP);
    const payload = {
      source: "PLAN" as const,
      ...(trimmed ? { note: trimmed } : {}),
      ...(days != null ? { days } : {}),
      ...(minutes != null ? { minutesPerDay: minutes } : {}),
      ...(focusSubjects.length > 0 ? { focusSubjects } : {}),
    };
    const parsed = coachPlanAdaptationSchema.safeParse(payload);
    if (!parsed.success || parsed.data.source !== "PLAN") {
      setError(t("coach_adaptation_note_invalid"));
      return;
    }
    onComplete({
      source: "PLAN",
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
      ...(parsed.data.days != null ? { days: parsed.data.days } : {}),
      ...(parsed.data.minutesPerDay != null
        ? { minutesPerDay: parsed.data.minutesPerDay }
        : {}),
      ...(parsed.data.focusSubjects?.length
        ? { focusSubjects: parsed.data.focusSubjects }
        : {}),
    });
  }

  function continueStep() {
    if (safeIndex >= steps.length - 1) {
      submit(note);
      return;
    }
    go(safeIndex + 1);
  }

  function skipStep() {
    if (step === "days") setDaysOverride(null);
    if (step === "minutes") setMinutesOverride(null);
    if (step === "subjects") setSubjectOverride([]);
    if (safeIndex >= steps.length - 1) {
      submit("");
      return;
    }
    go(safeIndex + 1);
  }

  function toggleSubject(name: string) {
    setSubjectOverride((current) => {
      const base = current ?? seededSubjects;
      if (base.includes(name)) return base.filter((item) => item !== name);
      if (base.length >= PLAN_ADAPTATION_SUBJECT_CAP) return base;
      return [...base, name];
    });
  }

  const title =
    step === "days"
      ? t("coach_adaptation_days_label")
      : step === "minutes"
        ? t("coach_adaptation_minutes_label")
        : step === "subjects"
          ? t("coach_adaptation_subjects_label")
          : t("coach_adaptation_note_label");
  // The first thing Puhu says is what the plan will be built from, once the coach has read it.
  const sub =
    step === "days"
      ? (brief?.groundingLine ?? known ?? undefined)
      : step === "subjects"
        ? t("coach_adaptation_subjects_hint")
        : undefined;

  return (
    <OnboardingDirectionProvider value={direction}>
      <div className="fixed inset-0 z-[80] overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
        <OnboardingStepLayout
          key={step}
          root="div"
          progress={{ done: safeIndex + 1, total: steps.length + 1 }}
          onBack={safeIndex === 0 ? onClose : () => go(safeIndex - 1)}
          skipLabel={t("coach_adaptation_skip")}
          onSkip={skipStep}
          heading={<PuhuBubble title={title} sub={sub} />}
          footer={
            <PlayFooter error={error}>
              <Button
                fullWidth
                onClick={continueStep}
                disabled={step === "subjects" && !taxonomy.loaded}
              >
                {step === "note" ? t("coach_adaptation_generate") : t("coach_adaptation_continue")}
              </Button>
            </PlayFooter>
          }
        >
          {step === "days" ? (
            <BriefDaysStep
              title={title}
              days={days}
              rhythmDays={suggestion?.days ?? null}
              onSelect={setDaysOverride}
            />
          ) : null}
          {step === "minutes" ? (
            <BriefMinutesStep
              title={title}
              minutes={minutes}
              goalMinutes={goalMinutes}
              rhythmMinutes={rhythmMinutes}
              onSelect={setMinutesOverride}
            />
          ) : null}
          {step === "subjects" ? (
            <BriefSubjectsStep
              title={title}
              loaded={taxonomy.loaded}
              options={taxonomy.subjects}
              selected={subjects}
              suggested={suggested}
              onToggle={toggleSubject}
            />
          ) : null}
          {step === "note" ? <BriefNoteStep note={note} onChange={setNote} /> : null}
        </OnboardingStepLayout>
      </div>
    </OnboardingDirectionProvider>
  );
}
