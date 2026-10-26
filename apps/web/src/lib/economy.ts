import type {
  DeepAnalysisView,
  EconomyBalance,
  EconomyLedgerEntryView,
  InviteCodeView,
  InvitePreviewView,
  QuestProgressView,
  RedeemInviteResult,
  StreakRescueView,
  Paginated,
} from "@mentor/types";
import { ApiClientError, http, economyControllerUnseen, economyControllerSeen } from "@mentor/api-client";

/**
 * Typed wrappers over user economy endpoints. Regen api-client when OpenAPI updates;
 * shapes are asserted here in one place (mirrors coach.ts pattern).
 */
export async function fetchEconomyBalance(): Promise<EconomyBalance> {
  return (await http<EconomyBalance>("/v1/economy/balance")) as EconomyBalance;
}

export async function fetchUnseenRewards(): Promise<Paginated<EconomyLedgerEntryView>> {
  return await economyControllerUnseen({ page: 1, pageSize: 20 }) as unknown as Paginated<EconomyLedgerEntryView>;
}

export async function markRewardsSeen(ledgerIds: string[]): Promise<void> {
  await economyControllerSeen({ ledgerIds });
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

// The viewer's own invite code, remembered for the session so a share can start inside the tap
// (see `peekInviteCode`). Browser-only module state, like `economy-store`; `EconomySync` clears it
// whenever the signed-in account changes. The generation drops a response that lands after that.
let rememberedInviteCode: string | null = null;
let inviteCodeGeneration = 0;

export async function fetchInviteCode(): Promise<InviteCodeView> {
  const generation = inviteCodeGeneration;
  const view = (await http<InviteCodeView>("/v1/economy/invite")) as InviteCodeView;
  if (generation === inviteCodeGeneration) rememberedInviteCode = view.code;
  return view;
}

/**
 * The code the last successful `fetchInviteCode()` returned, or null when none was fetched yet
 * (or the account changed since). Synchronous on purpose: iOS Safari rejects `navigator.share`
 * once a network round trip separates it from the tap, so the share row needs the code in hand.
 */
export function peekInviteCode(): string | null {
  return rememberedInviteCode;
}

/** Sign-out or account switch: the remembered code belongs to someone else now. */
export function forgetInviteCode(): void {
  rememberedInviteCode = null;
  inviteCodeGeneration += 1;
}

/**
 * What a friend sees before signing up: the inviter's display name and the live friend discount.
 * Public (no session needed) and throttled; 404 `INVITE_CODE_INVALID` for any unusable code. Only
 * the `/davet` landing reads it; the viewer's own card has `InviteCodeView.friendDiscount`.
 */
export async function fetchInvitePreview(code: string): Promise<InvitePreviewView> {
  return (await http<InvitePreviewView>(
    `/v1/economy/invite/preview/${encodeURIComponent(code)}`,
  )) as InvitePreviewView;
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
