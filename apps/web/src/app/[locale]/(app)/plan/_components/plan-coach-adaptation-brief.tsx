"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ExamType, ExamVariant } from "@mentor/types";
import { coachPlanAdaptationSchema, type CoachPlanAdaptationInput } from "@mentor/validation";
import { Button } from "@mentor/ui";
import { PlayGridCard, PlayOptionRow } from "@/components/onboarding-play/play-choice";
import { PlayFooter } from "@/components/onboarding-play/play-footer";
import { PuhuBubble } from "@/components/onboarding-play/play-heading";
import { useExamSubjectTaxonomy } from "@/lib/use-exam-subject-taxonomy";
import { OnboardingDirectionProvider } from "@/app/[locale]/(onboarding)/_components/onboarding-direction";
import { OnboardingStepLayout } from "@/app/[locale]/(onboarding)/_components/onboarding-step-layout";
import {
  PLAN_ADAPTATION_DAY_CHOICES,
  PLAN_ADAPTATION_MINUTE_CHOICES,
  PLAN_ADAPTATION_NOTE_MAX,
  PLAN_ADAPTATION_SUBJECT_CAP,
  formatKnownBrief,
  isMinuteChoice,
  seedBriefSubjects,
  type PlanAdaptationKnownWeek,
} from "./plan-coach-adaptation-brief-note";

export interface PlanAdaptationBriefProfile {
  examType: ExamType | null;
  examVariant: ExamVariant | null;
  dailyFocusGoalMinutes: number | null;
}

const BRIEF_STEPS = ["days", "minutes", "subjects", "note"] as const;

export function PlanCoachAdaptationBrief({
  knownWeek,
  profile,
  onComplete,
  onClose,
}: {
  knownWeek: PlanAdaptationKnownWeek;
  profile: PlanAdaptationBriefProfile;
  onComplete: (input: CoachPlanAdaptationInput) => void;
  onClose: () => void;
}) {
  const t = useTranslations("plan");
  const tExam = useTranslations("profile.exam_settings");
  const taxonomy = useExamSubjectTaxonomy();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [days, setDays] = useState<number | null>(null);
  const profileMinutes = isMinuteChoice(profile.dailyFocusGoalMinutes)
    ? profile.dailyFocusGoalMinutes
    : null;
  const [minutesOverride, setMinutesOverride] = useState<number | null | undefined>(undefined);
  const minutes = minutesOverride !== undefined ? minutesOverride : profileMinutes;
  const seededSubjects = useMemo(
    () =>
      taxonomy.loaded
        ? seedBriefSubjects(
            taxonomy.subjects.map((subject) => subject.name),
            knownWeek.subjects,
          )
        : [],
    [taxonomy.loaded, taxonomy.subjects, knownWeek.subjects],
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
    if (step === "days") setDays(null);
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
  const sub =
    step === "days"
      ? (known ?? undefined)
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
            <div role="radiogroup" aria-label={title} className="grid grid-cols-2 gap-3">
              {PLAN_ADAPTATION_DAY_CHOICES.map((choice, choiceIndex) => (
                <PlayGridCard
                  key={choice}
                  index={choiceIndex}
                  label={t("coach_adaptation_days_unit")}
                  art={<ChoiceFigure value={String(choice)} selected={days === choice} />}
                  selected={days === choice}
                  onSelect={() => setDays(choice)}
                />
              ))}
            </div>
          ) : null}
          {step === "minutes" ? (
            <div role="radiogroup" aria-label={title} className="grid grid-cols-2 gap-3 pt-3">
              {PLAN_ADAPTATION_MINUTE_CHOICES.map((choice, choiceIndex) => (
                <PlayGridCard
                  key={choice}
                  index={choiceIndex}
                  label={t("coach_adaptation_minutes_unit")}
                  badge={choice === profileMinutes ? t("coach_adaptation_minutes_badge") : undefined}
                  art={<ChoiceFigure value={String(choice)} selected={minutes === choice} />}
                  selected={minutes === choice}
                  onSelect={() => setMinutesOverride(choice)}
                />
              ))}
            </div>
          ) : null}
          {step === "subjects" ? (
            taxonomy.loaded ? (
              <div role="group" aria-label={title} className="flex flex-col gap-3">
                {taxonomy.subjects.map((subject, subjectIndex) => (
                  <PlayOptionRow
                    key={subject.slug}
                    multiple
                    index={subjectIndex}
                    label={subject.name}
                    selected={subjects.includes(subject.name)}
                    disabled={
                      !subjects.includes(subject.name) &&
                      subjects.length >= PLAN_ADAPTATION_SUBJECT_CAP
                    }
                    onSelect={() => toggleSubject(subject.name)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-base font-medium text-[var(--color-secondary)]">{t("loading")}</p>
            )
          ) : null}
          {step === "note" ? (
            <label className="flex flex-col gap-2">
              <span className="sr-only">{t("coach_adaptation_note_label")}</span>
              <textarea
                value={note}
                onChange={(event) =>
                  setNote(event.target.value.slice(0, PLAN_ADAPTATION_NOTE_MAX))
                }
                placeholder={t("coach_adaptation_note_placeholder")}
                maxLength={PLAN_ADAPTATION_NOTE_MAX}
                rows={4}
                className="min-h-32 w-full resize-y rounded-[var(--play-radius)] border-2 border-[var(--play-line)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-main)] outline-none focus:border-[var(--play-cta)]"
              />
              <span className="text-sm font-medium text-[var(--color-secondary)]">
                {t("coach_adaptation_note_hint", { count: note.length })}
              </span>
            </label>
          ) : null}
        </OnboardingStepLayout>
      </div>
    </OnboardingDirectionProvider>
  );
}

function ChoiceFigure({ value, selected }: { value: string; selected: boolean }) {
  return (
    <span
      className={`text-3xl font-extrabold tabular-nums ${selected ? "text-[var(--play-selected-ink)]" : "text-[var(--color-main)]"}`}
    >
      {value}
    </span>
  );
}
