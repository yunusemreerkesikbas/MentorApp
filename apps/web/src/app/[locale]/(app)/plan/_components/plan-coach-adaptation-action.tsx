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

  async function generatePreview(input: CoachPlanAdaptationInput) {
    busyRef.current = true;
    setBusy(true);
    try {
      trackCoachEvent("coach_plan_adaptation_request", {
        source: input.source,
      });
      const preview = await requestCoachPlanAdaptation(input);
      void openPreview(preview, input);
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
          onClose={closeWizard}
          onComplete={(input) => {
            if (busyRef.current) return;
            wizardLock.current = false;
            setWizardOpen(false);
            void generatePreview(input);
          }}
        />
      ) : null}
    </>
  );
});
