import { describe, expect, it } from "vitest";
import { ApiClientError } from "@mentor/api-client";
import { keepsCoinQuote, newQuote, wizardCoinQuote, type PlanCoinQuote } from "./use-plan-coin-flow";

type PlanInput = PlanCoinQuote["input"];

describe("wizardCoinQuote", () => {
  const input = { source: "PLAN", minutesPerDay: 60 } as unknown as PlanInput;
  const last = newQuote({ input, progress: { done: 3, total: 4 } }, 200);

  it("sends the last request again when the answers and the price are unchanged", () => {
    const quote = wizardCoinQuote(last, { input: { ...input }, progress: { done: 4, total: 4 } }, 200);
    expect(quote.requestId).toBe(last.requestId);
    expect(quote.progress).toEqual({ done: 4, total: 4 });
  });

  it("starts a fresh request when an answer changed", () => {
    const changed = { ...input, minutesPerDay: 90 } as PlanInput;
    expect(wizardCoinQuote(last, { input: changed, progress: null }, 200).requestId).not.toBe(last.requestId);
  });

  it("starts a fresh request when the price changed", () => {
    const quote = wizardCoinQuote(last, { input, progress: null }, 250);
    expect(quote.requestId).not.toBe(last.requestId);
    expect(quote.cost).toBe(250);
  });

  it("starts a fresh request when there is no last one or it was a resume", () => {
    expect(wizardCoinQuote(null, { input, progress: null }, 200).requestId).toBeTruthy();
    const resumed = { ...last, resume: true };
    expect(wizardCoinQuote(resumed, { input, progress: null }, 200).requestId).not.toBe(last.requestId);
  });
});

describe("keepsCoinQuote", () => {
  const apiError = (code: string) => new ApiClientError(409, { code, message: code } as never);

  it("keeps the request after a lost answer", () => {
    expect(keepsCoinQuote(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("keeps the request while the server is still preparing it", () => {
    expect(keepsCoinQuote(apiError("AI_PLAN_REQUEST_PROCESSING"))).toBe(true);
  });

  it("drops the request after any other answer from the server", () => {
    expect(keepsCoinQuote(apiError("AI_PLAN_PRICE_CHANGED"))).toBe(false);
    expect(keepsCoinQuote(apiError("AI_PROVIDER_ERROR"))).toBe(false);
  });
});
