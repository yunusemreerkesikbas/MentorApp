import { Currency, type EconomyLedgerEntryView } from "@mentor/types";
import { EconomyLedger } from "../domain/economy.constants";
import { QUEST_CATALOG } from "../domain/quest.catalog";
import type { LedgerRow } from "../infrastructure/ledger.repository";

const questTitles = new Map(QUEST_CATALOG.map((quest) => [`quest.${quest.id}`, quest.title]));

export function toLedgerEntryView(row: LedgerRow): EconomyLedgerEntryView {
  const display = displayFor(row);
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

function displayFor(row: LedgerRow): { title: string; description: string } {
  const questTitle = questTitles.get(row.reason);
  if (questTitle) return { title: "Görev ödülü", description: questTitle };

  if (row.reason === EconomyLedger.AI_CHAT_SPEND_REASON) {
    return {
      title: "Koç sohbet hakkı kullanıldı",
      description: "Koç sohbetinde kazanılmış hak kullanıldı.",
    };
  }
  if (row.reason === EconomyLedger.AI_CHAT_REFUND_REASON) {
    return {
      title: "Koç sohbet hakkı iade edildi",
      description: "Kullanılamayan sohbet hakkı hesabına geri işlendi.",
    };
  }
  if (row.reason === "invite.converted") {
    return {
      title: "Davet ödülü",
      description: "Davetin aktifleştikçe hesabına hak işlendi.",
    };
  }
  if (row.reason === "forum.answer.accepted" || row.reason === "forum.thread.posted") {
    return {
      title: "Topluluk katkısı",
      description: "Toplulukta katkın için XP işlendi.",
    };
  }
  return {
    title: "Ekonomi hareketi",
    description: `Hesabında bir ${row.unit === Currency.XP ? "XP" : "Coin"} hareketi işlendi.`,
  };
}
