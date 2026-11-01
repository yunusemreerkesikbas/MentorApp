"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { EconomyUsesView, EconomyUseView } from "@mentor/types";
import { Button, Skeleton } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { coachReturnHref } from "@/lib/community-coach-bridge";
import { fetchEconomyUses, isEconomyDisabled } from "@/lib/economy";
import {
  disableEconomySnapshot,
  refreshEconomySnapshot,
  useEconomySnapshot,
} from "@/lib/economy-store";
import { useEconomyEnabled } from "@/lib/use-economy-enabled";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";

type State = { key: string; view: EconomyUsesView | null };

/** A server-derived snapshot, outside the chat zone. Navigation never purchases a right. */
export function EconomyUsesCard() {
  const t = useTranslations("economy.uses");
  const enabled = useEconomyEnabled();
  const snapshot = useEconomySnapshot();
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const sheet = useMentorBottomSheet();
  const [state, setState] = useState<State | null>(null);
  const key = `${user?.id}:${snapshot.revision}`;

  useEffect(() => {
    if (!enabled || !user?.id) return;
    let active = true;
    fetchEconomyUses()
      .then((view) => {
        if (active) setState({ key, view });
      })
      .catch((error) => {
        if (!active) return;
        if (isEconomyDisabled(error)) disableEconomySnapshot();
        else setState({ key, view: null });
      });
    return () => {
      active = false;
    };
  }, [enabled, user?.id, key]);

  function open(item: EconomyUseView) {
    sheet.dismissNow();
    if (item.id === "NOTEBOOK_SLOT") router.push("/notebooks");
    else if (item.id === "DEEP_ANALYSIS") router.push("/analysis/recap");
    else router.push(coachReturnHref(params.get("returnTo")));
  }

  if (!enabled) return null;
  const current = state?.key === key ? state : null;
  return (
    <section
      className="mt-6 border-t border-[var(--color-border)] pt-4"
      aria-label={t("title")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-[var(--color-main)]">{t("title")}</h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void refreshEconomySnapshot()}
        >
          {t("refresh")}
        </Button>
      </div>
      <p className="mt-3 text-sm text-[var(--color-secondary)]">
        {t("xp_note")}
      </p>
      {!current ? (
        <div role="status" aria-label={t("loading")} className="mt-4 space-y-3">
          {[0, 1, 2].map((id) => (
            <Skeleton key={id} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : !current.view ? (
        <p role="alert" className="mt-4 text-sm text-[var(--color-secondary)]">
          {t("error")}
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm font-semibold">
            {t("balance", { coin: current.view.coinConfirmed })}
          </p>
          <ul className="mt-4 space-y-3">
            {current.view.items.map((item) => (
              <li
                key={item.id}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-bold text-[var(--color-main)]">
                    {t(`items.${item.id}.title`)}
                  </h4>
                  {item.premiumIncluded ? (
                    <span className="text-sm font-semibold text-[var(--color-secondary)]">
                      {t("premium")}
                    </span>
                  ) : item.cost !== null ? (
                    <span className="font-bold tabular-nums text-[var(--color-main)]">
                      {t("cost", { cost: item.cost })}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-[var(--color-secondary)]">
                  {t(`items.${item.id}.description`)}
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {t(`status.${item.status}`)}
                </p>
                {item.dailyRemaining !== undefined ? (
                  <p className="mt-1 text-sm text-[var(--color-secondary)]">
                    {t("daily", { count: item.dailyRemaining })}
                  </p>
                ) : null}
                {item.slotsOwned !== undefined &&
                item.slotLimit !== undefined ? (
                  <p className="mt-1 text-sm text-[var(--color-secondary)]">
                    {t("slots", { used: item.slotsOwned, max: item.slotLimit })}
                  </p>
                ) : null}
                {item.canOpen ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    onClick={() => open(item)}
                  >
                    {t(`items.${item.id}.action`)}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--color-secondary)]">
            {t("recheck")}
          </p>
        </>
      )}
    </section>
  );
}
