import type {
  DeepAnalysisView,
  EconomyBalance,
  EconomyLedgerEntryView,
  InviteCodeView,
  QuestProgressView,
  RedeemInviteResult,
  StreakRescueView,
} from "@mentor/types";
import { ApiClientError, http } from "@mentor/api-client";

/**
 * Typed wrappers over user economy endpoints. Regen api-client when OpenAPI updates;
 * shapes are asserted here in one place (mirrors coach.ts pattern).
 */
export async function fetchEconomyBalance(): Promise<EconomyBalance> {
  return (await http<EconomyBalance>("/v1/economy/balance")) as EconomyBalance;
}

export async function fetchEconomyLedger({
  page = 1,
  pageSize = 20,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<EconomyLedgerEntryView[]> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return (await http<EconomyLedgerEntryView[]>(
    `/v1/economy/ledger?${query.toString()}`,
  )) as EconomyLedgerEntryView[];
}

export async function fetchQuests(): Promise<QuestProgressView[]> {
  return (await http<QuestProgressView[]>("/v1/economy/quests")) as QuestProgressView[];
}

export async function fetchInviteCode(): Promise<InviteCodeView> {
  return (await http<InviteCodeView>("/v1/economy/invite")) as InviteCodeView;
}

export async function redeemInviteCode(code: string): Promise<RedeemInviteResult> {
  return (await http<RedeemInviteResult>("/v1/economy/invite/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  })) as RedeemInviteResult;
}

export async function fetchStreakRescue(): Promise<StreakRescueView> {
  return (await http<StreakRescueView>("/v1/economy/streak-rescue")) as StreakRescueView;
}

export async function purchaseStreakRescue(): Promise<StreakRescueView> {
  return (await http<StreakRescueView>("/v1/economy/streak-rescue", {
    method: "POST",
  })) as StreakRescueView;
}

export async function fetchDeepAnalysis(examId: string): Promise<DeepAnalysisView> {
  const query = new URLSearchParams({ examId });
  return (await http<DeepAnalysisView>(
    `/v1/economy/deep-analysis?${query.toString()}`,
  )) as DeepAnalysisView;
}

export async function purchaseDeepAnalysis(examId: string): Promise<DeepAnalysisView> {
  return (await http<DeepAnalysisView>("/v1/economy/deep-analysis", {
    method: "POST",
    body: JSON.stringify({ examId }),
  })) as DeepAnalysisView;
}

/** True when the economy feature flag is off — profile hub should not render. */
export function isEconomyDisabled(err: unknown): boolean {
  return err instanceof ApiClientError && err.body.code === "ECONOMY_DISABLED";
}

/** App chrome (nav) listens so XP/coin pills refresh after panel quests / rescue. */
export const ECONOMY_CHANGED_EVENT = "mentor:economy-changed";

export function notifyEconomyChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ECONOMY_CHANGED_EVENT));
}

/** Dispatched when a coin award should be celebrated with the full-screen overlay. */
export const COIN_CELEBRATE_EVENT = "mentor:coin-celebrate";

export interface CoinCelebrateDetail {
  amount: number;
  label?: string;
}

export function notifyCoinCelebration(amount: number, label?: string): void {
  if (typeof window === "undefined" || amount <= 0) return;
  window.dispatchEvent(
    new CustomEvent<CoinCelebrateDetail>(COIN_CELEBRATE_EVENT, {
      detail: { amount, label },
    }),
  );
}

