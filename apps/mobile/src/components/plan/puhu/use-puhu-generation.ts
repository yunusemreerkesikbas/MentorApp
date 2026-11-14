import { useEffect, useRef, useState, type RefObject } from "react";
import type { CoachPlanAdaptationDto } from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { requestCoachPlanAdaptation } from "../../../lib/coach-api.js";
import { confirmCoinPlanPreview, createCoinPlanPreview } from "../../../lib/plan-previews-api.js";
import type { PlanCoinQuote, StageProgress } from "../../../lib/plan-puhu.js";
import { apiErrorCode } from "../../../lib/plan-view.js";

interface StageState {
  input: CoachPlanAdaptationInput;
  progress: StageProgress | null;
  arrived: boolean;
}

/**
 * The waiting scene's lifecycle (the web's `usePlanCoachGeneration`). Hiding the scene drops the
 * answer on screen only; a Coin request already sent still settles on the server.
 */
export function usePuhuGeneration({
  busyRef,
  unknownError,
  onBusy,
  onStart,
  onError,
  onPremium,
  onReady,
  onSaved,
}: {
  busyRef: RefObject<boolean>;
  unknownError: string;
  onBusy: (busy: boolean) => void;
  onStart: () => void;
  /** `paid` is the Coin request that failed, when it was one. */
  onError: (error: unknown, paid?: PlanCoinQuote) => void;
  onPremium: () => void;
  onReady: (preview: CoachPlanAdaptationDto, input: CoachPlanAdaptationInput) => void;
  onSaved: () => void;
}) {
  const runRef = useRef(0);
  const landed = useRef<CoachPlanAdaptationDto | null>(null);
  const [stage, setStage] = useState<StageState | null>(null);

  async function generate(input: CoachPlanAdaptationInput, progress: StageProgress | null = null, paid?: PlanCoinQuote) {
    const run = ++runRef.current;
    busyRef.current = true;
    onBusy(true);
    onStart();
    setStage({ input, progress, arrived: false });
    try {
      const saved = paid
        ? await (paid.resume
            ? confirmCoinPlanPreview(paid.requestId, paid.cost)
            : createCoinPlanPreview({ input: paid.input, expectedCost: paid.cost, clientRequestId: paid.requestId }))
        : null;
      const preview = paid ? saved?.preview : await requestCoachPlanAdaptation(input);
      if (!preview) throw new Error(unknownError);
      if (paid) onSaved();
      if (run !== runRef.current) return;
      landed.current = preview;
      setStage({ input, progress, arrived: true });
    } catch (error) {
      if (run !== runRef.current) return;
      setStage(null);
      if (apiErrorCode(error) === "PAYMENT_PREMIUM_REQUIRED") onPremium();
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

  // Leaving the tab drops a run still in flight.
  useEffect(
    () => () => {
      runRef.current += 1;
    },
    [],
  );

  return { stage, generate, finish, cancel };
}
