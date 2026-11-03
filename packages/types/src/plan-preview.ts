import type { CoachPlanAdaptationDto } from "./coaching.js";

/** Read-only offer. A price quote never purchases or reserves a right. */
export interface PlanPreviewAccessDto {
  mode: "INCLUDED" | "COIN" | "NONE";
  canGenerate: boolean;
  cost: number | null;
  /** Coin-funded allowance only; included generation retains its existing feature limits. */
  dailyLimit: number;
  dailyRemaining: number;
  coinConfirmed: number;
  reason?: string;
  message?: string;
  /** Latest completed or recoverable request belonging to this user. */
  latestRequestId: string | null;
  /** When the Coin allowance is used: the moment its next slot frees. Null otherwise. */
  nextAvailableAt: string | null;
}

export interface SavedPlanPreviewDto {
  requestId: string;
  state: "RUNNING" | "GENERATED" | "READY" | "FAILED";
  /** A generated result stays private until its confirmed Coin debit has committed. */
  preview: CoachPlanAdaptationDto | null;
  cost: number;
  coinSpent: number;
}
