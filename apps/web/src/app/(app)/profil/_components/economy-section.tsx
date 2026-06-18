"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EconomyBalance, InviteCodeView, QuestProgressView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { FormError } from "../../../../components/form";
import {
  fetchEconomyBalance,
  fetchInviteCode,
  fetchQuests,
  isEconomyDisabled,
} from "../../../../lib/economy";
import { EconomyBalanceCard } from "./economy-balance-card";
import { EconomyInviteCard } from "./economy-invite-card";
import { EconomyQuestsCard } from "./economy-quests-card";

type EconomyState =
  | { status: "probing" }
  | { status: "hidden" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      balance: EconomyBalance;
      quests: QuestProgressView[];
      invite: InviteCodeView;
    };

interface EconomySectionProps {
  /** Bump after exam type save so quests/balance refetch (profile-setup quest). */
  refreshKey?: number;
  /** Fired when the earn hub becomes visible or is permanently hidden (flag off). */
  onVisibilityChange?: (visible: boolean) => void;
}

async function fetchEconomyHub(): Promise<{
  balance: EconomyBalance;
  quests: QuestProgressView[];
  invite: InviteCodeView;
}> {
  const [balance, quests, invite] = await Promise.all([
    fetchEconomyBalance(),
    fetchQuests(),
    fetchInviteCode(),
  ]);
  return { balance, quests, invite };
}

/**
 * Profile earn hub — hidden when economy.enabled is off (404 ECONOMY_DISABLED).
 * Coin amounts stay off /koc chat (§4 #3).
 */
export function EconomySection({ refreshKey = 0, onVisibilityChange }: EconomySectionProps) {
  const [state, setState] = useState<EconomyState>({ status: "probing" });
  const economyDisabledRef = useRef(false);

  const applyHidden = useCallback(() => {
    economyDisabledRef.current = true;
    setState({ status: "hidden" });
    onVisibilityChange?.(false);
  }, [onVisibilityChange]);

  const reload = useCallback(async () => {
    if (economyDisabledRef.current) return;
    try {
      const data = await fetchEconomyHub();
      setState({ status: "ready", ...data });
      onVisibilityChange?.(true);
    } catch (err) {
      if (isEconomyDisabled(err)) {
        applyHidden();
        return;
      }
      setState({
        status: "error",
        message: err instanceof ApiClientError ? err.body.message : "Bir hata oluştu.",
      });
      onVisibilityChange?.(false);
    }
  }, [applyHidden, onVisibilityChange]);

  useEffect(() => {
    if (economyDisabledRef.current) return;

    let active = true;
    fetchEconomyHub()
      .then((data) => {
        if (!active) return;
        setState({ status: "ready", ...data });
        onVisibilityChange?.(true);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isEconomyDisabled(err)) {
          applyHidden();
          return;
        }
        setState({
          status: "error",
          message: err instanceof ApiClientError ? err.body.message : "Bir hata oluştu.",
        });
        onVisibilityChange?.(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey, applyHidden, onVisibilityChange]);

  if (state.status === "hidden" || state.status === "probing") return null;

  if (state.status === "error") {
    return <FormError message={state.message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <EconomyBalanceCard balance={state.balance} />
      <EconomyQuestsCard quests={state.quests} />
      <EconomyInviteCard code={state.invite.code} onRedeemed={() => void reload()} />
    </div>
  );
}
