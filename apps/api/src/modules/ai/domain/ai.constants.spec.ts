import { describe, expect, it } from "vitest";

import { estimateCostMicros } from "./ai.constants";

describe("estimateCostMicros", () => {
  it("uses the verified GPT-5 standard token price", () => {
    expect(estimateCostMicros("gpt-5", 1_000_000, 1_000_000)).toBe(11_250_000);
    expect(estimateCostMicros("gpt-5-2025-08-07", 800, 200)).toBe(3_000);
  });
});
