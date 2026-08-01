"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { EconomyBalance, EconomyLedgerEntryView } from "@mentor/types";
import { Button, Card, SectionHeading } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { fetchEconomyLedger } from "@/lib/economy";
import { coachReturnHref } from "@/lib/community-coach-bridge";

interface EconomyBalanceCardProps {
  balance: EconomyBalance;
}

type LedgerState =
  | { status: "loading" }
  | { status: "ready"; entries: EconomyLedgerEntryView[] }
  | { status: "error" };

/**
 * Earned XP + confirmed coin on the profile hub only (never in chat §4 #3).
 */
export function EconomyBalanceCard({ balance }: EconomyBalanceCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const translate = useTranslations("economy");
  // Tier names already exist for the community profile — reuse, don't duplicate the copy.
  const community = useTranslations("community");
  const [ledger, setLedger] = useState<LedgerState>({ status: "loading" });
  const { level } = balance;
  const levelPct = level.nextAt ? Math.min(100, Math.round((level.xp / level.nextAt) * 100)) : 100;

  useEffect(() => {
    let active = true;
    fetchEconomyLedger()
      .then((entries) => {
        if (active) setLedger({ status: "ready", entries });
      })
      .catch(() => {
        if (active) setLedger({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }),
    [locale],
  );

  return (
    <Card>
      <SectionHeading subtitle={translate("balance_subtitle")}>
        {translate("balance_title")}
      </SectionHeading>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {translate("xp")}
          </dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {balance.xp}
          </dd>
        </div>
        <div>
          <dt className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {translate("confirmed")}
          </dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {balance.coinConfirmed}
          </dd>
          {balance.coinPending > 0 ? (
            <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
              {translate("pending", { count: balance.coinPending })}
            </p>
          ) : null}
        </div>
      </dl>
      <div className="mt-4 flex flex-col gap-1.5">
        <div
          className="flex items-center justify-between text-xs"
          style={{ color: "var(--color-secondary)" }}
        >
          <span>
            {community("level_label", { tier: level.tier })} —{" "}
            {community(`level_${level.tier}` as "level_1")}
          </span>
          {level.nextAt ? (
            <span className="tabular-nums">
              {level.xp} / {level.nextAt}
            </span>
          ) : null}
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--color-progress-track)" }}
          role="progressbar"
          aria-valuenow={levelPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={community("level_label", { tier: level.tier })}
        >
          <div
            className="h-full rounded-full transition-[width] motion-reduce:transition-none"
            style={{ width: `${levelPct}%`, background: "var(--color-progress)" }}
          />
        </div>
      </div>
      <div className="mt-4">
        <Button
          type="button"
          onClick={() =>
            router.push(coachReturnHref(searchParams.get("returnTo")))
          }
        >
          {translate("go_coach")}
        </Button>
      </div>
      <div className="mt-6 border-t border-black/10 pt-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
          {translate("ledger_title")}
        </h3>
        {ledger.status === "loading" ? (
          <p className="mt-3 text-sm" style={{ color: "var(--color-secondary)" }}>
            {translate("ledger_loading")}
          </p>
        ) : ledger.status === "error" ? (
          <p className="mt-3 text-sm" style={{ color: "var(--color-secondary)" }}>
            {translate("ledger_error")}
          </p>
        ) : ledger.entries.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--color-secondary)" }}>
            {translate("ledger_empty")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-black/10">
            {ledger.entries.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
                    {entry.title}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
                    {entry.description}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
                    {dateFormatter.format(new Date(entry.createdAt))}
                  </p>
                </div>
                <span
                  className="shrink-0 text-sm font-semibold tabular-nums"
                  style={{ color: "var(--color-main)" }}
                >
                  {formatLedgerAmount(entry)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function formatLedgerAmount(entry: EconomyLedgerEntryView): string {
  const sign = entry.amount > 0 ? "+" : "";
  return `${sign}${entry.amount} ${entry.unit === "COIN" ? "Coin" : "XP"}`;
}
