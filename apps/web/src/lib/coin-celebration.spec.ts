import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COIN_CELEBRATE_EVENT,
  type CoinCelebrateDetail,
  notifyCoinCelebration,
} from "./economy";

describe("notifyCoinCelebration", () => {
  let mockWindow: EventTarget;

  beforeEach(() => {
    mockWindow = new EventTarget();
    vi.stubGlobal("window", mockWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches custom event with amount and optional label", () => {
    const listener = vi.fn();
    mockWindow.addEventListener(COIN_CELEBRATE_EVENT, listener);

    notifyCoinCelebration(5, "Günlük Görev");

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0] as CustomEvent<CoinCelebrateDetail>;
    expect(event.detail).toEqual({
      amount: 5,
      label: "Günlük Görev",
    });

    mockWindow.removeEventListener(COIN_CELEBRATE_EVENT, listener);
  });

  it("does not dispatch if amount is zero or negative", () => {
    const listener = vi.fn();
    mockWindow.addEventListener(COIN_CELEBRATE_EVENT, listener);

    notifyCoinCelebration(0);
    notifyCoinCelebration(-5);

    expect(listener).not.toHaveBeenCalled();

    mockWindow.removeEventListener(COIN_CELEBRATE_EVENT, listener);
  });
});
