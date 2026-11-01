"use client";

import { useState } from "react";
import type { PlanPreviewAccessDto } from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { fetchPlanPreviewAccess } from "@/lib/plan-previews";
import type { PlanCoachStageProgress } from "./plan-coach-adaptation-stage";

export interface PlanCoinQuote {
  requestId: string;
  cost: number;
  input: Extract<CoachPlanAdaptationInput, { source: "PLAN" }>;
  progress: PlanCoachStageProgress | null;
  resume: boolean;
}

export function usePlanCoinFlow() {
  const [offer, setOffer] = useState<PlanPreviewAccessDto | null>(null);
  const [quote, setQuote] = useState<PlanCoinQuote | null>(null);
  const [blocked, setBlocked] = useState<PlanPreviewAccessDto | null>(null);
  async function refresh() {
    const view = await fetchPlanPreviewAccess();
    setOffer(view);
    return view;
  }
  async function request(
    input: CoachPlanAdaptationInput,
    progress: PlanCoachStageProgress | null,
  ) {
    if (input.source !== "PLAN")
      throw new Error("Coin previews require PLAN source");
    const view = await refresh();
    if (!view.canGenerate || view.mode !== "COIN" || view.cost === null) {
      setBlocked(view);
      return;
    }
    setQuote({
      input,
      progress,
      cost: view.cost,
      requestId: crypto.randomUUID(),
      resume: false,
    });
  }
  return { offer, quote, blocked, setQuote, setBlocked, refresh, request };
}
