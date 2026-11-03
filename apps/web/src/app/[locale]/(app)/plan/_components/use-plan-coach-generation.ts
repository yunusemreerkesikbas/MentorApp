"use client";

import { useRef, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import type { CoachPlanAdaptationDto } from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { trackCoachEvent } from "@/lib/analytics";
import { requestCoachPlanAdaptation } from "@/lib/coach";
import {
  confirmCoinPlanPreview,
  createCoinPlanPreview,
} from "@/lib/plan-previews";
import { isPremiumRequiredError } from "@/lib/premium-required";
import type { PlanCoinQuote } from "./use-plan-coin-flow";
import type { PlanCoachStageProgress } from "./plan-coach-adaptation-stage";

interface StageState {
  input: CoachPlanAdaptationInput;
  progress: PlanCoachStageProgress | null;
  arrived: boolean;
}

/** Waiting-view lifecycle. Hiding it abandons the UI response, never a server-side Coin request. */
export function usePlanCoachGeneration({
  busyRef,
  onBusy,
  onStart,
  onError,
  onPremium,
  onReady,
  onSaved,
}: {
  busyRef: RefObject<boolean>;
  onBusy: (busy: boolean) => void;
  onStart: () => void;
  /** `paid` is the Coin request that failed, when it was one. */
  onError: (error: unknown, paid?: PlanCoinQuote) => void;
  onPremium: () => void;
  onReady: (
    preview: CoachPlanAdaptationDto,
    input: CoachPlanAdaptationInput,
  ) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("common");
  const runRef = useRef(0);
  const landed = useRef<CoachPlanAdaptationDto | null>(null);
  const [stage, setStage] = useState<StageState | null>(null);
  async function generate(
    input: CoachPlanAdaptationInput,
    progress: PlanCoachStageProgress | null = null,
    paid?: PlanCoinQuote,
  ) {
    const run = ++runRef.current;
    busyRef.current = true;
    onBusy(true);
    onStart();
    setStage({ input, progress, arrived: false });
    try {
      trackCoachEvent("coach_plan_adaptation_request", {
        source: input.source,
      });
      const saved = paid
        ? await (paid.resume
            ? confirmCoinPlanPreview(paid.requestId, paid.cost)
            : createCoinPlanPreview({
                input: paid.input,
                expectedCost: paid.cost,
                clientRequestId: paid.requestId,
              }))
        : null;
      const preview = paid
        ? saved?.preview
        : await requestCoachPlanAdaptation(input);
      if (!preview) throw new Error(t("error_unknown"));
      if (paid) onSaved();
      if (run !== runRef.current) return;
      landed.current = preview;
      setStage({ input, progress, arrived: true });
    } catch (error) {
      if (run !== runRef.current) return;
      setStage(null);
      if (isPremiumRequiredError(error)) onPremium();
      else onError(error, paid);
    } finally {
      if (run === runRef.current) {
        busyRef.current = false;
        onBusy(false);
      }
    }
  }
  function finish() {
    const preview = landed.current;
    const input = stage?.input;
    landed.current = null;
    setStage(null);
    if (preview && input) onReady(preview, input);
  }
  function cancel() {
    runRef.current += 1;
    landed.current = null;
    setStage(null);
    busyRef.current = false;
    onBusy(false);
  }
  return { stage, generate, finish, cancel };
}
