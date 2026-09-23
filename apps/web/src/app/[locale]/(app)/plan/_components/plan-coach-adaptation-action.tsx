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
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { useAuth } from "@/lib/auth-context";
import { trackCoachEvent } from "@/lib/analytics";
import { fetchPlanAdaptationBrief, requestCoachPlanAdaptation } from "@/lib/coach";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorToast } from "@/lib/mentor-toast";
import { applyCoachPlanAdaptation } from "@/lib/plan-tasks";
import { isPremiumFeatureAvailable } from "@/lib/premium-feature";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { isPremiumRequiredError } from "@/lib/premium-required";
import { useSubscription } from "@/lib/subscription-context";
import {
  PlanCoachAdaptationBrief,
} from "./plan-coach-adaptation-brief";
import type { PlanAdaptationKnownWeek } from "./plan-coach-adaptation-brief-note";
import {
  PlanCoachAdaptationPreview,
  type PlanCoachAdaptationPreviewHandle,
} from "./plan-coach-adaptation-preview";

interface PlanCoachAdaptationActionProps {
  knownWeek: PlanAdaptationKnownWeek;
  onApplied: (result: ApplyPlanAdaptationResultDto) => Promise<void>;
  onPlanChanged: () => Promise<void>;
}

export interface PlanCoachAdaptationActionHandle {
  open: (input: CoachPlanAdaptationInput) => void;
}

function readError(error: unknown, fallback: string): string {
  return error instanceof ApiClientError
    ? error.message
    : error instanceof Error
      ? error.message
      : fallback;
}

export const PlanCoachAdaptationAction = forwardRef<
  PlanCoachAdaptationActionHandle,
  PlanCoachAdaptationActionProps
>(function PlanCoachAdaptationAction({ knownWeek, onApplied, onPlanChanged }, ref) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const { openPaywall } = usePremiumPaywall();
  const { filterSheet, dismissNow } = useMentorBottomSheet();
  const toast = useMentorToast();
  const previewRef = useRef<PlanCoachAdaptationPreviewHandle>(null);
  const wizardLock = useRef(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [brief, setBrief] = useState<CoachPlanAdaptationBriefDto | null>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const {
    view: subscriptionView,
    refresh: refreshSubscription,
  } = useSubscription();

  async function openPreview(
    preview: CoachPlanAdaptationDto,
    input: CoachPlanAdaptationInput,
  ) {
    const applied: { result: ApplyPlanAdaptationResultDto | null } = {
      result: null,
    };
    const regenerate = () => {
      dismissNow();
      queueMicrotask(() => void generatePreview(input));
    };
    const result = await filterSheet({
      title: t("coach_adaptation_preview_title"),
      applyLabel:
        preview.status === "READY"
          ? t("coach_adaptation_apply_selected")
          : t("coach_adaptation_close"),
      children: (
        <PlanCoachAdaptationPreview
          ref={previewRef}
          preview={preview}
          onRegenerate={regenerate}
        />
      ),
      onApply: async () => {
        if (preview.status === "NO_CHANGE") return;
        const changes = previewRef.current?.getSelectedChanges() ?? [];
        if (changes.length === 0) {
          previewRef.current?.setError(t("coach_adaptation_select_required"));
          throw new Error("validation");
        }
        try {
          applied.result = await applyCoachPlanAdaptation({
            planRevision: preview.planRevision,
            changes,
          });
        } catch (error) {
          const stale = error instanceof ApiClientError && error.status === 409;
          if (stale) await onPlanChanged();
          previewRef.current?.setError(
            readError(error, tCommon("error_unknown")),
            stale,
          );
          throw error;
        }
      },
    });

    if (result !== "apply" || !applied.result) return;
    await onApplied(applied.result);
    const moveCount = applied.result.moved.length;
    const addCount = applied.result.added.length;
    trackCoachEvent("coach_plan_adaptation_apply", {
      source: input.source,
      move_count: moveCount,
      add_count: addCount,
    });
    toast.success({
      title: t("coach_adaptation_success_title"),
      message: t("coach_adaptation_success_message", {
        moveCount,
        addCount,
      }),
      duration: 3000,
    });
  }

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
        message: readError(error, tCommon("error_unknown")),
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
        message: readError(error, tCommon("error_unknown")),
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
            wizardLock.current = false;
            setWizardOpen(false);
            void generatePreview(input);
          }}
        />
      ) : null}
    </>
  );
});
