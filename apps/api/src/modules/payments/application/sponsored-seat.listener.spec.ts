import { describe, expect, it, vi } from "vitest";
import { MentorshipLinkAccepted } from "../../mentorship/domain/mentorship.constants";
import { SponsoredSeatListener } from "./sponsored-seat.listener";

const accepted = (seatKind: string) =>
  new MentorshipLinkAccepted("link-1", "coach-1", "student-1", "Elif", "Ayşe", seatKind as never);

describe("SponsoredSeatListener", () => {
  it.each(["FREE", "PAID"])("opens Premium for a student on a %s seat", async (seat) => {
    const seats = { grant: vi.fn(async () => true) };
    await new SponsoredSeatListener(seats as never).onLinkAccepted(accepted(seat));
    expect(seats.grant).toHaveBeenCalledWith("student-1", "link-1", "coach-1");
  });

  /** SELF pays for themselves (one payer per student); NONE holds no seat to carry Premium. */
  it.each(["SELF", "NONE"])("writes nothing for a %s link", async (seat) => {
    const seats = { grant: vi.fn(async () => true) };
    await new SponsoredSeatListener(seats as never).onLinkAccepted(accepted(seat));
    expect(seats.grant).not.toHaveBeenCalled();
  });
});
