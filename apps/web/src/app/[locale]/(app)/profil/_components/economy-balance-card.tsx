"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { EconomyBalance, EconomyLedgerEntryView } from "@mentor/types";
import { Button, Card, SectionHeading } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { fetchEconomyLedger } from "@/lib/economy";

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
  const locale = useLocale();
  const translate = useTranslations("economy");
  const [ledger, setLedger] = useState<LedgerState>({ status: "loading" });

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
      <div className="mt-4">
        <Button type="button" onClick={() => router.push("/koc")}>
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
