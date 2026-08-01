import {
  coachActionDecisionSchema,
  coachMemoryFactPatchSchema,
  coachProfilePatchSchema,
} from "@mentor/validation";

describe("personalized mentor v2 request contracts", () => {
  it("accepts explicit memory consent and bounded communication preferences", () => {
    expect(
      coachProfilePatchSchema.parse({
        calibrationStatus: "COMPLETED",
        memoryConsent: "GRANTED",
        supportPreference: "ACTION",
        directnessPreference: "DIRECT",
      }),
    ).toEqual({
      calibrationStatus: "COMPLETED",
      memoryConsent: "GRANTED",
      supportPreference: "ACTION",
      directnessPreference: "DIRECT",
    });
  });

  it("rejects empty profile patches and unsupported preference values", () => {
    expect(coachProfilePatchSchema.safeParse({}).success).toBe(false);
    expect(
      coachProfilePatchSchema.safeParse({ memoryConsent: true }).success,
    ).toBe(false);
    expect(
      coachProfilePatchSchema.safeParse({ directnessPreference: "HARSH" })
        .success,
    ).toBe(false);
  });

  it("accepts only a user-editable structured memory value", () => {
    expect(coachMemoryFactPatchSchema.parse({ value: "EVENING" })).toEqual({
      value: "EVENING",
    });
    expect(
      coachMemoryFactPatchSchema.safeParse({ value: "", sourceQuote: "x" })
        .success,
    ).toBe(false);
  });

  it("requires an explicit action decision", () => {
    expect(coachActionDecisionSchema.parse({ decision: "ACCEPT" })).toEqual({
      decision: "ACCEPT",
    });
    expect(
      coachActionDecisionSchema.safeParse({ decision: "YES" }).success,
    ).toBe(false);
  });
});
