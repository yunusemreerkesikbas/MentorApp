"use client";

import { useRouter } from "next/navigation";
import type { EconomyBalance } from "@mentor/types";
import { Button, Card, SectionHeading } from "@mentor/ui";

interface EconomyBalanceCardProps {
  balance: EconomyBalance;
}

/**
 * Earned XP + confirmed coin on the profile hub only (never in chat §4 #3).
 */
export function EconomyBalanceCard({ balance }: EconomyBalanceCardProps) {
  const router = useRouter();

  return (
    <Card>
      <SectionHeading
        subtitle="Kazanılmış hak — nakit değildir; koç sohbeti ve ilerideki özellikler için kullanılır."
      >
        Bakiyen
      </SectionHeading>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm" style={{ color: "var(--color-secondary)" }}>
            XP
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
            Onaylı hak
          </dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {balance.coinConfirmed}
          </dd>
          {balance.coinPending > 0 ? (
            <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
              +{balance.coinPending} beklemede
            </p>
          ) : null}
        </div>
      </dl>
      <div className="mt-4">
        <Button type="button" onClick={() => router.push("/koc")}>
          Koça git
        </Button>
      </div>
    </Card>
  );
}
