import { Currency, type EconomyLedgerEntryView } from "@mentor/types";
import { EconomyLedger } from "../domain/economy.constants";
import { resolveQuestLedgerDescription, type QuestCopyFn } from "../domain/quest-copy";
import type { LedgerRow } from "../infrastructure/ledger.repository";

export type LedgerCopyFn = QuestCopyFn;

export function toLedgerEntryView(row: LedgerRow, t: LedgerCopyFn): EconomyLedgerEntryView {
  const display = displayFor(row, t);
  return {
    id: row.id,
    unit: row.unit as EconomyLedgerEntryView["unit"],
    amount: row.amount,
    reason: row.reason,
    status: row.status as EconomyLedgerEntryView["status"],
    note: row.note,
    title: display.title,
    description: display.description,
    createdAt: row.createdAt.toISOString(),
  };
}

function displayFor(row: LedgerRow, t: LedgerCopyFn): { title: string; description: string } {
  if (row.reason.startsWith("quest.")) {
    const description = resolveQuestLedgerDescription(t, row.reason.slice("quest.".length));
    if (description) return { title: t("ledger.questReward.title"), description };
  }

  if (row.reason === EconomyLedger.AI_CHAT_SPEND_REASON) {
    return {
      title: t("ledger.aiChatSpend.title"),
      description: t("ledger.aiChatSpend.description"),
    };
  }
  if (row.reason === EconomyLedger.AI_CHAT_REFUND_REASON) {
    return {
      title: t("ledger.aiChatRefund.title"),
      description: t("ledger.aiChatRefund.description"),
    };
  }
  if (row.reason === EconomyLedger.STREAK_FREEZE_SPEND_REASON) {
    return {
      title: t("ledger.streakFreeze.title"),
      description: t("ledger.streakFreeze.description"),
    };
  }
  if (row.reason === EconomyLedger.STREAK_FREEZE_REFUND_REASON) {
    return {
      title: t("ledger.streakFreezeRefund.title"),
      description: t("ledger.streakFreezeRefund.description"),
    };
  }
  if (row.reason === EconomyLedger.INVITE_CONVERTED_REASON) {
    return {
      title: t("ledger.inviteConverted.title"),
      description: t("ledger.inviteConverted.description"),
    };
  }
  if (row.reason === EconomyLedger.INVITE_REVERSAL_REASON) {
    return {
      title: t("ledger.inviteReversal.title"),
      description: t("ledger.inviteReversal.description"),
    };
  }
  if (row.reason === EconomyLedger.DEEP_ANALYSIS_SPEND_REASON) {
    return {
      title: t("ledger.deepAnalysis.title"),
      description: t("ledger.deepAnalysis.description"),
    };
  }
  if (row.reason === "forum.answer.accepted" || row.reason === "forum.thread.posted") {
    return {
      title: t("ledger.community.title"),
      description: t("ledger.community.description"),
    };
  }
  const unit = row.unit === Currency.XP ? "XP" : "Coin";
  return {
    title: t("ledger.fallback.title"),
    description: t("ledger.fallback.description", { unit }),
  };
}
