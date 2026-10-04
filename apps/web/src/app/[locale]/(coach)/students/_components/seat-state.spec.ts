import { describe, expect, it } from "vitest";
import type { MentorshipCoachOverviewDto } from "@mentor/types";
import { seatCardState } from "./seat-state";

function overview(over: Partial<MentorshipCoachOverviewDto> = {}): MentorshipCoachOverviewDto {
  return {
    inviteCode: { code: "MENTOR-KOC-ABCDEF123456", expiresAt: "2026-10-08T00:00:00.000Z" },
    activeStudents: 1,
    maxActiveStudents: 20,
    freeSeats: 3,
    paidSeats: 0,
    usedSeats: 1,
    waitingStudents: 0,
    sponsorshipEnabled: true,
    seatAllowance: 3,
    seatPlansOnSale: false,
    dataScope: [],
    ...over,
  };
}

describe("seatCardState", () => {
  it("waits for the overview", () => {
    expect(seatCardState(null, null)).toEqual({ kind: "loading" });
  });

  it("offers the code while seats remain", () => {
    expect(seatCardState(overview({ activeStudents: 2, usedSeats: 2 }), null)).toEqual({
      kind: "open",
      used: 2,
      total: 3,
      freeSeats: 3,
      paidSeats: 0,
      sponsored: true,
      waiting: 0,
    });
  });

  it("keeps the seats open while sponsorship is off, and says no seat opens Premium", () => {
    // A seat is the room to follow a student; sponsorship is only what it adds.
    expect(
      seatCardState(overview({ activeStudents: 2, usedSeats: 2, sponsorshipEnabled: false }), null),
    ).toMatchObject({ kind: "open", used: 2, total: 3, sponsored: false });
  });

  /** One payer per student: a student paying for their own Premium holds no seat. */
  it("does not count a student who pays for their own Premium", () => {
    expect(seatCardState(overview({ activeStudents: 3, usedSeats: 2 }), null)).toMatchObject({
      kind: "open",
      used: 2,
    });
  });

  it("is full exactly where the accept lock refuses: at the seats held", () => {
    // Four students, one of them paying for themselves: three seats held of three.
    expect(seatCardState(overview({ activeStudents: 4, usedSeats: 3 }), null)).toEqual({
      kind: "full",
      used: 3,
      total: 3,
      reason: "seats",
      plansOnSale: false,
      sponsored: true,
      waiting: 0,
      limit: 20,
    });
  });

  it("carries how many students wait for a seat", () => {
    expect(
      seatCardState(overview({ activeStudents: 5, usedSeats: 3, waitingStudents: 2 }), null),
    ).toMatchObject({ kind: "full", waiting: 2 });
  });

  it("points at a plan only when one is on sale", () => {
    const state = seatCardState(
      overview({ activeStudents: 3, usedSeats: 3, seatPlansOnSale: true }),
      null,
    );
    expect(state).toMatchObject({ kind: "full", plansOnSale: true });
  });

  it("names the follow cap when that is what stops the next student", () => {
    const state = seatCardState(
      overview({ activeStudents: 20, usedSeats: 20, paidSeats: 25, seatAllowance: 20 }),
      null,
    );
    expect(state).toMatchObject({ kind: "full", reason: "cap", total: 20, limit: 20 });
  });

  it("is full at the follow cap even while seats are left", () => {
    // Students paying for themselves filled the roster: the accept refuses on the cap, not seats.
    const state = seatCardState(
      overview({ activeStudents: 20, usedSeats: 5, paidSeats: 10, seatAllowance: 13 }),
      null,
    );
    expect(state).toMatchObject({ kind: "full", reason: "cap", used: 5, limit: 20 });
  });

  it("says seats have not opened when the coach has none at all", () => {
    // `free_seats` set to 0 and no seat plan: the only way the server reports no allowance.
    expect(seatCardState(overview({ seatAllowance: 0, freeSeats: 0, usedSeats: 0 }), null)).toEqual({
      kind: "closed",
    });
  });

  it("explains a code an admin withheld instead of offering one", () => {
    expect(seatCardState(overview({ inviteCode: null }), "STANDING")).toEqual({
      kind: "locked",
      lock: "STANDING",
    });
  });

  it("shows a code the server handed over, whatever the registry row says", () => {
    // The overview withholds the code from a coach who cannot invite, so a code that arrived is
    // the server saying yes. A coach granted the role by hand has no registry row at all.
    expect(seatCardState(overview(), "STANDING")).toMatchObject({ kind: "open" });
  });

  it("keeps an unverified email looking like a missing code", () => {
    // The coach can clear this one: "Kod oluştur" asks to send the verification (APP-089), so the
    // card offers the same button instead of a paragraph about email.
    expect(seatCardState(overview({ inviteCode: null }), "EMAIL")).toMatchObject({ kind: "open" });
  });
});
