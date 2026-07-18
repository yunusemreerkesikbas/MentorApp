import { describe, expect, it } from "vitest";
import { Currency, LedgerStatus } from "@mentor/types";
import type { LedgerRow } from "../infrastructure/ledger.repository";
import { toLedgerEntryView } from "./ledger-entry-view";

const row = (reason: string, unit: Currency = Currency.XP): LedgerRow =>
  ({
    id: "ledger-1",
    userId: "user-1",
    unit,
    amount: unit === Currency.COIN ? -1 : 5,
    reason,
    status: LedgerStatus.CONFIRMED,
    refType: null,
    refId: null,
    note: null,
    createdBy: null,
    createdAt: new Date("2026-07-09T09:00:00.000Z"),
  }) as LedgerRow;

describe("toLedgerEntryView", () => {
  it("maps quest rewards to a user-facing task title", () => {
    expect(toLedgerEntryView(row("quest.daily.plan-task-done"))).toMatchObject({
      title: "Görev ödülü",
      description: "Bugünün planından 1 görev tamamla",
    });
  });

  it("maps AI chat spends without leaking the raw reason", () => {
    expect(toLedgerEntryView(row("ai.chat.spend", Currency.COIN))).toMatchObject({
      title: "Koç sohbet hakkı kullanıldı",
      description: "Koç sohbetinde kazanılmış hak kullanıldı.",
    });
  });

  it("maps streak-freeze purchases to a friendly label", () => {
    expect(toLedgerEntryView(row("streak.freeze.purchase", Currency.COIN))).toMatchObject({
      title: "Seri kurtarma",
    });
  });

  it("maps streak-freeze refunds to a friendly label", () => {
    expect(toLedgerEntryView(row("streak.freeze.refund", Currency.COIN))).toMatchObject({
      title: "Seri kurtarma iadesi",
    });
  });

  it("maps invite reversals to a friendly label", () => {
    expect(toLedgerEntryView(row("invite.reverted", Currency.COIN))).toMatchObject({
      title: "Davet ödülü geri alındı",
    });
  });

  it("maps deep-analysis purchases to a friendly label", () => {
    expect(toLedgerEntryView(row("analysis.deep.purchase", Currency.COIN))).toMatchObject({
      title: "Derin analiz açıldı",
    });
  });

  it("uses a safe fallback for unknown reasons", () => {
    expect(toLedgerEntryView(row("internal.debug.reason"))).toMatchObject({
      title: "Ekonomi hareketi",
      description: "Hesabında bir XP hareketi işlendi.",
    });
  });
});
