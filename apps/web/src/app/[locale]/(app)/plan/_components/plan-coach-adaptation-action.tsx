"use client";
import { Sparkles } from "lucide-react";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import type {
  ApplyPlanAdaptationResultDto,
  CoachPlanAdaptationBriefDto,
  CoachPlanAdaptationDto,
} from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { Button } from "@mentor/ui";
import { useAuth } from "@/lib/auth-context";
import { trackCoachEvent } from "@/lib/analytics";
import {
  fetchPlanAdaptationBrief,
  requestCoachPlanAdaptation,
} from "@/lib/coach";
import { useMentorToast } from "@/lib/mentor-toast";
import { isPremiumFeatureAvailable } from "@/lib/premium-feature";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { isPremiumRequiredError } from "@/lib/premium-required";
import { useSubscription } from "@/lib/subscription-context";
import { PlanCoachAdaptationBrief } from "./plan-coach-adaptation-brief";
import type { PlanAdaptationKnownWeek } from "./plan-coach-adaptation-brief-note";
import {
  PlanCoachAdaptationStage,
  type PlanCoachStageProgress,
} from "./plan-coach-adaptation-stage";
import { usePlanCoachPreview, readCoachError } from "./use-plan-coach-preview";

interface PlanCoachAdaptationActionProps {
  knownWeek: PlanAdaptationKnownWeek;
  onApplied: (result: ApplyPlanAdaptationResultDto) => Promise<void>;
  onPlanChanged: () => Promise<void>;
}

export interface PlanCoachAdaptationActionHandle {
  open: (input: CoachPlanAdaptationInput) => void;
}

/** The waiting scene: what was asked, the wizard's bar if it came from there, and whether the answer is in. */
interface StageState {
  input: CoachPlanAdaptationInput;
  progress: PlanCoachStageProgress | null;
  arrived: boolean;
}

export const PlanCoachAdaptationAction = forwardRef<
  PlanCoachAdaptationActionHandle,
  PlanCoachAdaptationActionProps
>(function PlanCoachAdaptationAction(
  { knownWeek, onApplied, onPlanChanged },
  ref,
) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const { openPaywall } = usePremiumPaywall();
  const toast = useMentorToast();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const wizardLock = useRef(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [brief, setBrief] = useState<CoachPlanAdaptationBriefDto | null>(null);
  const [stage, setStage] = useState<StageState | null>(null);
  // Bumped by every request and by "Vazgeç", so an answer nobody waits for opens nothing.
  const runRef = useRef(0);
  const landed = useRef<CoachPlanAdaptationDto | null>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const { view: subscriptionView, refresh: refreshSubscription } =
    useSubscription();
  const openPreview = usePlanCoachPreview({
    returnFocusRef: triggerRef,
    onApplied,
    onPlanChanged,
    onRegenerate: (input) => void generatePreview(input),
  });

  const closeWizard = useCallback(() => {
    wizardLock.current = false;
    setWizardOpen(false);
  }, []);

  async function generatePreview(
    input: CoachPlanAdaptationInput,
    progress: PlanCoachStageProgress | null = null,
  ) {
    const run = ++runRef.current;
    busyRef.current = true;
    setBusy(true);
    setWizardError(null);
    setStage({ input, progress, arrived: false });
    try {
      trackCoachEvent("coach_plan_adaptation_request", {
        source: input.source,
      });
      const preview = await requestCoachPlanAdaptation(input);
      if (run !== runRef.current) return;
      // The scene closes itself first; `finishStage` opens the preview behind it.
      landed.current = preview;
      setStage({ input, progress, arrived: true });
    } catch (error) {
      if (run !== runRef.current) return;
      setStage(null);
      if (isPremiumRequiredError(error)) {
        closeWizard();
        openPaywall({ sourceFeature: "plan.ai" });
        return;
      }
      const message = readCoachError(error, tCommon("error_unknown"));
      // The wizard is still open with the answers in it; it says the error above its own button.
      if (wizardLock.current) {
        setWizardError(message);
        return;
      }
      toast.error({
        title: tCommon("error_title"),
        message,
        duration: 3000,
      });
    } finally {
      if (run === runRef.current) {
        setBusy(false);
        busyRef.current = false;
      }
    }
  }

  function finishStage() {
    const preview = landed.current;
    const input = stage?.input;
    landed.current = null;
    setStage(null);
    closeWizard();
    if (preview && input) void openPreview(preview, input);
  }

  function cancelStage() {
    runRef.current += 1;
    landed.current = null;
    setStage(null);
    busyRef.current = false;
    setBusy(false);
  }

  async function open(input: CoachPlanAdaptationInput) {
    if (busyRef.current || wizardLock.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      // Shared read; only joins a request when the user hit this before it settled.
      // A failed read leaves `view` null (not loading) — retry instead of treating it as free.
      const view = subscriptionView ?? (await refreshSubscription());
      if (!isPremiumFeatureAvailable(view, "plan.ai")) {
        busyRef.current = false;
        setBusy(false);
        openPaywall({ sourceFeature: "plan.ai" });
        return;
      }

      if (input.source !== "PLAN") {
        await generatePreview(input);
        return;
      }

      wizardLock.current = true;
      // The wizard opens at once; the coach's reading lands in it when ready, and a failed read
      // leaves today's defaults.
      setBrief(null);
      setWizardError(null);
      void fetchPlanAdaptationBrief().then(setBrief, () => undefined);
      setWizardOpen(true);
    } catch (error) {
      toast.error({
        title: tCommon("error_title"),
        message: readCoachError(error, tCommon("error_unknown")),
        duration: 3000,
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  useImperativeHandle(ref, () => ({
    open: (input) => void open(input),
  }));

  return (
    <>
      <span ref={triggerRef} className="contents">
        <Button
          type="button"
          variant="ghost"
          busy={busy}
          onClick={() => void open({ source: "PLAN" })}
          className="min-h-10 px-3 py-2 text-sm"
        >
          <Sparkles size={16} strokeWidth={2.25} aria-hidden />
          {t("coach_adaptation_cta")}
        </Button>
      </span>
      {wizardOpen ? (
        <PlanCoachAdaptationBrief
          knownWeek={knownWeek}
          brief={brief}
          profile={{
            examType: user?.examType ?? null,
            examVariant: user?.examVariant ?? null,
            dailyFocusGoalMinutes: user?.dailyFocusGoalMinutes ?? null,
          }}
          submitError={wizardError}
          onClose={closeWizard}
          onComplete={(input, progress) => {
            if (busyRef.current) return;
            // The wizard stays open underneath, so a failed request finds the answers still there.
            void generatePreview(input, progress);
          }}
        />
      ) : null}
      {stage ? (
        <PlanCoachAdaptationStage
          input={stage.input}
          knownWeek={knownWeek}
          brief={brief}
          progress={stage.progress}
          arrived={stage.arrived}
          onDone={finishStage}
          onCancel={cancelStage}
        />
      ) : null}
    </>
  );
});
