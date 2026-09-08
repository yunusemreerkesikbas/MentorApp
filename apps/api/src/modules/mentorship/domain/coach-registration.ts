import { MentorshipApplicationStatus, type MentorshipApplicationStatusId } from "@mentor/types";

/**
 * Whether a person may register as a coach right now, and what a "no" means.
 *
 * REVISED (APP-089). This used to be `canApply`, and it was mostly a cooldown: curation meant an
 * admin said no, and a "no" you could resubmit the same afternoon was not a decision but a loop.
 * Registration is self-service now, so there is no verdict to wait out and the cooldown is gone
 * along with `mentorship.applications.reapply_after_days`.
 *
 * What is left is one rule, and it is the important one: A ROW THAT AN ADMIN TOUCHED IS NOT
 * REWRITABLE BY THE PERSON IT IS ABOUT. Registration writes an ACTIVE row, so a suspended coach who
 * could re-register would erase their own suspension, and a coach an admin is mid-review on would
 * undo the review. Everything an admin can do here is only worth doing if it survives the next
 * request from the person it was done to.
 *
 * Pure on purpose, like `risk-flags.ts` and `attention.ts`: the rule is the thing worth testing,
 * and it has to give the same answer to the endpoint that refuses and the screen that explains.
 */
export type RegistrationGate =
  | { allowed: true }
  /** Already an active coach. Editing the profile is a different door and never touches status. */
  | { reason: "ALREADY_COACH" }
  /** An admin pulled them back for a look. Reversible, but not by them. */
  | { reason: "PENDING" }
  /** An admin removed them. Only an admin reinstates; there is no self-service road back. */
  | { reason: "SUSPENDED" };

export function canRegister(
  existing: { status: MentorshipApplicationStatusId } | null,
): RegistrationGate {
  if (existing === null) return { allowed: true };

  switch (existing.status) {
    case MentorshipApplicationStatus.ACTIVE:
      return { reason: "ALREADY_COACH" };
    case MentorshipApplicationStatus.PENDING:
      return { reason: "PENDING" };
    case MentorshipApplicationStatus.SUSPENDED:
      return { reason: "SUSPENDED" };
  }
}
