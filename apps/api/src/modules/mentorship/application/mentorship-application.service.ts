import { HttpStatus, Injectable } from "@nestjs/common";
import {
  MentorshipApplicationStatus,
  UserRole,
  type MentorshipApplicationDto,
  type MentorshipApplicationStatusId,
  type MentorshipClaimId,
  type MentorshipCoachProfileDto,
  type MentorshipCoachRegistrationStateDto,
} from "@mentor/types";
import type { RegisterCoachInput, UpdateCoachProfileInput } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { UsersService } from "../../identity/application/users.service";
import { canRegister } from "../domain/coach-registration";
import {
  MentorshipApplicationRepository,
  type MentorshipApplicationRow,
} from "../infrastructure/mentorship-application.repository";
import {
  assertNoContact,
  gateError,
  toDto,
  toPublicProfile,
  toStatus,
} from "./coach-registry.mappers";

/** Registry page size. A coach registry that needs paging is a good problem; it is not this one. */
const QUEUE_LIMIT = 200;

/**
 * The coach registry — self-service registration, and the admin's reverse power over it.
 *
 * REVISED (APP-089). This used to be a curation pipeline: apply, wait, a SUPER_ADMIN approves, and
 * only then does COACH exist. Registration is self-service now, so the shape of the risk moved
 * rather than disappeared, and two things carry what approval used to:
 *
 *   1. {@link assertCanInvite} — the ONE gate. COACH by itself opens nothing: the roster is empty,
 *      every student-scoped read goes through `requireActiveLink` and 404s. The only road to a
 *      student's data is an invite code, so a verified email and an ACTIVE registry row are checked
 *      exactly there, and nowhere else has to remember.
 *   2. The admin can take it back ({@link setStatus}), which is why `canRegister` refuses every
 *      existing row: registration writes ACTIVE, so a suspended coach who could re-register would
 *      erase their own suspension.
 *
 * ROLE WRITES LIVE HERE NOW. They used to be impossible in W8 — `grantRole` sat in W6's
 * `AdminUsersService` and importing it back would be a cycle — so the admin controller performed
 * both writes itself. `users.roles` is identity's column, and W8 already depends on W0, so the pair
 * is one service's job again and the ordering rule below is stated once instead of per caller.
 *
 * ORDERING RULE for the two writes (status row in W8, role in W0, no shared transaction): whichever
 * order leaves the coach with FEWER powers after a crash wins. Granting goes row-then-role; removing
 * goes role-then-row. Both failure modes end with a person who cannot issue an invite code.
 */
@Injectable()
export class MentorshipApplicationService {
  constructor(
    private readonly applications: MentorshipApplicationRepository,
    private readonly config: ConfigRegistryService,
    private readonly users: UsersService,
  ) {}

  /**
   * Register as a coach: write the registry row, then grant COACH.
   *
   * The gate is `mentorship.applications.open`, deliberately NOT `mentorship.enabled`: coaches have
   * to be registerable before the coach surface opens, and the day it does open, this is the knob
   * that closes the intake.
   */
  async register(
    userId: string,
    input: RegisterCoachInput,
    now = new Date(),
  ): Promise<MentorshipApplicationDto> {
    if (!(await this.config.get("mentorship.applications.open"))) {
      throw new DomainError(ErrorCode.MENTORSHIP_APPLICATIONS_CLOSED, HttpStatus.FORBIDDEN);
    }

    const existing = await this.applications.findByUser(userId);
    const gate = canRegister(existing ? { status: toStatus(existing.status) } : null);
    if (!("allowed" in gate)) throw gateError(gate);
    assertNoContact(input.headline, input.bio);

    const row = await this.applications.register(
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
    // `DO NOTHING` refused: two registrations raced and the other one won. The gate above already
    // said yes, so this is a race, not a rule, and the answer is the one the loser would have got a
    // millisecond earlier.
    if (!row) throw new DomainError(ErrorCode.MENTORSHIP_ALREADY_COACH, HttpStatus.CONFLICT);

    // Row first: a crash here leaves an ACTIVE row with no role, which is powerless and repairable
    // from the admin registry. The reverse would leave a coach nobody has a record of.
    await this.users.addRole(userId, UserRole.COACH);
    return toDto(row);
  }

  /**
   * Everything the "am I a coach, and what works" screens need, in one call.
   *
   * `registrationOpen` travels because the intake being shut used to be discoverable only by POSTing
   * a completed form and reading the 403 back. Survivable when the entry point was a link buried in
   * the profile list; not survivable now that signup routes people here on purpose.
   */
  async getRegistrationState(userId: string): Promise<MentorshipCoachRegistrationStateDto> {
    const [open, row, emailVerified] = await Promise.all([
      this.config.get("mentorship.applications.open"),
      this.applications.findByUser(userId),
      this.users.isEmailVerified(userId),
    ]);
    return {
      registrationOpen: open,
      registration: row ? toDto(row) : null,
      emailVerified,
    };
  }

  /** The coach's own view. Null rather than 404: "you have not registered" is not an error. */
  async findMine(userId: string): Promise<MentorshipApplicationDto | null> {
    const row = await this.applications.findByUser(userId);
    return row ? toDto(row) : null;
  }

  /**
   * THE GATE. Everything a coach can do TO a student starts with an invite code, so this is the one
   * place that has to be right, and the only one that checks.
   *
   * Two conditions, and the reason each is here rather than somewhere more obvious:
   *   - a verified email, because self-registration made a reachable inbox the only cost of
   *     becoming a coach, and an unverified address costs nothing at all;
   *   - an ACTIVE registry row, because that is what an admin takes away, and because a coach with
   *     no row has no profile — the student's consent screen would be blank at the exact moment
   *     they decide to hand over private data.
   */
  async assertCanInvite(coachId: string): Promise<void> {
    const verdict = await this.evaluateInvite(coachId);
    if (verdict === "EMAIL_UNVERIFIED") {
      throw new DomainError(ErrorCode.MENTORSHIP_EMAIL_NOT_VERIFIED, HttpStatus.FORBIDDEN);
    }
    if (verdict === "NOT_ACTIVE") {
      throw new DomainError(ErrorCode.MENTORSHIP_COACH_NOT_ACTIVE, HttpStatus.FORBIDDEN);
    }
  }

  /**
   * The same question as {@link assertCanInvite}, asked by a read that must not throw.
   *
   * The coach overview withholds the code rather than failing: a panel that 403s on load would tell
   * a coach with an unverified email that coaching is broken, when the truth is one click away.
   */
  async canInvite(coachId: string): Promise<boolean> {
    return (await this.evaluateInvite(coachId)) === "OK";
  }

  private async evaluateInvite(
    coachId: string,
  ): Promise<"OK" | "EMAIL_UNVERIFIED" | "NOT_ACTIVE"> {
    const [row, emailVerified] = await Promise.all([
      this.applications.findByUser(coachId),
      this.users.isEmailVerified(coachId),
    ]);
    if (!emailVerified) return "EMAIL_UNVERIFIED";
    if (!row || row.status !== MentorshipApplicationStatus.ACTIVE) return "NOT_ACTIVE";
    return "OK";
  }

  /** The registry read for the admin panel. Identity and role are joined by the caller. */
  async listForReview(status: string): Promise<MentorshipApplicationRow[]> {
    return this.applications.listByStatus(status, QUEUE_LIMIT);
  }

  /**
   * An admin moving a coach's standing, role included. Undefined when there is no registry row.
   *
   * Removing goes role-first, granting goes row-first, per the ordering rule on the class. Note what
   * this does NOT do: nothing here ends a `coach_students` link or cancels a sponsored seat. A
   * suspended coach simply cannot open anything (the role is gone), the students keep the Premium
   * somebody already paid for, and reinstating puts it all back. Punishing a student mid-month for
   * something their coach did would be the wrong bill to send.
   */
  async setStatus(
    userId: string,
    verdict: { status: MentorshipApplicationStatusId; reviewNote: string | null },
    reviewerId: string,
    now = new Date(),
  ): Promise<MentorshipApplicationRow | null> {
    const active = verdict.status === MentorshipApplicationStatus.ACTIVE;
    if (!active) await this.users.removeRole(userId, UserRole.COACH);

    const row = await this.applications.setStatus(
      userId,
      { status: verdict.status, reviewNote: verdict.reviewNote, reviewedBy: reviewerId },
      now,
    );
    if (!row) return null;

    if (active) await this.users.addRole(userId, UserRole.COACH);
    return row;
  }

  /**
   * An admin marking which of a coach's claims they actually checked.
   *
   * Separate from {@link setStatus} because the two answer different questions: standing is "may
   * this person coach", a badge is "did WE check what they say about themselves". Fused into one
   * verdict, reinstating a suspended coach would silently re-assert badges nobody re-read.
   *
   * Note there is no "define a coach" write here. An admin designates one with the role endpoint
   * that already exists (`POST /v1/admin/users/:id/roles/COACH`); the registry row is then written
   * by the coach themselves, because `headline` and `bio` are the coach's own words and an admin
   * typing them would put our sentences on a student's consent screen under someone else's name.
   * Until that row exists, `assertCanInvite` keeps the invite code shut.
   */
  async setVerifiedClaims(
    userId: string,
    verifiedClaims: MentorshipClaimId[],
    reviewerId: string,
    now = new Date(),
  ): Promise<MentorshipApplicationRow | null> {
    return (await this.applications.setVerifiedClaims(userId, verifiedClaims, reviewerId, now)) ?? null;
  }

  /**
   * The coach rewriting their own two student-facing lines.
   *
   * The claims and the standing are not here and never will be: those are what an admin decided, and
   * a coach who could edit the institution behind a verified badge would make the badge a lie.
   * `updateProfile` is scoped to ACTIVE, so this is also the door that shuts on suspension.
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
   * Only an ACTIVE coach has a profile: a suspended one must not keep advertising to the student
   * they are already linked to.
   */
  async findPublicProfile(coachId: string): Promise<MentorshipCoachProfileDto | null> {
    const row = await this.applications.findByUser(coachId);
    if (!row || row.status !== MentorshipApplicationStatus.ACTIVE) return null;
    return toPublicProfile(row);
  }

  /** A coach's standing, for the student screen that has to explain a coach who went quiet. */
  async findStatus(coachId: string): Promise<MentorshipApplicationStatusId | null> {
    const row = await this.applications.findByUser(coachId);
    return row ? toStatus(row.status) : null;
  }
}
