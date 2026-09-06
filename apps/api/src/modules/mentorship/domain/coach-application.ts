import { MentorshipApplicationStatus, type MentorshipApplicationStatusId } from "@mentor/types";

/**
 * When a person may (re)apply to become a coach, and what the answer means.
 *
 * Curation is roadmap §5's word: not open registration, an application somebody reads. That makes
 * "no" a real outcome, and a "no" you can resubmit the same afternoon is not a decision — it is a
 * loop. The wait is the only thing that turns a rejection into one.
 *
 * Pure on purpose, like `risk-flags.ts` and `attention.ts`: the rule is the thing worth testing,
 * and it has to give the same answer to the endpoint that refuses and the screen that explains.
 */
export type ApplicationGate =
  | { allowed: true }
  | { reason: "PENDING" }
  | { reason: "ALREADY_COACH" }
  /** Rejected too recently. `days` is what is LEFT, so the screen can say it without recomputing. */
  | { reason: "TOO_SOON"; days: number };

export function canApply(
  existing: { status: MentorshipApplicationStatusId; reviewedAt: Date | null } | null,
  reapplyAfterDays: number,
  now: Date,
): ApplicationGate {
  if (existing === null) return { allowed: true };

  switch (existing.status) {
    case MentorshipApplicationStatus.PENDING:
      return { reason: "PENDING" };

    // An approved application IS the coach's profile (there is no second table). Reapplying would
    // overwrite a vetted record with unvetted claims, which is the one thing curation must not
    // allow. Editing the profile is a different door (APP-083) and it never touches the verdict.
    case MentorshipApplicationStatus.APPROVED:
      return { reason: "ALREADY_COACH" };

    case MentorshipApplicationStatus.REJECTED: {
      // A rejected row with no review date is not a state this code writes; treating it as open
      // beats trapping someone forever on a row we cannot explain.
      if (existing.reviewedAt === null) return { allowed: true };
      const elapsed = Math.floor(
        (now.getTime() - existing.reviewedAt.getTime()) / 86_400_000,
      );
      const left = reapplyAfterDays - elapsed;
      return left <= 0 ? { allowed: true } : { reason: "TOO_SOON", days: left };
    }
  }
}
