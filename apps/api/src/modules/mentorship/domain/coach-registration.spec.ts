import { describe, expect, it } from "vitest";
import { MentorshipApplicationStatus } from "@mentor/types";
import { canRegister } from "./coach-registration";

const gate = (status: keyof typeof MentorshipApplicationStatus) =>
  canRegister({ status: MentorshipApplicationStatus[status] });

describe("canRegister", () => {
  it("lets a first-time registrant through", () => {
    expect(canRegister(null)).toEqual({ allowed: true });
  });

  it("refuses someone who is already an active coach", () => {
    expect(gate("ACTIVE")).toEqual({ reason: "ALREADY_COACH" });
  });

  /*
   * The three cases below are the whole point of the gate, so they are spelled out rather than
   * folded into one loop: registration writes an ACTIVE row, so anything it lets through overwrites
   * whatever an admin decided. A regression here is not a wrong error message, it is a suspended
   * coach clearing their own suspension by filling in the registration form again.
   */
  it("refuses while an admin is mid-review", () => {
    expect(gate("PENDING")).toEqual({ reason: "PENDING" });
  });

  it("refuses a suspended coach, with no cooldown that would eventually let them back in", () => {
    expect(gate("SUSPENDED")).toEqual({ reason: "SUSPENDED" });
  });

  it("never returns allowed for a row that exists", () => {
    for (const status of ["ACTIVE", "PENDING", "SUSPENDED"] as const) {
      expect(gate(status)).not.toHaveProperty("allowed");
    }
  });
});
