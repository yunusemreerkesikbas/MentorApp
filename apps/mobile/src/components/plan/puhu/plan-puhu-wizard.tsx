import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatKnownBrief, isMinuteEntry, planWindowToday, type PlanAdaptationKnownWeek } from "@mentor/core";
import type { CoachPlanAdaptationBriefDto } from "@mentor/types";
import { fetchExamTaxonomy } from "../../../lib/analysis-api.js";
import {
  planBriefAnswers,
  planBriefInput,
  type BriefOverrides,
  type PlanInput,
  type StageProgress,
} from "../../../lib/plan-puhu.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { OnboardingStepShell } from "../../onboarding/step-shell.js";
import { DaysStep, MinutesStep, NoteStep, SubjectsStep } from "./plan-puhu-wizard-steps.js";

const STEPS = ["days", "minutes", "subjects", "note"] as const;

/**
 * "Puhu'yla planla" questions (the web's `PlanCoachAdaptationBrief`): days, minutes, subjects and a
 * note, each skippable. Drawn inside the host modal; the brief may arrive after the first step.
 */
export function PlanPuhuWizard({
  knownWeek,
  brief,
  coinCost,
  submitError,
  onComplete,
  onClose,
  backRef,
}: {
  knownWeek: PlanAdaptationKnownWeek;
  /** Puhu's reading of the student's data; null while loading or when it failed. */
  brief: CoachPlanAdaptationBriefDto | null;
  /** On the Coin path the last button names the price confirmed before the wizard. */
  coinCost: number | null;
  /** Why the last preview did not arrive, said on the note step. */
  submitError: string | null;
  onComplete: (input: PlanInput, progress: StageProgress) => void;
  onClose: () => void;
  /** The host modal reads this on Android back: one step back, or close on the first step. */
  backRef?: { current: (() => void) | null };
}) {
  const t = useTranslations("plan");
  const tCoin = useTranslations("planCoin");
  const tOnboarding = useTranslations("onboarding");
  const { user } = useAuth();
  const examType = user?.examType ?? null;
  const examVariant = user?.examVariant ?? null;
  const taxonomy = useQuery({
    queryKey: ["exam-taxonomy", examType, examVariant],
    queryFn: () => fetchExamTaxonomy(examType!, examVariant),
    enabled: examType !== null,
  });
  // Like the web hook: no exam or a failed load is a loaded, empty list.
  const taxonomyNames = useMemo(
    () =>
      examType === null || taxonomy.isError
        ? []
        : taxonomy.data
          ? taxonomy.data.subjects.map((subject) => subject.name)
          : null,
    [examType, taxonomy.isError, taxonomy.data],
  );

  // Opened on a tap, so "today" is the student's own day.
  const [window] = useState(planWindowToday);
  const [index, setIndex] = useState(0);
  const [overrides, setOverrides] = useState<BriefOverrides>({ weekdays: null, minutes: undefined, subjects: null });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const answers = planBriefAnswers({
    brief,
    goalMinutes: user?.dailyFocusGoalMinutes ?? null,
    taxonomyNames,
    knownSubjects: knownWeek.subjects,
    overrides,
  });
  const suggested = useMemo(
    () => new Set((brief?.suggestion.focusSubjects ?? []).map((name) => name.toLocaleLowerCase("tr-TR"))),
    [brief],
  );
  const steps = STEPS.filter((step) => step !== "subjects" || taxonomyNames === null || taxonomyNames.length > 0);
  const safeIndex = Math.min(index, steps.length - 1);
  const step = steps[safeIndex] ?? "days";

  const exam = examType
    ? examVariant
      ? `${examType} · ${tOnboarding(`kpss_variant_${examVariant}` as "kpss_variant_LISANS")}`
      : examType
    : null;
  const known = formatKnownBrief({
    exam,
    goal:
      user?.dailyFocusGoalMinutes != null
        ? t("coach_adaptation_known_goal", { count: user.dailyFocusGoalMinutes })
        : null,
    pending:
      knownWeek.pendingCount > 0 ? t("coach_adaptation_known_pending", { count: knownWeek.pendingCount }) : null,
  });

  const go = (next: number) => {
    setIndex(next);
    setError(null);
  };

  const submit = (freeNote: string) => {
    const { weekdays, minutes, subjects } = answers;
    const input = planBriefInput({ note: freeNote, weekdays, minutes, subjects, window });
    if (!input) {
      setError(t("coach_adaptation_note_invalid"));
      return;
    }
    onComplete(input, { done: steps.length, total: steps.length + 1 });
  };

  const onContinue = () => {
    if (step === "minutes" && answers.minutes != null && !isMinuteEntry(answers.minutes)) {
      setError(t("coach_adaptation_minutes_invalid"));
      return;
    }
    if (safeIndex >= steps.length - 1) submit(note);
    else go(safeIndex + 1);
  };

  const back = safeIndex === 0 ? onClose : () => go(safeIndex - 1);
  useEffect(() => {
    if (backRef) backRef.current = back;
  });

  const onSkip = () => {
    const skipped: BriefOverrides = {
      ...overrides,
      ...(step === "days" ? { weekdays: [] } : {}),
      ...(step === "minutes" ? { minutes: null } : {}),
      ...(step === "subjects" ? { subjects: [] } : {}),
    };
    setOverrides(skipped);
    if (safeIndex >= steps.length - 1) {
      submit("");
      return;
    }
    go(safeIndex + 1);
  };

  const toggle = <T,>(list: readonly T[], item: T) =>
    list.includes(item) ? list.filter((value) => value !== item) : [...list, item];

  const title =
    step === "days"
      ? t("coach_adaptation_days_label")
      : step === "minutes"
        ? t("coach_adaptation_minutes_label")
        : step === "subjects"
          ? t("coach_adaptation_subjects_label")
          : t("coach_adaptation_note_label");
  // The first thing Puhu says is what the plan will be built from, once it has read it.
  const subtitle =
    step === "days"
      ? (brief?.groundingLine ?? known ?? undefined)
      : step === "subjects"
        ? t("coach_adaptation_subjects_hint")
        : undefined;

  return (
    <OnboardingStepShell
      key={step}
      title={title}
      subtitle={subtitle}
      progress={{ done: safeIndex + 1, total: steps.length + 1 }}
      onBack={back}
      skipLabel={t("coach_adaptation_skip")}
      onSkip={onSkip}
      errorMessage={error ?? (step === "note" ? submitError : null)}
      primaryLabel={
        step === "note"
          ? coinCost != null
            ? tCoin("coin", { cost: coinCost })
            : t("coach_adaptation_generate")
          : t("coach_adaptation_continue")
      }
      primaryDisabled={step === "subjects" && taxonomyNames === null}
      onPrimary={onContinue}
    >
      {step === "days" ? (
        <DaysStep
          title={title}
          window={window}
          selected={answers.weekdays}
          rhythmWeekdays={answers.rhythmWeekdays}
          onToggle={(weekday) => setOverrides((current) => ({ ...current, weekdays: toggle(answers.weekdays, weekday) }))}
        />
      ) : null}
      {step === "minutes" ? (
        <MinutesStep
          title={title}
          minutes={answers.minutes}
          goalMinutes={answers.goalMinutes}
          rhythmMinutes={answers.rhythmMinutes}
          onSelect={(minutes) => {
            setOverrides((current) => ({ ...current, minutes }));
            setError(null);
          }}
        />
      ) : null}
      {step === "subjects" ? (
        <SubjectsStep
          title={title}
          names={taxonomyNames}
          selected={answers.subjects}
          suggested={suggested}
          onToggle={(name) => setOverrides((current) => ({ ...current, subjects: toggle(answers.subjects, name) }))}
        />
      ) : null}
      {step === "note" ? <NoteStep note={note} onChange={setNote} /> : null}
    </OnboardingStepShell>
  );
}
