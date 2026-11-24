"use client";

import { useState } from "react";
import { ApiClientError } from "@mentor/api-client";
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

/**
 * What the wizard's last button sends. The same answers at the same price go out under the last
 * request's id, so a retry after Vazgeç or a lost answer is one request: the server answers a repeat
 * with the draft it is making or has made, and takes no second Coin. Mirrors the phone's
 * `wizardCoinQuote` (apps/mobile/src/lib/plan-puhu.ts).
 */
export function wizardCoinQuote(
  last: PlanCoinQuote | null,
  pending: NonNullable<PlanCoinSheetState["pending"]>,
  cost: number,
): PlanCoinQuote {
  const same = last && !last.resume && last.cost === cost && JSON.stringify(last.input) === JSON.stringify(pending.input);
  return same ? { ...last, progress: pending.progress } : newQuote(pending, cost);
}

/** A failed Coin request may go again under its id only when the server gave no verdict on it yet. */
export const keepsCoinQuote = (error: unknown): boolean =>
  !(error instanceof ApiClientError) || error.body.code === "AI_PLAN_REQUEST_PROCESSING";

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
