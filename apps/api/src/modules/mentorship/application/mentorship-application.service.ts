import { HttpStatus, Injectable } from "@nestjs/common";
import {
  MentorshipClaim,
  type AdminCoachApplicationDto,
  type MentorshipApplicationDto,
  type MentorshipClaimId,
  type MentorshipCoachProfileDto,
} from "@mentor/types";
import type {
  SubmitCoachApplicationInput,
  UpdateCoachProfileInput,
} from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { canApply } from "../domain/coach-application";
import { findContactPattern } from "../domain/contact-pattern";
import {
  MentorshipApplicationRepository,
  type MentorshipApplicationRow,
} from "../infrastructure/mentorship-application.repository";

/** Queue page size. A vetting queue that needs paging is a good problem; it is not this one. */
const QUEUE_LIMIT = 200;

/**
 * Coach applications — the curation pipeline (roadmap §5: "açık kayıt değil, kürasyon").
 *
 * WHAT THIS SERVICE DOES NOT DO: grant the COACH role. `grantRole` lives in W6's
 * `AdminUsersService`, and admin already imports this module for the queue — importing back would
 * be a cycle. The admin controller therefore performs both writes, role FIRST (see its comment for
 * why that order and not the other).
 *
 * THE TWO WRITERS ARE SPLIT BY SIGNATURE, not by convention. {@link submit} takes only the
 * applicant's fields; there is no `verifiedClaims` or `status` parameter anywhere an applicant can
 * reach, so "an applicant approves themselves" is not a bug that can be introduced by forgetting a
 * check — the argument does not exist.
 *
 * The gate is `mentorship.applications.open`, deliberately NOT `mentorship.enabled`: applications
 * have to be collectable before the coach surface opens, and the day the surface does open, this
 * is the knob that closes the tap.
 */
@Injectable()
export class MentorshipApplicationService {
  constructor(
    private readonly applications: MentorshipApplicationRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  /**
   * Submit, or re-submit after a rejection.
   *
   * `isCoach` comes from the caller's own token rather than a role lookup: somebody who already
   * carries COACH by a manual grant (every coach today) has nothing to apply for, and telling them
   * so beats writing a PENDING row an admin then has to dismiss.
   */
  async submit(
    userId: string,
    isCoach: boolean,
    input: SubmitCoachApplicationInput,
    now = new Date(),
  ): Promise<MentorshipApplicationDto> {
    if (!(await this.config.get("mentorship.applications.open"))) {
      throw new DomainError(ErrorCode.MENTORSHIP_APPLICATIONS_CLOSED, HttpStatus.FORBIDDEN);
    }
    if (isCoach) {
      throw new DomainError(ErrorCode.MENTORSHIP_ALREADY_COACH, HttpStatus.CONFLICT);
    }

    const existing = await this.applications.findByUser(userId);
    const reapplyAfterDays = await this.config.get("mentorship.applications.reapply_after_days");
    const gate = canApply(
      existing ? { status: toStatus(existing.status), reviewedAt: existing.reviewedAt } : null,
      reapplyAfterDays,
      now,
    );
    if (!("allowed" in gate)) throw gateError(gate);
    assertNoContact(input.headline, input.bio);

    const row = await this.applications.submit(
      userId,
      {
        headline: input.headline,
        bio: input.bio,
        institution: input.institution ?? null,
        branch: input.branch ?? null,
        years: input.years ?? null,
        note: input.note ?? null,
      },
      now,
    );
    // The upsert's `setWhere` refused: someone submitted twice at once and the other call won.
    // The gate above already said yes, so this is a race, not a rule — and the answer is the same
    // answer the loser would have got a millisecond earlier.
    if (!row) throw new DomainError(ErrorCode.MENTORSHIP_APPLICATION_PENDING, HttpStatus.CONFLICT);
    return toDto(row);
  }

  /** The applicant's own view. Null rather than 404: "you have not applied" is not an error. */
  async findMine(userId: string): Promise<MentorshipApplicationDto | null> {
    const row = await this.applications.findByUser(userId);
    return row ? toDto(row) : null;
  }

  /** Queue read for the admin panel. Identity and role are joined by the caller — see below. */
  async listForReview(status: string): Promise<MentorshipApplicationRow[]> {
    return this.applications.listByStatus(status, QUEUE_LIMIT);
  }

  /**
   * Record the verdict.
   *
   * Returns null when the row was already decided, so a retried approval is a no-op rather than a
   * second verdict overwriting the first reviewer's claims. The caller reports that honestly
   * instead of pretending it changed something.
   */
  async review(
    applicationId: string,
    reviewerId: string,
    verdict: {
      decision: "APPROVE" | "REJECT";
      verifiedClaims: MentorshipClaimId[];
      reviewNote: string | null;
    },
    now = new Date(),
  ): Promise<MentorshipApplicationRow | null> {
    const row = await this.applications.review(
      applicationId,
      {
        status: verdict.decision === "APPROVE" ? "APPROVED" : "REJECTED",
        verifiedClaims: verdict.verifiedClaims,
        reviewNote: verdict.reviewNote,
        reviewedBy: reviewerId,
      },
      now,
    );
    return row ?? null;
  }

  /**
   * The coach rewriting their own two student-facing lines.
   *
   * The claims and the verdict are not here and never will be: those are what an admin checked,
   * and a coach who could edit the institution behind a verified badge would make the badge a lie.
   * `updateProfile` is scoped to APPROVED rows, so this is also the door that stays shut while an
   * application is still outstanding.
   */
  async updateProfile(
    coachId: string,
    input: UpdateCoachProfileInput,
    now = new Date(),
  ): Promise<MentorshipApplicationDto> {
    assertNoContact(input.headline, input.bio);
    const row = await this.applications.updateProfile(coachId, input, now);
    if (!row) {
      throw new DomainError(ErrorCode.MENTORSHIP_APPLICATION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return toDto(row);
  }

  /**
   * The coach's profile as a STUDENT sees it, or null when they hold COACH without one.
   *
   * Null is the honest answer for every coach granted the role by hand before this queue existed,
   * and the consent screen says so rather than rendering an empty card. Nothing here is derived
   * from an unverified claim.
   */
  async findPublicProfile(coachId: string): Promise<MentorshipCoachProfileDto | null> {
    const row = await this.applications.findByUser(coachId);
    if (!row || row.status !== "APPROVED") return null;
    return toPublicProfile(row);
  }

  /** The row an approval is about, for the caller that has to grant the role before writing it. */
  async findById(applicationId: string): Promise<MentorshipApplicationRow> {
    const row = await this.applications.findById(applicationId);
    if (!row) {
      throw new DomainError(ErrorCode.MENTORSHIP_APPLICATION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return row;
  }
}

function gateError(gate: { reason: string; days?: number }): DomainError {
  switch (gate.reason) {
    case "PENDING":
      return new DomainError(ErrorCode.MENTORSHIP_APPLICATION_PENDING, HttpStatus.CONFLICT);
    case "ALREADY_COACH":
      return new DomainError(ErrorCode.MENTORSHIP_ALREADY_COACH, HttpStatus.CONFLICT);
    default:
      // The remaining days travel in `details` so the screen can say "22 gün sonra" without
      // recomputing a date it would get wrong in a different timezone.
      return new DomainError(ErrorCode.MENTORSHIP_APPLICATION_TOO_SOON, HttpStatus.CONFLICT, {
        days: gate.days,
      });
  }
}

function toStatus(value: string) {
  return value as MentorshipApplicationDto["status"];
}

/** The applicant's own view. `verifiedClaims` is readable but never writable from this side. */
export function toDto(row: MentorshipApplicationRow): MentorshipApplicationDto {
  return {
    id: row.id,
    status: toStatus(row.status),
    headline: row.headline,
    bio: row.bio,
    institution: row.claimInstitution,
    branch: row.claimBranch,
    years: row.claimYears,
    note: row.claimNote,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
    verifiedClaims: row.verifiedClaims as MentorshipClaimId[],
  };
}

/** The queue row. Identity and `hasCoachRole` come from the admin side; W8 never reads `users`. */
export function toAdminDto(
  row: MentorshipApplicationRow,
  person: { displayName: string; email: string; hasCoachRole: boolean },
): AdminCoachApplicationDto {
  return { ...toDto(row), userId: row.userId, ...person };
}

/**
 * Refuse text that hands out a way to reach the coach off-platform (roadmap §9's leak).
 *
 * Only the two fields a STUDENT will read. `claimNote` is written FOR the admin — a phone number
 * there is the point of the field, and checking it would refuse the one place it belongs.
 */
function assertNoContact(...fields: string[]): void {
  for (const field of fields) {
    const match = findContactPattern(field);
    if (match) {
      throw new DomainError(ErrorCode.MENTORSHIP_CONTACT_NOT_ALLOWED, HttpStatus.BAD_REQUEST, {
        pattern: match.id,
      });
    }
  }
}

/**
 * What the student sees. Only claims an admin marked verified travel, and each carries the VALUE
 * that was checked — a claim nobody verified, rendered beside one that was, would read as endorsed.
 */
export function toPublicProfile(row: MentorshipApplicationRow): MentorshipCoachProfileDto {
  const values: Record<MentorshipClaimId, string | null> = {
    [MentorshipClaim.INSTITUTION]: row.claimInstitution,
    [MentorshipClaim.BRANCH]: row.claimBranch,
    [MentorshipClaim.YEARS]: row.claimYears === null ? null : String(row.claimYears),
  };
  return {
    headline: row.headline,
    bio: row.bio,
    verifiedClaims: (row.verifiedClaims as MentorshipClaimId[])
      .map((claim) => ({ claim, value: values[claim] }))
      // A verified claim whose value was later cleared has nothing to show; dropping it beats
      // rendering a badge with an empty label.
      .filter((entry): entry is { claim: MentorshipClaimId; value: string } => entry.value !== null),
  };
}
