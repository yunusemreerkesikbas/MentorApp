"use client";

import { useState } from "react";
import type { PlanPreviewAccessDto } from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { fetchPlanPreviewAccess } from "@/lib/plan-previews";
import type { PlanCoachStageProgress } from "./plan-coach-adaptation-stage";

type PlanInput = Extract<CoachPlanAdaptationInput, { source: "PLAN" }>;

export interface PlanCoinQuote {
  requestId: string;
  cost: number;
  input: PlanInput;
  progress: PlanCoachStageProgress | null;
  resume: boolean;
}

/** The choice sheet as it stands. `pending` answers go out as soon as the price is confirmed. */
export interface PlanCoinSheetState {
  armed: boolean;
  error: string | null;
  pending: { input: PlanInput; progress: PlanCoachStageProgress | null } | null;
  /** A generated draft whose Coin was never taken: confirming pays for it and opens it. */
  resume: PlanCoinQuote | null;
}

export const newQuote = (
  { input, progress }: NonNullable<PlanCoinSheetState["pending"]>,
  cost: number,
): PlanCoinQuote => ({ input, progress, cost, requestId: crypto.randomUUID(), resume: false });

export function usePlanCoinFlow() {
  const [offer, setOffer] = useState<PlanPreviewAccessDto | null>(null);
  const [sheet, setSheet] = useState<PlanCoinSheetState | null>(null);
  /** The price confirmed in the sheet: the wizard's last button says it and the request carries it. */
  const [paid, setPaid] = useState<number | null>(null);
  async function refresh() {
    const view = await fetchPlanPreviewAccess();
    setOffer(view);
    return view;
  }
  const show = (patch: Partial<PlanCoinSheetState> = {}) =>
    setSheet({ armed: false, error: null, pending: null, resume: null, ...patch });
  return { offer, refresh, sheet, setSheet, show, paid, setPaid };
}
