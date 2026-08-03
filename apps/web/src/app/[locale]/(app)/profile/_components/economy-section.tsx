"use client";
import { Coins, Gift, ListChecks } from "lucide-react";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  EconomyBalance,
  InviteCodeView,
  QuestProgressView,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card, SectionHeading } from "@mentor/ui";
import { EconomyQuestsCard } from "@/components/economy-quests-card";
import { FormError } from "@/components/form";
import {
  fetchEconomyBalance,
  fetchInviteCode,
  fetchQuests,
  isEconomyDisabled,
} from "@/lib/economy";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { EconomyBalanceCard } from "./economy-balance-card";
import { EconomyInviteCard } from "./economy-invite-card";
import { ListRow } from "./account-links-card";

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
}

async function fetchEconomyHub(): Promise<{
  balance: EconomyBalance;
  quests: QuestProgressView[];
  invite: InviteCodeView;
}> {
  const [quests, invite] = await Promise.all([
    fetchQuests(),
    fetchInviteCode(),
  ]);
  const balance = await fetchEconomyBalance();
  return { balance, quests, invite };
}

/**
 * Profile earn hub — hidden when economy.enabled is off (404 ECONOMY_DISABLED).
 * Coin amounts stay off /coach chat (§4 #3).
 */
export function EconomySection({ refreshKey = 0 }: EconomySectionProps) {
  const t = useTranslations("economy");
  const profile = useTranslations("profile.earned");
  const sheet = useMentorBottomSheet();
  const [state, setState] = useState<EconomyState>({ status: "probing" });
  const [inviteOpen, setInviteOpen] = useState(false);
  const economyDisabledRef = useRef(false);

  const applyHidden = useCallback(() => {
    economyDisabledRef.current = true;
    setState({ status: "hidden" });
  }, []);

  const reload = useCallback(async () => {
    if (economyDisabledRef.current) return;
    try {
      const data = await fetchEconomyHub();
      setState({ status: "ready", ...data });
    } catch (err) {
      if (isEconomyDisabled(err)) {
        applyHidden();
        return;
      }
      setState({
        status: "error",
        message:
          err instanceof ApiClientError
            ? err.body.message
            : err instanceof Error
              ? err.message
              : String(err),
      });
    }
  }, [applyHidden]);

  useEffect(() => {
    if (economyDisabledRef.current) return;

    let active = true;
    fetchEconomyHub()
      .then((data) => {
        if (!active) return;
        setState({ status: "ready", ...data });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isEconomyDisabled(err)) {
          applyHidden();
          return;
        }
        setState({
          status: "error",
          message:
            err instanceof ApiClientError
              ? err.body.message
              : err instanceof Error
                ? err.message
                : String(err),
        });
      });

    return () => {
      active = false;
    };
  }, [refreshKey, applyHidden]);

  if (state.status === "hidden" || state.status === "probing") return null;

  if (state.status === "error") {
    return <FormError message={state.message} />;
  }

  function showBalance() {
    if (state.status !== "ready") return;
    sheet.show({
      title: t("balance_title"),
      layout: "filter",
      children: <EconomyBalanceCard balance={state.balance} />,
    });
  }

  function showQuests() {
    if (state.status !== "ready") return;
    sheet.show({
      title: t("quests_title"),
      layout: "filter",
      bodyScroll: false,
      children: (
        <EconomyQuestsCard
          quests={state.quests}
          onDismiss={sheet.dismissNow}
          onInviteRequested={showInvite}
        />
      ),
    });
  }

  function showInvite() {
    if (state.status !== "ready") return;
    sheet.dismissNow();
    setInviteOpen(true);
  }

  return (
    <>
    <Card solid className="p-4">
      <SectionHeading>{profile("title")}</SectionHeading>
      <div className="mt-3 divide-y divide-black/10 overflow-hidden rounded-[var(--radius-card)]">
        <ListRow
          icon={<Coins size={22} aria-hidden />}
          onClick={showBalance}
        >
          {t("balance_title")}
        </ListRow>
        <ListRow
          icon={<ListChecks size={22} aria-hidden />}
          onClick={showQuests}
        >
          {t("quests_title")}
        </ListRow>
        <ListRow
          icon={<Gift size={22} aria-hidden />}
          onClick={showInvite}
        >
          {t("invite_title")}
        </ListRow>
      </div>
    </Card>
    {inviteOpen ? (
      <EconomyInviteCard
        code={state.invite.code}
        onClose={() => setInviteOpen(false)}
        onRedeemed={() => void reload()}
      />
    ) : null}
    </>
  );
}
