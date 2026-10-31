import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@mentor/api-client";
import type { EconomyBalance } from "@mentor/types";
import { fetchEconomyBalance } from "./economy";
import { refreshEconomySnapshot, resetEconomySnapshot, getEconomySnapshot, disableEconomySnapshot } from "./economy-store";

vi.mock("./economy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./economy")>();
  return { ...actual, fetchEconomyBalance: vi.fn() };
});

const fetchBalance = vi.mocked(fetchEconomyBalance);

function balance(xp: number, coinConfirmed: number): EconomyBalance {
  return { xp, coinConfirmed, coinPending: 0, level: {} as EconomyBalance["level"] };
}

afterEach(() => {
  resetEconomySnapshot();
  fetchBalance.mockReset();
});

describe("refreshEconomySnapshot", () => {
  it("does not reload a closed economy or restore a late balance response", async () => {
    let resolve!: (value: EconomyBalance) => void;
    fetchBalance.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const loading = refreshEconomySnapshot();
    disableEconomySnapshot();
    resolve(balance(100, 7));
    await loading;
    await refreshEconomySnapshot();
    expect(getEconomySnapshot()).toMatchObject({ balance: null, enabled: false, error: false });
    expect(fetchBalance).toHaveBeenCalledTimes(1);
  });
  it("keeps the last balance when a later refresh fails transiently", async () => {
    fetchBalance
      .mockResolvedValueOnce(balance(100, 7))
      .mockRejectedValueOnce(new Error("network"));

    await refreshEconomySnapshot();
    expect(getEconomySnapshot()).toMatchObject({ balance: balance(100, 7), error: false });

    await refreshEconomySnapshot();
    expect(getEconomySnapshot()).toMatchObject({ balance: balance(100, 7), error: true });
  });

  it("clears the balance when the economy feature is off", async () => {
    fetchBalance
      .mockResolvedValueOnce(balance(100, 7))
      .mockRejectedValueOnce(new ApiClientError(404, {
        code: "ECONOMY_DISABLED",
        message: "Economy is off",
      }));

    await refreshEconomySnapshot();
    await refreshEconomySnapshot();
    expect(getEconomySnapshot()).toMatchObject({ balance: null, error: false });
  });
});
