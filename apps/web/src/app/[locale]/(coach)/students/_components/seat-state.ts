import type { MentorshipCoachOverviewDto } from "@mentor/types";
import type { InviteLock } from "./invite-lock";

/**
 * What the invite and seat card says, decided from the server's numbers only (`seatAllowance` is
 * the figure the accept lock refuses at), so "full" here is full on the server too.
 */
export type SeatCardState =
  | { kind: "loading" }
  /** Sponsorship is off: no seat grants anything yet. */
  | { kind: "closed" }
  /**
   * An admin withheld the code: nothing here would work, so the card explains. An unverified email
   * is not a lock here: the card looks like a missing code, and "Kod oluştur" asks to send the
   * verification (APP-089), so the explanation arrives with the one press that fixes it.
   */
  | { kind: "locked"; lock: "STANDING" }
  | {
      kind: "full";
      used: number;
      total: number;
      /** `cap`: the follow limit stops the next student, not the seats. */
      reason: "seats" | "cap";
      /** A coach seat plan is in the `/subscription` catalog right now. */
      plansOnSale: boolean;
    }
  | { kind: "open"; used: number; total: number; freeSeats: number; paidSeats: number };

export function seatCardState(
  overview: MentorshipCoachOverviewDto | null,
  lock: InviteLock,
): SeatCardState {
  if (overview === null) return { kind: "loading" };
  if (overview.seatAllowance === 0) return { kind: "closed" };
  const used = overview.activeStudents;
  const total = overview.seatAllowance;
  if (used >= total) {
    return {
      kind: "full",
      used,
      total,
      reason:
        overview.freeSeats + overview.paidSeats >= overview.maxActiveStudents ? "cap" : "seats",
      plansOnSale: overview.seatPlansOnSale,
    };
  }
  // A code that arrived is the server saying this coach may invite; the lock only explains a
  // missing one.
  if (lock === "STANDING" && overview.inviteCode === null) return { kind: "locked", lock };
  return {
    kind: "open",
    used,
    total,
    freeSeats: overview.freeSeats,
    paidSeats: overview.paidSeats,
  };
}
