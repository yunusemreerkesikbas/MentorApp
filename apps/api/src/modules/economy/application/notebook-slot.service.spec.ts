import { describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import { CoachingEntitlementRegistry } from "../../coaching/application/coaching-entitlement.registry";
import { NotebookSlotService } from "./notebook-slot.service";

function setup() {
  let purchased = 0;
  const refs = new Set<string>();
  const flags = {
    "economy.enabled": true,
    "economy.coin.notebook_slot_cost": 20,
    "economy.notebook_slots.max_per_user": 2,
  };
  const registry = new CoachingEntitlementRegistry();
  const ledger = {
    withServiceTx: async <T>(fn: (tx: never) => Promise<T>) => fn({} as never),
    acquireUserLock: vi.fn(),
    existsByRef: async (_type: string, ref: string) => refs.has(ref),
  };
  const slots = { countPurchased: async () => purchased };
  const economy = {
    getSelfBalance: async () => ({ coinConfirmed: 100 }),
    spendInServiceTx: vi.fn(
      async (_user: string, _cost: number, opts: { refId: string }) => {
        refs.add(opts.refId);
        purchased++;
        return { alreadySpent: false };
      },
    ),
  };
  const entitlement = {
    getEntitlement: vi.fn(async () => ({ isPremium: false })),
  };
  const service = new NotebookSlotService(
    economy as never,
    ledger as never,
    slots as never,
    registry,
    entitlement as never,
    { get: async (key: keyof typeof flags) => flags[key] } as never,
  );
  service.onModuleInit();
  const buy = (key = "request-1", cost = 20, count = 0) =>
    service.purchase("user-1", [], key, {
      expectedCost: cost,
      expectedPurchasedSlots: count,
    });
  return { service, economy, entitlement, flags, registry, buy };
}

describe("NotebookSlotService", () => {
  it("uses the configured price and registers permanent capacity independently of the flag", async () => {
    const s = setup();
    s.flags["economy.coin.notebook_slot_cost"] = 30;
    await s.buy("request-1", 30);
    expect(s.economy.spendInServiceTx).toHaveBeenCalledWith(
      "user-1",
      30,
      expect.objectContaining({ refId: "user-1:request-1" }),
      expect.anything(),
    );
    s.flags["economy.enabled"] = false;
    expect(await s.registry.notebookSlots("user-1")).toBe(1);
    await expect(s.service.getState("user-1", [])).rejects.toMatchObject({
      code: ErrorCode.ECONOMY_DISABLED,
    });
  });

  it("deduplicates retries and rejects another request for the same capacity increment", async () => {
    const s = setup();
    await s.buy();
    await s.buy();
    await expect(s.buy("request-2")).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
    });
    expect(s.economy.spendInServiceTx).toHaveBeenCalledTimes(1);
  });

  it("enforces the per-user cap without revoking already purchased slots", async () => {
    const s = setup();
    await s.buy();
    s.flags["economy.notebook_slots.max_per_user"] = 1;
    expect(await s.service.getState("user-1", [])).toMatchObject({
      purchasedSlots: 1,
      canPurchase: false,
    });
    await expect(s.buy("request-2", 20, 1)).rejects.toMatchObject({
      code: ErrorCode.ECONOMY_LIMIT_EXCEEDED,
    });
    expect(await s.registry.notebookSlots("user-1")).toBe(1);
  });

  it("rejects a changed quote before spending", async () => {
    const s = setup();
    s.flags["economy.coin.notebook_slot_cost"] = 25;
    await expect(s.buy()).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    expect(s.economy.spendInServiceTx).not.toHaveBeenCalled();
  });

  it("never charges Premium users or offers a closed sale", async () => {
    const s = setup();
    s.entitlement.getEntitlement.mockResolvedValue({ isPremium: true });
    expect(await s.service.getState("user-1", [])).toMatchObject({
      premium: true,
      canPurchase: false,
    });
    await expect(s.buy()).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    s.flags["economy.enabled"] = false;
    await expect(s.buy()).rejects.toMatchObject({
      code: ErrorCode.ECONOMY_DISABLED,
    });
    expect(s.economy.spendInServiceTx).not.toHaveBeenCalled();
  });
});
