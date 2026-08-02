import { CoachActionStatus } from "@mentor/types";
import { nextCoachActionStatus } from "./coach-action";

describe("coach action state machine", () => {
  it("allows explicit accept/cancel from proposed and completion from accepted", () => {
    expect(nextCoachActionStatus(CoachActionStatus.PROPOSED, "ACCEPT")).toBe(
      CoachActionStatus.ACCEPTED,
    );
    expect(nextCoachActionStatus(CoachActionStatus.PROPOSED, "CANCEL")).toBe(
      CoachActionStatus.CANCELLED,
    );
    expect(nextCoachActionStatus(CoachActionStatus.ACCEPTED, "COMPLETE")).toBe(
      CoachActionStatus.COMPLETED,
    );
  });

  it("rejects regenerate and invalid transitions after an action has been accepted", () => {
    expect(
      nextCoachActionStatus(CoachActionStatus.ACCEPTED, "CANCEL"),
    ).toBeNull();
    expect(
      nextCoachActionStatus(CoachActionStatus.COMPLETED, "ACCEPT"),
    ).toBeNull();
    expect(
      nextCoachActionStatus(CoachActionStatus.CANCELLED, "COMPLETE"),
    ).toBeNull();
  });
});
