import { describe, expect, it } from "vitest";
import {
  MIN_ENTRIES_FOR_PATTERN,
  selectErrorPattern,
} from "./notebook-error-pattern.policy";

describe("selectErrorPattern", () => {
  it("says nothing below the evidence floor — a screen that always has an opinion gets ignored", () => {
    expect(
      selectErrorPattern([{ errorType: "CARELESS", count: MIN_ENTRIES_FOR_PATTERN - 1 }]),
    ).toBeNull();
    expect(selectErrorPattern([])).toBeNull();
  });

  it("names the dominant cause once there is enough of it", () => {
    expect(
      selectErrorPattern([
        { errorType: "CARELESS", count: 6 },
        { errorType: "UNKNOWN_TOPIC", count: 2 },
      ]),
    ).toBe("RUSHING");
  });

  it("maps each error type to its own reading", () => {
    expect(selectErrorPattern([{ errorType: "UNKNOWN_TOPIC", count: 8 }])).toBe(
      "KNOWLEDGE_GAP",
    );
    expect(selectErrorPattern([{ errorType: "MISREAD", count: 8 }])).toBe("READING");
    expect(selectErrorPattern([{ errorType: "TIME", count: 8 }])).toBe("TIME_PRESSURE");
    expect(selectErrorPattern([{ errorType: "CHANGED_ANSWER", count: 8 }])).toBe(
      "SECOND_GUESSING",
    );
  });

  it("falls back to MIXED when no cause dominates, rather than crowning a near-tie", () => {
    expect(
      selectErrorPattern([
        { errorType: "CARELESS", count: 3 },
        { errorType: "UNKNOWN_TOPIC", count: 3 },
        { errorType: "MISREAD", count: 3 },
      ]),
    ).toBe("MIXED");
  });

  it("treats an unknown error type as MIXED instead of throwing", () => {
    expect(selectErrorPattern([{ errorType: "FUTURE_TYPE", count: 9 }])).toBe("MIXED");
  });
});
