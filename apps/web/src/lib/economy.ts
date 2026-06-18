import type {
  EconomyBalance,
  InviteCodeView,
  QuestProgressView,
  RedeemInviteResult,
} from "@mentor/types";
import { ApiClientError, http } from "@mentor/api-client";

/**
 * Typed wrappers over user economy endpoints. Regen api-client when OpenAPI updates;
 * shapes are asserted here in one place (mirrors coach.ts pattern).
 */
export async function fetchEconomyBalance(): Promise<EconomyBalance> {
  return (await http<EconomyBalance>("/v1/economy/balance")) as EconomyBalance;
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

/** True when the economy feature flag is off — profile hub should not render. */
export function isEconomyDisabled(err: unknown): boolean {
  return err instanceof ApiClientError && err.body.code === "ECONOMY_DISABLED";
}
