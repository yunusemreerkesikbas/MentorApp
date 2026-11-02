import { describe, expect, it, vi } from "vitest";
import type { EconomyLedgerEntryView } from "@mentor/types";
import { createRewardSync, type RewardSyncPort } from "./reward-sync";

const receipt = { id: "r1", unit: "COIN", amount: 100, reason: "quest.onboarding.profile-setup" } as EconomyLedgerEntryView;
const page = (items: EconomyLedgerEntryView[]) => ({ items, total: items.length, page: 1, pageSize: 20 });

function port(unseen: () => EconomyLedgerEntryView[], calls: string[], fresh = () => true): RewardSyncPort {
  return {
    refreshBalance: vi.fn(async () => { calls.push("balance"); }),
    canPresent: () => true,
    fetchUnseen: vi.fn(async () => { calls.push("unseen"); return page(unseen()); }),
    isHeld: () => false,
    present: vi.fn(() => { calls.push("present"); return fresh(); }),
    markSeen: vi.fn(async () => { calls.push("seen"); }),
  };
}

describe("createRewardSync", () => {
  // A quests or chest read can grant while the balance is in flight (first login: 0 Coin pill under
  // a "+200 Coin" celebration), so the balance is read again once receipts are shown.
  it("re-reads the balance after presenting receipts", async () => {
    const calls: string[] = [];
    let first = true;
    const sync = createRewardSync(port(() => (first ? ((first = false), [receipt]) : []), calls), () => true);
    await sync();
    expect(calls).toEqual(["balance", "unseen", "present", "seen", "balance", "unseen"]);
  });

  it("stops when the server keeps returning a receipt it already showed", async () => {
    const calls: string[] = [];
    let shown = false;
    const sync = createRewardSync(port(() => [receipt], calls, () => (shown ? false : (shown = true))), () => true);
    await sync();
    expect(calls.filter((call) => call === "balance")).toHaveLength(2);
  });
});
