import { describe, expect, it } from "vitest";
import { nextInRound, parseRoundOrder } from "./round-order";

const ORDER = [
  { studentId: "zeynep", name: "Zeynep" },
  { studentId: "ali", name: "Ali" },
  { studentId: "ece", name: "Ece" },
];

describe("nextInRound", () => {
  it("points at the student after this one", () => {
    expect(nextInRound(ORDER, "zeynep")).toEqual({ kind: "next", studentId: "ali", name: "Ali" });
  });

  it("ends the round on the last waiting student", () => {
    expect(nextInRound(ORDER, "ece")).toEqual({ kind: "complete" });
  });

  it("says nothing on a report opened by a direct link", () => {
    expect(nextInRound(ORDER, "burak")).toBeNull();
    expect(nextInRound(null, "zeynep")).toBeNull();
  });
});

describe("parseRoundOrder", () => {
  it("reads back what the roster wrote", () => {
    expect(parseRoundOrder(JSON.stringify(ORDER))).toEqual(ORDER);
  });

  it("ignores anything that is not a round", () => {
    expect(parseRoundOrder(null)).toBeNull();
    expect(parseRoundOrder("not json")).toBeNull();
    expect(parseRoundOrder(JSON.stringify([{ studentId: 3 }]))).toBeNull();
  });
});
