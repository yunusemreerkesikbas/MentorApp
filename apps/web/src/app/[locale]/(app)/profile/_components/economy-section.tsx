"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  InviteCodeView,
  QuestProgressView,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card, Skeleton } from "@mentor/ui";
import { EconomyQuestsCard } from "@/components/economy-quests-card";
import { FormError } from "@/components/form";
import {
  notifyEconomyChanged,
  fetchInviteCode,
  fetchQuests,
  isEconomyDisabled,
} from "@/lib/economy";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { EconomyBalanceCard } from "./economy-balance-card";
import { EconomyInviteCard } from "./economy-invite-card";
import { ListRow } from "./account-links-card";
import { useEconomyEnabled } from "@/lib/use-economy-enabled";

type EconomyState =
  | { status: "probing" }
  | { status: "hidden" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      quests: QuestProgressView[];
      invite: InviteCodeView;
    };

interface EconomySectionProps {
  /** Bump after exam type save so quests/balance refetch (profile-setup quest). */
  refreshKey?: number;
}

async function fetchEconomyHub(): Promise<{
  quests: QuestProgressView[];
  invite: InviteCodeView;
}> {
  const [quests, invite] = await Promise.all([
    fetchQuests(),
    fetchInviteCode(),
  ]);
  notifyEconomyChanged();
  return { quests, invite };
}

/**
 * Profile earn hub — hidden when economy.enabled is off (404 ECONOMY_DISABLED).
 * Coin amounts stay off /coach chat (§4 #3).
 */
export function EconomySection({ refreshKey = 0 }: EconomySectionProps) {
  return useEconomyEnabled()
    ? <EnabledEconomySection refreshKey={refreshKey} />
    : <RitualSection refreshKey={refreshKey} />;
}

function EnabledEconomySection({ refreshKey = 0 }: EconomySectionProps) {
  const t = useTranslations("economy");
  const profile = useTranslations("profile.earned");
  const sheet = useMentorBottomSheet();
  const [state, setState] = useState<EconomyState>({ status: "probing" });
  const [inviteOpen, setInviteOpen] = useState(false);
  const economyDisabledRef = useRef(false);
  const inviteRowRef = useRef<HTMLDivElement>(null);

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
      children: <EconomyBalanceCard />,
    });
  }

  function showQuests() {
    if (state.status !== "ready") return;
    sheet.show({
      title: t("quests_title"),
      layout: "filter",
      size: "wide",
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
      <Card solid className="p-2 sm:p-2.5">
        <div className="px-2 pt-1 pb-1.5">
          <h2
            className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {profile("title")}
          </h2>
        </div>
        <div className="flex flex-col gap-0.5">
          <ListRow onClick={showBalance}>
            {t("balance_title")}
          </ListRow>
          <ListRow
            onClick={showQuests}
          >
            {t("quests_title")}
          </ListRow>
          {/* Wrapped so the card can hand focus back to this row, also when it was opened from the
              quests sheet (the sheet that had focus is gone by then). */}
          <div ref={inviteRowRef}>
            <ListRow onClick={showInvite}>
              {t("invite_title")}
            </ListRow>
          </div>
        </div>
      </Card>
      {inviteOpen ? (
        <EconomyInviteCard
          invite={state.invite}
          onClose={() => setInviteOpen(false)}
          onRedeemed={() => void reload()}
          returnFocusTo={() => inviteRowRef.current?.querySelector<HTMLElement>("button, a") ?? null}
        />
      ) : null}
    </>
  );
}

/** Personal rituals remain reachable without loading balances or invitations. */
function RitualSection({ refreshKey }: EconomySectionProps) {
  const t = useTranslations("economy");
  const sheet = useMentorBottomSheet();
  const [quests, setQuests] = useState<QuestProgressView[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void fetchQuests().then(value => { if (active) { setQuests(value); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [refreshKey]);
  if (failed) return <FormError message={t("quests_load_error")} />;
  if (!quests) return <Card><Skeleton className="h-11 w-full" /></Card>;
  return <Card solid className="p-2 sm:p-2.5">
    <ListRow onClick={() => sheet.show({
      title: t("quests_title"), layout: "filter", size: "wide", bodyScroll: false,
      children: <EconomyQuestsCard quests={quests} onDismiss={sheet.dismissNow} />,
    })}>{t("quests_title")}</ListRow>
  </Card>;
}
