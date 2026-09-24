import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscriptionsControllerGetMine } from "@mentor/api-client";
import {
  fetchSubscriptionView,
  SUBSCRIPTION_VIEW_TIMEOUT_MS,
} from "./subscription-view";

vi.mock("@mentor/api-client", () => ({
  subscriptionsControllerGetMine: vi.fn(),
}));

const read = vi.mocked(subscriptionsControllerGetMine);

function hangUntilAbort(init?: RequestInit): Promise<never> {
  return new Promise((_resolve, reject) => {
    const fail = () => reject(new DOMException("The operation was aborted.", "AbortError"));
    if (init?.signal?.aborted) {
      fail();
      return;
    }
    init?.signal?.addEventListener("abort", fail, { once: true });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  read.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchSubscriptionView", () => {
  it("returns null when the subscription read never settles", async () => {
    read.mockImplementation(hangUntilAbort);

    const pending = fetchSubscriptionView();
    await vi.advanceTimersByTimeAsync(SUBSCRIPTION_VIEW_TIMEOUT_MS);

    await expect(pending).resolves.toBeNull();
    expect(read.mock.calls[0]?.[0]?.signal?.aborted).toBe(true);
  });

  it("starts a new request after the hung read is aborted", async () => {
    read.mockImplementationOnce(hangUntilAbort);
    const first = fetchSubscriptionView();
    await vi.advanceTimersByTimeAsync(SUBSCRIPTION_VIEW_TIMEOUT_MS);
    await first;

    read.mockResolvedValueOnce({ entitlement: { isPremium: true } } as never);
    await expect(fetchSubscriptionView()).resolves.toMatchObject({
      entitlement: { isPremium: true },
    });
    expect(read).toHaveBeenCalledTimes(2);
  });
});
