import { describe, expect, it, vi } from "vitest";
import { applyAuthAnalyticsChoice } from "./auth-analytics-choice";

describe("applyAuthAnalyticsChoice", () => {
  it("accepts when checked, rejects when not", () => {
    const accept = vi.fn();
    const reject = vi.fn();
    applyAuthAnalyticsChoice(true, { accept, reject });
    expect(accept).toHaveBeenCalledOnce();
    expect(reject).not.toHaveBeenCalled();

    accept.mockClear();
    applyAuthAnalyticsChoice(false, { accept, reject });
    expect(reject).toHaveBeenCalledOnce();
    expect(accept).not.toHaveBeenCalled();
  });
});
