import { describe, expect, it } from "vitest";
import { putPreferenceSimulationSchema } from "@mentor/validation";

describe("putPreferenceSimulationSchema", () => {
  it("rejects duplicate program codes before the service is called", () => {
    const result = putPreferenceSimulationSchema.safeParse({
      datasetVersion: "yks-2026-guide-2025-placement-v1",
      expectedRevision: 0,
      ranks: { SAY: 42_000 },
      programCodes: ["102210277", "102210277"],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("duplicate_program_code");
    }
  });

  it("accepts a complete five-score rank profile with a unique ordered list", () => {
    const result = putPreferenceSimulationSchema.safeParse({
      datasetVersion: "yks-2026-guide-2025-placement-v1",
      expectedRevision: 4,
      ranks: { SAY: 42_000, EA: 30_000, SÖZ: null, DİL: 8_000, TYT: 90_000 },
      programCodes: ["102210277", "102210286"],
    });

    expect(result.success).toBe(true);
  });
});
