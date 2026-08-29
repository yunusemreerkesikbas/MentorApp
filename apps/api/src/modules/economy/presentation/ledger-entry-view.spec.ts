import { describe, expect, it } from "vitest";
import { Currency, LedgerStatus } from "@mentor/types";
import type { LedgerRow } from "../infrastructure/ledger.repository";
import { toLedgerEntryView, type LedgerCopyFn } from "./ledger-entry-view";
import tr from "../../../i18n/locales/tr/economy.json";
import en from "../../../i18n/locales/en/economy.json";

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

function flatten(obj: unknown, prefix = ""): string[] {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return prefix ? [prefix] : [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}.${key}` : key),
  );
}

function lookup(
  catalog: typeof tr,
  key: string,
  args: Record<string, unknown> = {},
): string {
  const parts = key.split(".");
  let current: unknown = catalog;
  for (const part of parts) {
    if (!current || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current !== "string") return key;
  return current.replace(/\{(\w+)\}/g, (_, name: string) => String(args[name] ?? `{${name}}`));
}

const tTr: LedgerCopyFn = (key, args) => lookup(tr, key, args);
const tEn: LedgerCopyFn = (key, args) => lookup(en, key, args);

describe("toLedgerEntryView", () => {
  it("keeps TR/EN ledger catalog keys at parity", () => {
    expect(flatten(tr).toSorted()).toEqual(flatten(en).toSorted());
  });

  it("maps quest rewards to a user-facing task title from i18n", () => {
    expect(toLedgerEntryView(row("quest.daily.plan-task-done"), tTr)).toMatchObject({
      title: "Görev hakkı",
      description: "Bugünün planından 1 görev tamamla",
    });
  });

  it("strips {target} from a weekly title, and prefers an explicit ledgerTitle when set", () => {
    expect(toLedgerEntryView(row("quest.weekly.focus-sessions"), tTr)).toMatchObject({
      description: "Bu hafta odak seansı tamamla",
    });
    expect(
      toLedgerEntryView(row("quest.weekly.effort-allowance", Currency.COIN), tTr),
    ).toMatchObject({
      title: "Görev hakkı",
      description: "Haftalık aktif gün hedefi",
    });
  });

  it("resolves milestone {days}/{count} from the quest id on the ledger line", () => {
    expect(toLedgerEntryView(row("quest.milestone.streak.7"), tTr)).toMatchObject({
      description: "7 günlük ritme ulaş",
    });
    expect(toLedgerEntryView(row("quest.milestone.focus_sessions.25"), tTr)).toMatchObject({
      description: "25 odak seansı tamamla",
    });
  });

  it("maps AI chat spends without leaking the raw reason", () => {
    expect(toLedgerEntryView(row("ai.chat.spend", Currency.COIN), tTr)).toMatchObject({
      title: "Koç sohbet hakkı kullanıldı",
      description: "Koç sohbetinde kazanılmış hak kullanıldı.",
    });
  });

  it("maps streak-freeze purchases to a friendly label", () => {
    expect(toLedgerEntryView(row("streak.freeze.purchase", Currency.COIN), tTr)).toMatchObject({
      title: "Seri kurtarma",
    });
  });

  it("maps streak-freeze refunds to a friendly label", () => {
    expect(toLedgerEntryView(row("streak.freeze.refund", Currency.COIN), tTr)).toMatchObject({
      title: "Seri kurtarma iadesi",
    });
  });

  it("maps invite reversals to a rights label, not a prize", () => {
    expect(toLedgerEntryView(row("invite.reverted", Currency.COIN), tTr)).toMatchObject({
      title: "Davet hakkı geri alındı",
    });
  });

  it("maps deep-analysis purchases to a friendly label", () => {
    expect(toLedgerEntryView(row("analysis.deep.purchase", Currency.COIN), tTr)).toMatchObject({
      title: "Derin analiz açıldı",
    });
  });

  it("uses a safe fallback for unknown reasons", () => {
    expect(toLedgerEntryView(row("internal.debug.reason"), tTr)).toMatchObject({
      title: "Ekonomi hareketi",
      description: "Hesabında bir XP hareketi işlendi.",
    });
  });

  it("resolves English ledger copy from Accept-Language catalog", () => {
    expect(toLedgerEntryView(row("invite.reverted", Currency.COIN), tEn)).toMatchObject({
      title: "Invite right reversed",
    });
    expect(toLedgerEntryView(row("internal.debug.reason"), tEn)).toMatchObject({
      title: "Ledger movement",
      description: "XP landed on your account.",
    });
    expect(toLedgerEntryView(row("quest.weekly.effort-allowance", Currency.COIN), tEn)).toMatchObject({
      title: "Quest right",
      description: "Weekly active-day goal",
    });
    expect(toLedgerEntryView(row("quest.weekly.focus-sessions"), tEn)).toMatchObject({
      description: "Complete focus sessions this week",
    });
  });
});
