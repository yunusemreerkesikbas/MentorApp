import { HttpStatus } from "@nestjs/common";
import {
  MentorshipClaim,
  type AdminCoachApplicationDto,
  type MentorshipApplicationDto,
  type MentorshipApplicationStatusId,
  type MentorshipClaimId,
  type MentorshipCoachProfileDto,
} from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { findContactPattern } from "../domain/contact-pattern";
import type { MentorshipApplicationRow } from "../infrastructure/mentorship-application.repository";

/**
 * Row-to-DTO mapping and the two refusals that are pure text rules, split out of
 * `MentorshipApplicationService` to keep it under the file-size rule (backend.md).
 *
 * Everything here is a pure function of a row: no repository, no config, no role writes.
 */

export function toStatus(value: string): MentorshipApplicationStatusId {
  return value as MentorshipApplicationStatusId;
}

export function gateError(gate: { reason: string }): DomainError {
  switch (gate.reason) {
    case "ALREADY_COACH":
      return new DomainError(ErrorCode.MENTORSHIP_ALREADY_COACH, HttpStatus.CONFLICT);
    case "PENDING":
      return new DomainError(ErrorCode.MENTORSHIP_APPLICATION_PENDING, HttpStatus.CONFLICT);
    default:
      return new DomainError(ErrorCode.MENTORSHIP_COACH_SUSPENDED, HttpStatus.FORBIDDEN);
  }
}

/** The coach's own view. `verifiedClaims` is readable but never writable from this side. */
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

/** One registry row for admin. Identity and `hasCoachRole` come from W6; W8 never reads `users`. */
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
export function assertNoContact(...fields: string[]): void {
  for (const field of fields) {
    const match = findContactPattern(field);
    if (match) {
      throw new DomainError(ErrorCode.MENTORSHIP_CONTACT_NOT_ALLOWED, HttpStatus.BAD_REQUEST, {
        pattern: match.id,
      });
    }
  }
}

/** Rendering order, fixed so a profile does not reshuffle between two reads of the same row. */
const CLAIM_ORDER: MentorshipClaimId[] = [
  MentorshipClaim.INSTITUTION,
  MentorshipClaim.BRANCH,
  MentorshipClaim.YEARS,
];

/**
 * What the student sees. EVERY claim travels, each carrying whether anyone checked it.
 *
 * This used to send only verified claims, because a coach could not reach a student without passing
 * a review first — an unverified claim next to a verified one would have read as endorsed by us.
 * Self-service registration inverts which default is dangerous: a screen that shows nothing looks
 * identical for a checked coach and an unchecked one, and the person deciding whether to hand over
 * private data cannot tell them apart. So the flag travels and the screen MUST render the two
 * differently. Rendering them the same way recreates the endorsement this once avoided.
 */
export function toPublicProfile(row: MentorshipApplicationRow): MentorshipCoachProfileDto {
  const values: Record<MentorshipClaimId, string | null> = {
    [MentorshipClaim.INSTITUTION]: row.claimInstitution,
    [MentorshipClaim.BRANCH]: row.claimBranch,
    [MentorshipClaim.YEARS]: row.claimYears === null ? null : String(row.claimYears),
  };
  const verified = new Set(row.verifiedClaims);
  return {
    headline: row.headline,
    bio: row.bio,
    claims: CLAIM_ORDER.flatMap((claim) => {
      const value = values[claim];
      // A claim the coach never made has nothing to show, verified or not.
      return value === null ? [] : [{ claim, value, verified: verified.has(claim) }];
    }),
  };
}
