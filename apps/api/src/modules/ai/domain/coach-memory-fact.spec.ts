import { CoachMemoryFactKey } from "@mentor/types";
import { validateMemoryCandidate } from "./coach-memory-fact";

const now = new Date("2026-08-01T12:00:00.000Z");

describe("validateMemoryCandidate", () => {
  it("accepts an explicit exact quote and normalizes an allowlisted value", () => {
    expect(
      validateMemoryCandidate(
        "Ben akşamları daha iyi çalışıyorum.",
        {
          key: "STUDY_TIME",
          value: "evening",
          sourceQuote: "akşamları daha iyi çalışıyorum",
        },
        { now, transientTtlDays: 30, taxonomySubjects: [] },
      ),
    ).toEqual({
      key: CoachMemoryFactKey.STUDY_TIME,
      value: "EVENING",
      expiresAt: null,
    });
  });

  it("rejects paraphrased quotes, PII and sensitive confessions", () => {
    expect(
      validateMemoryCandidate(
        "Akşam daha verimliyim",
        {
          key: "STUDY_TIME",
          value: "EVENING",
          sourceQuote: "Geceleri daha iyi çalışıyorum",
        },
        { now, transientTtlDays: 30, taxonomySubjects: [] },
      ),
    ).toBeNull();
    expect(
      validateMemoryCandidate(
        "E-postam test@example.com",
        {
          key: "RESPONSE_PREFERENCE",
          value: "SHORT",
          sourceQuote: "test@example.com",
        },
        { now, transientTtlDays: 30, taxonomySubjects: [] },
      ),
    ).toBeNull();
    expect(
      validateMemoryCandidate(
        "Kendime zarar vermeyi düşünüyorum",
        {
          key: "CHALLENGE_CATEGORY",
          value: "ANXIETY",
          sourceQuote: "Kendime zarar vermeyi düşünüyorum",
        },
        { now, transientTtlDays: 30, taxonomySubjects: [] },
      ),
    ).toBeNull();
  });

  it("requires a taxonomy-verified priority subject and gives transient facts a TTL", () => {
    expect(
      validateMemoryCandidate(
        "Önceliğim matematik",
        {
          key: "PRIORITY_SUBJECT",
          value: "matematik",
          sourceQuote: "Önceliğim matematik",
        },
        {
          now,
          transientTtlDays: 30,
          taxonomySubjects: [{ slug: "matematik", name: "Matematik" }],
        },
      ),
    ).toEqual({
      key: CoachMemoryFactKey.PRIORITY_SUBJECT,
      value: "Matematik",
      expiresAt: "2026-08-31T12:00:00.000Z",
    });
    expect(
      validateMemoryCandidate(
        "Önceliğim astroloji",
        {
          key: "PRIORITY_SUBJECT",
          value: "astroloji",
          sourceQuote: "Önceliğim astroloji",
        },
        { now, transientTtlDays: 30, taxonomySubjects: [] },
      ),
    ).toBeNull();
  });
});
