import type { EconomyLedgerEntryView, Paginated } from "@mentor/types";

/** What `createRewardSync` needs from the app: the balance store, the receipt API and the presenter. */
export interface RewardSyncPort {
  refreshBalance(): Promise<void>;
  /** False while receipts must wait (economy closed, coach screens). */
  canPresent(): boolean;
  fetchUnseen(): Promise<Paginated<EconomyLedgerEntryView>>;
  /** Receipts another surface acknowledges itself (the weekly chest scene). */
  isHeld(entry: EconomyLedgerEntryView): boolean;
  /** Shows the receipt; false when it was already shown. */
  present(entry: EconomyLedgerEntryView): boolean;
  markSeen(ids: string[]): Promise<void>;
}

/** Balance, then unseen receipts. Calls made while a run is going fold into one more pass. */
export function createRewardSync(port: RewardSyncPort, isActive: () => boolean): () => Promise<void> {
  let running = false;
  let dirty = false;
  return async function sync() {
    dirty = true;
    if (running) return;
    running = true;
    try {
      while (isActive() && dirty) {
        dirty = false;
        await port.refreshBalance();
        if (!isActive() || !port.canPresent()) continue;
        let more = true;
        while (isActive() && more) {
          const rewards = await port.fetchUnseen();
          if (!isActive() || !port.canPresent() || rewards.items.length === 0) break;
          const shown = rewards.items.filter((entry) => !port.isHeld(entry));
          if (shown.length === 0) break;
          const fresh = shown.filter((entry) => port.present(entry)).length > 0;
          await port.markSeen(shown.map((entry) => entry.id));
          // The balance read above can predate these grants (a quests or chest read writes them),
          // so read it again. Only for new receipts: one the server keeps returning cannot loop.
          if (fresh) dirty = true;
          more = rewards.total > rewards.items.length;
        }
      }
    } finally { running = false; }
  };
}

/** Everyday Coin (daily active day, a rewarded ad) is a quiet toast; the overlay stays special. */
const QUIET_COIN_REASONS = new Set(["quest.daily.active-day", "ad.reward.completed"]);

export function rewardPresentation(entry: { unit: string; reason: string }): "CELEBRATION" | "COIN_TOAST" | "XP_TOAST" {
  if (entry.unit !== "COIN") return "XP_TOAST";
  return QUIET_COIN_REASONS.has(entry.reason) ? "COIN_TOAST" : "CELEBRATION";
}

/** The ledger reason of the weekly chest's grant. */
export const WEEKLY_CHEST_REASON = "quest.weekly.effort-allowance";

/** The chest's own Coin receipt waits for the scene; one older than two weeks can no longer open. */
const HELD_RECEIPT_MS = 14 * 24 * 60 * 60 * 1000;

export function isHeldChestReceipt(entry: Pick<EconomyLedgerEntryView, "reason" | "createdAt">, now: number): boolean {
  return entry.reason === WEEKLY_CHEST_REASON && now - Date.parse(entry.createdAt) < HELD_RECEIPT_MS;
}
