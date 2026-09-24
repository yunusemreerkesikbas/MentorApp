import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  MENTORSHIP_DATA_SCOPE,
  MentorshipApplicationStatus,
  type MentorshipApplicationStatusId,
  type MentorshipCoachOverviewDto,
  type MentorshipInvitationPreviewDto,
  type MentorshipCoachProfileDto,
  type MentorshipLinkStatus,
  type MyCoachDto,
} from "@mentor/types";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { isUniqueViolation } from "../../../common/errors/postgres-error";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { UsersService } from "../../identity/application/users.service";
import { SponsoredSeatService } from "../../payments/application/sponsored-seat.service";
import { SubscriptionsService } from "../../payments/application/subscriptions.service";
import { PlanEventService } from "../../coaching/application/plan-event.service";
import { toCoachNoteDto } from "../domain/coach-note";
import {
  MentorshipEventTopic,
  MentorshipLinkAccepted,
  MentorshipLinkEnded,
  MentorshipSeatKind,
  MentorshipNoteUpdated,
} from "../domain/mentorship.constants";
import {
  MentorshipLinkRepository,
  type MentorshipLinkRow,
} from "../infrastructure/mentorship-link.repository";
import { MentorshipApplicationService } from "./mentorship-application.service";
import { MentorshipInviteService } from "./mentorship-invite.service";

type DisplayPerson = { displayName: string; username: string | null };

/**
 * Coach-student link lifecycle and, more importantly, the ONE authorization gate every
 * coach-to-student read and write passes through ({@link requireActiveLink}).
 *
 * Why a service and not a guard: `RolesGuard` lets ADMIN/SUPER_ADMIN satisfy any `@Roles()`
 * (roles.guard.ts), so a guard-shaped check would hand every admin every student's data. This gate
 * grants no such exemption - an admin without an active link is refused like anyone else.
 *
 * Missing link is 404, never 403: a 403 would confirm that the student id exists.
 */
@Injectable()
export class MentorshipLinkService {
  private readonly logger = new Logger(MentorshipLinkService.name);

  constructor(
    private readonly links: MentorshipLinkRepository,
    private readonly invites: MentorshipInviteService,
    private readonly applications: MentorshipApplicationService,
    private readonly users: UsersService,
    private readonly config: ConfigRegistryService,
    private readonly subscriptions: SubscriptionsService,
    private readonly seats: SponsoredSeatService,
    private readonly events: EventEmitter2,
    private readonly planEvents: PlanEventService,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  /** Runtime kill-switch (config registry). Every W8 entry point calls this first. */
  async assertEnabled(): Promise<void> {
    const enabled = await this.config.get(FeatureFlag.MENTORSHIP_ENABLED);
    if (!enabled) throw new DomainError(ErrorCode.MENTORSHIP_DISABLED, HttpStatus.FORBIDDEN);
  }

  /**
   * Resolve a code to the coach behind it, and refuse it unless that coach may still invite.
   *
   * The redemption half of the APP-089 gate, and it is NOT redundant with the issuing half. Codes
   * outlive their issuing: a coach who was suspended, or who was reinstated and then unverified
   * their email, keeps whatever code is in the table, and students hold copies of it. Checking only
   * at issue time would leave every already-handed-out code live for its full TTL.
   *
   * The refusal is INVALID rather than a suspension-specific code on purpose: whoever holds this
   * string is a stranger to us, and "that coach was suspended" is an administrative fact about
   * somebody else. An unusable code is the whole truth the holder is owed.
   */
  private async resolveInvitingCoach(code: string): Promise<string> {
    const coachId = await this.invites.resolveCoachId(code);
    if (!(await this.applications.canInvite(coachId))) {
      throw new DomainError(ErrorCode.MENTORSHIP_INVITE_INVALID, HttpStatus.NOT_FOUND);
    }
    return coachId;
  }

  /**
   * The gate. Returns the live link or throws - no admin bypass, no "the COACH role is enough".
   * Callers reading student data MUST await this before touching anything student-scoped.
   */
  async requireActiveLink(coachId: string, studentId: string): Promise<MentorshipLinkRow> {
    const link = await this.links.findActive(coachId, studentId);
    if (!link) {
      throw new DomainError(ErrorCode.MENTORSHIP_LINK_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return link;
  }

  withServiceTransaction<T>(
    callback: (tx: DatabaseTx) => Promise<T>,
  ): Promise<T> {
    return withServiceContext(this.db, callback);
  }

  /** Same authorization gate while holding the relationship row through the caller's commit. */
  async requireActiveLinkInTransaction(tx: DatabaseTx, coachId: string, studentId: string): Promise<MentorshipLinkRow> {
    const [link] = await this.links.lockActiveInTransaction(tx, coachId, [studentId]);
    if (!link) throw new DomainError(ErrorCode.MENTORSHIP_LINK_NOT_FOUND, HttpStatus.NOT_FOUND);
    return link;
  }

  async requireActiveLinksInTransaction(
    tx: DatabaseTx,
    coachId: string,
    requestedStudentIds: string[],
  ): Promise<Array<{ studentId: string; mentorshipLinkId: string }>> {
    const studentIds = [...new Set(requestedStudentIds)].sort();
    const locked = await this.links.lockActiveInTransaction(
      tx,
      coachId,
      studentIds,
    );
    const byStudent = new Map(locked.map((link) => [link.studentId, link]));
    if (
      locked.length !== studentIds.length ||
      studentIds.some((studentId) => !byStudent.has(studentId))
    ) {
      throw new DomainError(
        ErrorCode.MENTORSHIP_LINK_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
    return studentIds.map((studentId) => ({
      studentId,
      mentorshipLinkId: byStudent.get(studentId)!.id,
    }));
  }

  async listActiveScopes(
    coachId: string,
  ): Promise<Array<{ studentId: string; mentorshipLinkId: string }>> {
    const links = await this.links.listActiveByCoach(coachId);
    return links.map((link) => ({
      studentId: link.studentId,
      mentorshipLinkId: link.id,
    }));
  }

  /**
   * The coach's landing state: invite code, seats taken out of the cap, and the same data-scope
   * contract the student consented to, mirrored back.
   *
   * The seat numbers exist because the quota is checked on the STUDENT's redemption
   * ({@link acceptInvitation}), so without them the cap is invisible to the only person who can
   * act on it: the coach hands out a code, the student eats the 409, and the coach never learns.
   */
  async getCoachOverview(coachId: string): Promise<MentorshipCoachOverviewDto> {
    const [inviteCode, activeLinks, maxActiveStudents, freeSeats, sponsorshipEnabled, paidSeats, canInvite] =
      await Promise.all([
        this.invites.getCurrent(coachId),
        this.links.listActiveByCoach(coachId),
        this.config.get("mentorship.coach.max_active_students"),
        this.config.get("mentorship.coach.free_seats"),
        this.config.get("mentorship.seats.sponsorship_enabled"),
        this.subscriptions.paidSeatsFor(coachId),
        this.applications.canInvite(coachId),
      ]);
    const allowance = freeSeats + paidSeats;
    // Links accepted while sponsorship was off, or whose grant was swallowed, sit inside the
    // allowance with no subscription row. The panel is what shows the count, so the missing seat
    // is written here. `grant` leaves a student who already pays for themselves alone.
    if (sponsorshipEnabled && allowance > 0) {
      await this.fillMissingSeats(activeLinks, allowance);
    }
    const linkIds = activeLinks.map((link) => link.id);
    const usedSeats = await this.subscriptions.countSponsoredForLinks(linkIds);
    return {
      // Withheld, not absent (APP-089). A coach who has not verified their email, or whom an admin
      // pulled back, keeps whatever code they were issued in the database — reinstating them must
      // not silently invalidate a code students may already hold — but the panel stops handing it
      // out. `GET /mentorship/coach-registration/mine` carries the reason, so the screen can say
      // which of the two it is instead of rendering an unexplained blank.
      inviteCode: canInvite ? inviteCode : null,
      activeStudents: activeLinks.length,
      maxActiveStudents,
      freeSeats,
      paidSeats,
      usedSeats,
      sponsorshipEnabled,
      dataScope: [...MENTORSHIP_DATA_SCOPE],
    };
  }

  /**
   * What the student is asked to consent to, before accepting. The data scope is part of the
   * contract (KVKK informed consent), not decorative copy - it mirrors MENTORSHIP_DATA_SCOPE.
   */
  async previewInvitation(code: string): Promise<MentorshipInvitationPreviewDto> {
    await this.assertEnabled();
    const coachId = await this.resolveInvitingCoach(code);
    const [coach, coachProfile] = await Promise.all([
      this.findPerson(coachId),
      this.applications.findPublicProfile(coachId),
    ]);
    if (!coach) throw new DomainError(ErrorCode.MENTORSHIP_INVITE_INVALID, HttpStatus.NOT_FOUND);
    return {
      coachDisplayName: coach.displayName,
      coachUsername: coach.username,
      dataScope: [...MENTORSHIP_DATA_SCOPE],
      // The screen where a student decides to hand over private data used to show a name and
      // nothing else. `null` here is honest and common: every coach granted the role by hand.
      coachProfile,
    };
  }

  /**
   * Student redeems a code, producing an ACTIVE link. This is the student's half of the double
   * opt-in; the coach already consented by issuing the code, so there is no coach-approval step.
   */
  async acceptInvitation(studentId: string, code: string): Promise<MyCoachDto> {
    await this.assertEnabled();
    const coachId = await this.resolveInvitingCoach(code);
    if (coachId === studentId) {
      throw new DomainError(ErrorCode.MENTORSHIP_SELF_LINK, HttpStatus.BAD_REQUEST);
    }
    if (await this.links.findActiveByStudent(studentId)) {
      throw new DomainError(ErrorCode.MENTORSHIP_ALREADY_LINKED, HttpStatus.CONFLICT);
    }
    const [maxActiveStudents, freeSeats, sponsorshipEnabled, paidSeats] = await Promise.all([
      this.config.get("mentorship.coach.max_active_students"),
      this.config.get("mentorship.coach.free_seats"),
      this.config.get("mentorship.seats.sponsorship_enabled"),
      // What the coach's own plan adds on top of the free quota. 0 for everyone today: seat plans
      // stay unpurchasable until a coach channel opens (`mentorship.seats.billing_enabled` with a
      // verified provider, or `mentorship.seats.mobile_billing_enabled` once the app sells them).
      this.subscriptions.paidSeatsFor(coachId),
    ]);

    // Sponsorship off grants nothing, so the allowance is zero and the lock refuses the insert.
    // A coach pays for every student they follow: the free quota first, then seats on their plan.
    const seatAllowance = sponsorshipEnabled ? freeSeats + paidSeats : 0;

    let outcome: Awaited<ReturnType<MentorshipLinkRepository["acceptInvite"]>>;
    try {
      // Quota + insert in one transaction — see the repository comment on why it cannot be split.
      outcome = await this.links.acceptInvite(
        coachId,
        studentId,
        maxActiveStudents,
        seatAllowance,
      );
    } catch (err) {
      // A concurrent accept won the partial unique index (one ACTIVE coach per student).
      if (isUniqueViolation(err)) {
        throw new DomainError(ErrorCode.MENTORSHIP_ALREADY_LINKED, HttpStatus.CONFLICT);
      }
      throw err;
    }
    if (outcome === "QUOTA_FULL") {
      throw new DomainError(ErrorCode.MENTORSHIP_STUDENT_QUOTA_EXCEEDED, HttpStatus.CONFLICT);
    }
    if (outcome === "SEATS_FULL") {
      throw new DomainError(ErrorCode.MENTORSHIP_SEATS_FULL, HttpStatus.CONFLICT);
    }
    if (outcome === "ALREADY_ACTIVE") {
      throw new DomainError(ErrorCode.MENTORSHIP_ALREADY_LINKED, HttpStatus.CONFLICT);
    }
    const { link, activeBefore } = outcome;

    // The lock already refused a student who does not fit. What remains is which kind of seat
    // pays for them. A student who already holds their own subscription still links; `grant`
    // writes nothing on top of that row.
    const seatKind: MentorshipSeatKind =
      activeBefore < freeSeats ? MentorshipSeatKind.FREE : MentorshipSeatKind.PAID;

    const people = await this.users.listDisplayIdentities([coachId, studentId]);
    this.events.emit(
      MentorshipEventTopic.LINK_ACCEPTED,
      new MentorshipLinkAccepted(
        link.id,
        coachId,
        studentId,
        people.get(studentId)?.displayName ?? "",
        people.get(coachId)?.displayName ?? "",
        seatKind,
      ),
    );
    // ACTIVE without a lookup: `resolveInvitingCoach` above refused the code otherwise, so a link
    // that exists at this line was made by a coach who could invite a moment ago.
    return this.toMyCoachDto(
      link,
      people.get(coachId),
      await this.applications.findPublicProfile(coachId),
      MentorshipApplicationStatus.ACTIVE,
    );
  }

  /**
   * Write the sponsor row for links that already fit in the allowance but never received one.
   *
   * Oldest first, so a coach who linked three students while the flag was off still sponsors
   * those three, not whichever page of the roster happened to load. `grant` is idempotent and
   * skips a student who already has an open subscription.
   */
  private async fillMissingSeats(
    links: readonly MentorshipLinkRow[],
    allowance: number,
  ): Promise<void> {
    const ordered = [...links].sort(
      (left, right) =>
        (left.acceptedAt?.getTime() ?? 0) - (right.acceptedAt?.getTime() ?? 0),
    );
    for (const link of ordered.slice(0, allowance)) {
      await this.seats.grant(link.studentId, link.id).catch((err: unknown) => {
        this.logger.error(`Sponsored seat grant failed for link ${link.id}`, err);
      });
    }
  }

  /**
   * The coach's standing note to a student. A note, not a channel: one row overwritten in place,
   * no thread and no reply. Phase-2 communication is off-platform and in-app chat is Phase 3
   * (roadmap §9); this exists so a coach can say "focus on paragraphs this week" without needing
   * one, and it does not put the student's words anywhere the coach can read them.
   */
  async setCoachNote(coachId: string, studentId: string, body: string | null): Promise<void> {
    await this.assertEnabled();
    const link = await this.requireActiveLink(coachId, studentId);
    await this.links.setCoachNote(link.id, body);
    // Clearing is not news. A student told "your coach removed something" learns nothing and is
    // left wondering; the absence of the card on /kocum is the whole message.
    if (body === null) return;
    const coach = (await this.users.listDisplayIdentities([coachId])).get(coachId);
    this.events.emit(
      MentorshipEventTopic.NOTE_UPDATED,
      new MentorshipNoteUpdated(link.id, coachId, studentId, coach?.displayName ?? ""),
    );
  }

  /** The student's transparency view: who their coach is and exactly what that coach can see. */
  async getMyCoach(studentId: string): Promise<MyCoachDto | null> {
    await this.assertEnabled();
    const link = await this.links.findActiveByStudent(studentId);
    if (!link) return null;
    const [person, profile, coachStatus] = await Promise.all([
      this.findPerson(link.coachId),
      this.applications.findPublicProfile(link.coachId),
      // Only this screen asks. A coach an admin stopped keeps the link but can open nothing, and a
      // coach who has simply gone quiet looks identical from here — so the student is told which.
      this.applications.findStatus(link.coachId),
    ]);
    return this.toMyCoachDto(link, person, profile, coachStatus);
  }

  /** Coach ends the link. */
  async endByCoach(coachId: string, studentId: string): Promise<void> {
    await this.assertEnabled();
    await this.endLink(coachId, studentId, coachId);
  }

  /** Student ends the link. Unilateral by design: consent is revocable at any time (KVKK). */
  async endByStudent(studentId: string): Promise<void> {
    await this.assertEnabled();
    const link = await this.links.findActiveByStudent(studentId);
    if (!link) throw new DomainError(ErrorCode.MENTORSHIP_LINK_NOT_FOUND, HttpStatus.NOT_FOUND);
    await this.endLink(link.coachId, studentId, studentId);
  }

  private async endLink(
    coachId: string,
    studentId: string,
    actorId: string,
  ): Promise<void> {
    const ended = await this.withServiceTransaction(async (tx) => {
      const [scope] = await this.requireActiveLinksInTransaction(
        tx,
        coachId,
        [studentId],
      );
      await this.planEvents.removeFutureAttendeeInTransaction(
        tx,
        coachId,
        studentId,
      );
      return this.links.endInTransaction(
        tx,
        scope!.mentorshipLinkId,
        actorId,
      );
    });
    if (!ended) return; // already ENDED - idempotent
    const actor = await this.findPerson(actorId);
    this.events.emit(
      MentorshipEventTopic.LINK_ENDED,
      new MentorshipLinkEnded(
        ended.id,
        ended.coachId,
        ended.studentId,
        actorId,
        actor?.displayName ?? "",
      ),
    );
  }

  private async findPerson(userId: string): Promise<DisplayPerson | undefined> {
    return (await this.users.listDisplayIdentities([userId])).get(userId);
  }

  private toMyCoachDto(
    link: MentorshipLinkRow,
    coach: DisplayPerson | undefined,
    coachProfile: MentorshipCoachProfileDto | null,
    coachStatus: MentorshipApplicationStatusId | null = null,
  ): MyCoachDto {
    return {
      linkId: link.id,
      coachDisplayName: coach?.displayName ?? "",
      coachUsername: coach?.username ?? null,
      status: link.status as MentorshipLinkStatus,
      acceptedAt: link.acceptedAt?.toISOString() ?? null,
      dataScope: [...MENTORSHIP_DATA_SCOPE],
      coachNote: toCoachNoteDto(link),
      // The same profile the consent screen showed. A student who agreed to something should be
      // able to re-read it without digging out the invite they used months ago.
      coachProfile,
      coachStatus,
    };
  }
}
