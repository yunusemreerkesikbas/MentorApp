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
import { usePlanCoachPreview, readCoachError } from "./use-plan-coach-preview";
import {
  usePlanCoachPreparation,
  type PlanCoachInput,
} from "./use-plan-coach-preparation";
import { PlanCoachPreparationScene } from "./plan-coach-preparation-scene";

interface PlanCoachAdaptationActionProps {
  knownWeek: PlanAdaptationKnownWeek;
  onApplied: (result: ApplyPlanAdaptationResultDto) => Promise<void>;
  onPlanChanged: () => Promise<void>;
}

export interface PlanCoachAdaptationActionHandle {
  open: (input: CoachPlanAdaptationInput) => void;
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
  const [brief, setBrief] = useState<CoachPlanAdaptationBriefDto | null>(null);
  const [wizardInput, setWizardInput] = useState<PlanCoachInput>();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const { view: subscriptionView, refresh: refreshSubscription } =
    useSubscription();
  const openPreview = usePlanCoachPreview({
    returnFocusRef: triggerRef,
    onApplied,
    onPlanChanged,
    onRegenerate: (input) =>
      input.source === "PLAN"
        ? void preparation.start(input)
        : void generatePreview(input),
    onAppliedPlan: () => preparation.clear(),
  });
  const preparation = usePlanCoachPreparation({
    onReady: (preview, input) => void openPreview(preview, input),
    onPremiumRequired: () => openPaywall({ sourceFeature: "plan.ai" }),
    errorMessage: (error) => readCoachError(error, tCommon("error_unknown")),
  });

  async function generatePreview(input: CoachPlanAdaptationInput) {
    setBusy(true);
    try {
      trackCoachEvent("coach_plan_adaptation_request", {
        source: input.source,
      });
      const preview = await requestCoachPlanAdaptation(input);
      await openPreview(preview, input);
    } catch (error) {
      if (isPremiumRequiredError(error)) {
        openPaywall({ sourceFeature: "plan.ai" });
        return;
      }
      toast.error({
        title: tCommon("error_title"),
        message: readCoachError(error, tCommon("error_unknown")),
        duration: 3000,
      });
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  async function open(input: CoachPlanAdaptationInput) {
    if (input.source === "PLAN" && preparation.state.status !== "idle") {
      preparation.resume();
      return;
    }
    if (preparation.state.status === "loading") return;
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
      setWizardInput(undefined);
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

  const closeWizard = useCallback(() => {
    wizardLock.current = false;
    setWizardOpen(false);
  }, []);

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
          {preparation.state.status === "idle"
            ? t("coach_adaptation_cta")
            : preparation.state.status === "ready"
              ? t("coach_flight_preview")
              : t("coach_flight_resume")}
        </Button>
      </span>
      {wizardOpen ? (
        <PlanCoachAdaptationBrief
          knownWeek={knownWeek}
          brief={brief}
          initialInput={wizardInput}
          profile={{
            examType: user?.examType ?? null,
            examVariant: user?.examVariant ?? null,
            dailyFocusGoalMinutes: user?.dailyFocusGoalMinutes ?? null,
          }}
          onClose={closeWizard}
          onComplete={(input) => {
            wizardLock.current = false;
            setWizardOpen(false);
            void preparation.start(input);
          }}
        />
      ) : null}
      {preparation.visible &&
      (preparation.state.status === "loading" ||
        preparation.state.status === "error") ? (
        <PlanCoachPreparationScene
          state={preparation.state}
          slow={preparation.slow}
          returnFocusRef={triggerRef}
          onClose={preparation.close}
          onRetry={(input) => void preparation.start(input)}
          onEdit={(input) => {
            preparation.clear();
            setWizardInput(input);
            wizardLock.current = true;
            setWizardOpen(true);
          }}
        />
      ) : null}
    </>
  );
});
