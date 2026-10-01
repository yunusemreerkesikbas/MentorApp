"use client";

import { useEffect, useRef, useState } from "react";
import type { CoachPlanAdaptationDto } from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { requestCoachPlanAdaptation } from "@/lib/coach";
import { trackCoachEvent } from "@/lib/analytics";
import { isPremiumRequiredError } from "@/lib/premium-required";

export type PlanCoachInput = Extract<CoachPlanAdaptationInput, { source: "PLAN" }>;

export type PlanPreparationState =
  | { status: "idle" }
  | { status: "loading"; input: PlanCoachInput }
  | { status: "error"; input: PlanCoachInput; message: string }
  | {
      status: "ready";
      input: PlanCoachInput;
      preview: CoachPlanAdaptationDto;
    };

export function usePlanCoachPreparation({
  onReady,
  onPremiumRequired,
  errorMessage,
}: {
  onReady: (
    preview: CoachPlanAdaptationDto,
    input: PlanCoachInput,
  ) => void;
  onPremiumRequired: () => void;
  errorMessage: (error: unknown) => string;
}) {
  const [state, setState] = useState<PlanPreparationState>({ status: "idle" });
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);
  const stateRef = useRef(state);
  const visibleRef = useRef(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const requestId = useRef(0);
  const callbacks = useRef({ onReady, onPremiumRequired, errorMessage });
  useEffect(() => {
    callbacks.current = { onReady, onPremiumRequired, errorMessage };
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, []);

  useEffect(() => {
    if (state.status !== "loading") return;
    const timer = window.setTimeout(() => setSlow(true), 20_000);
    return () => window.clearTimeout(timer);
  }, [state]);

  function update(next: PlanPreparationState) {
    stateRef.current = next;
    setState(next);
  }

  function close() {
    visibleRef.current = false;
    setVisible(false);
  }

  function clear() {
    close();
    update({ status: "idle" });
  }

  async function start(input: PlanCoachInput) {
    // Lock at the event boundary: two clicks before React renders still make one request.
    if (pending.current) return;
    pending.current = true;
    const id = ++requestId.current;
    visibleRef.current = true;
    setVisible(true);
    setSlow(false);
    update({ status: "loading", input });
    trackCoachEvent("coach_plan_adaptation_request", { source: input.source });
    try {
      const preview = await requestCoachPlanAdaptation(input);
      if (!mounted.current || requestId.current !== id) return;
      update({ status: "ready", input, preview });
      if (visibleRef.current) {
        close();
        callbacks.current.onReady(preview, input);
      }
    } catch (error) {
      if (!mounted.current || requestId.current !== id) return;
      if (isPremiumRequiredError(error)) {
        clear();
        callbacks.current.onPremiumRequired();
      } else {
        update({
          status: "error",
          input,
          message: callbacks.current.errorMessage(error),
        });
      }
    } finally {
      if (requestId.current === id) pending.current = false;
    }
  }

  function resume() {
    const current = stateRef.current;
    if (current.status === "idle") return;
    if (current.status === "ready") {
      callbacks.current.onReady(current.preview, current.input);
    } else {
      visibleRef.current = true;
      setVisible(true);
    }
  }

  return { state, visible, slow, start, close, clear, resume };
}
