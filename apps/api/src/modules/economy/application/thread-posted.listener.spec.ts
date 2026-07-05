import { describe, expect, it, vi } from "vitest";
import { Currency } from "@mentor/types";
import { ThreadPostedListener } from "./thread-posted.listener";

const EVENT = { zoneId: "z1", threadId: "t1", authorId: "u1" };

function setup(config: Record<string, unknown> = {}) {
  const defaults = {
    "economy.enabled": true,
    "forum.xp.thread_posted": 2,
    "forum.xp.thread_posted_daily_cap": 10,
  };
  const economy = { grant: vi.fn().mockResolvedValue(undefined) };
  const ledger = { grantCountSince: vi.fn().mockResolvedValue(0) };
  const registry = { get: vi.fn(async (k: string) => ({ ...defaults, ...config })[k]) };
  const listener = new ThreadPostedListener(economy as never, ledger as never, registry as never);
  return { listener, economy, ledger };
}

describe("ThreadPostedListener", () => {
  it("grants XP for a post under the daily cap", async () => {
    const { listener, economy } = setup();
    await listener.onThreadPosted(EVENT);
    expect(economy.grant).toHaveBeenCalledWith(
      "u1",
      Currency.XP,
      2,
      expect.objectContaining({ reason: "forum.thread.posted", refId: "t1" }),
    );
  });

  it("skips when the economy is disabled", async () => {
    const { listener, economy } = setup({ "economy.enabled": false });
    await listener.onThreadPosted(EVENT);
    expect(economy.grant).not.toHaveBeenCalled();
  });

  it("skips once the daily cap is reached", async () => {
    const { listener, economy, ledger } = setup();
    ledger.grantCountSince.mockResolvedValue(10);
    await listener.onThreadPosted(EVENT);
    expect(economy.grant).not.toHaveBeenCalled();
  });

  it("swallows grant errors (best-effort, never breaks the post)", async () => {
    const { listener, economy } = setup();
    economy.grant.mockRejectedValue(new Error("boom"));
    await expect(listener.onThreadPosted(EVENT)).resolves.toBeUndefined();
  });
});
