import { describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import { EconomyUsesRegistry } from "./economy-uses.registry";
import { EconomyUsesService } from "./economy-uses.service";

function setup() {
  const slots = {
    getState: vi.fn(async () => ({
      cost: 37,
      coinConfirmed: 42,
      purchasedSlots: 1,
      maxPurchasableSlots: 2,
      premium: false,
      canAfford: true,
      canPurchase: true,
      status: "AVAILABLE",
    })),
  };
  const registry = new EconomyUsesRegistry();
  let enabled = true;
  const service = new EconomyUsesService(slots as never, registry, {
    get: async () => enabled,
  } as never);
  return {
    service,
    slots,
    registry,
    close: () => {
      enabled = false;
    },
  };
}

describe("EconomyUsesService", () => {
  it("uses the current notebook price and owned capacity without spending", async () => {
    const s = setup();
    expect(await s.service.getView("user", [])).toMatchObject({
      coinConfirmed: 42,
      items: [
        {
          id: "NOTEBOOK_SLOT",
          cost: 37,
          status: "AVAILABLE",
          slotsOwned: 1,
          slotLimit: 2,
          canOpen: true,
        },
        { status: "UNAVAILABLE" },
        { status: "UNAVAILABLE" },
        { status: "UNAVAILABLE" },
      ],
    });
  });
  it("never loads offers when economy is closed", async () => {
    const s = setup();
    s.close();
    await expect(s.service.getView("user", [])).rejects.toMatchObject({
      code: ErrorCode.ECONOMY_DISABLED,
    });
    expect(s.slots.getState).not.toHaveBeenCalled();
  });
  it("does not show a price for capacity included with Premium", async () => {
    const s = setup();
    s.slots.getState.mockResolvedValue({
      cost: 37,
      coinConfirmed: 42,
      purchasedSlots: 1,
      maxPurchasableSlots: 2,
      premium: true,
      canAfford: true,
      canPurchase: false,
      status: "PREMIUM_INCLUDED",
    });
    expect((await s.service.getView("user", [])).items[0]).toMatchObject({
      cost: null,
      premiumIncluded: true,
      status: "PREMIUM_INCLUDED",
      canOpen: true,
    });
  });
});
