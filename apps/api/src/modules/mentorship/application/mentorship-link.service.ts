import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  MENTORSHIP_DATA_SCOPE,
  MentorshipApplicationStatus,
  MentorshipSeat,
  type MentorshipApplicationStatusId,
  type MentorshipCoachOverviewDto,
  type MentorshipInvitationPreviewDto,
  type MentorshipCoachProfileDto,
  type MentorshipLinkStatus,
  type MentorshipSeatId,
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
import { PlanService } from "../../coaching/application/plan.service";
import { toCoachNoteDto, toStudentNoteDto } from "../domain/coach-note";
import {
  MentorshipEventTopic,
  MentorshipLinkAccepted,
  MentorshipLinkEnded,
  MentorshipNoteUpdated,
  MentorshipStudentNoteUpdated,
} from "../domain/mentorship.constants";
import { assignSeats, seatForNewcomer, type SeatedLink } from "../domain/seats";
import {
  MentorshipLinkRepository,
  type MentorshipLinkRow,
} from "../infrastructure/mentorship-link.repository";
import { MentorshipApplicationService } from "./mentorship-application.service";
import { MentorshipInviteService } from "./mentorship-invite.service";

type DisplayPerson = { displayName: string; username: string | null };

/** The link as the seat decision reads it; `selfPaying` is payments' answer, fetched per call. */
function toSeated(link: MentorshipLinkRow, selfPaying: boolean): SeatedLink {
  return {
    id: link.id,
    acceptedAt: link.acceptedAt ?? link.createdAt,
    seat: link.seat as MentorshipSeatId,
    selfPaying,
  };
}

/** FREE or PAID: the coach's room to follow this student, and the seat a sponsorship rides on. */
function holdsSeat(seat: string): boolean {
  return seat === MentorshipSeat.FREE || seat === MentorshipSeat.PAID;
}

/**
 * A link waiting for a seat is frozen: it stands, but the coach opens nothing through it until a
 * seat returns. 409 rather than 404, because the coach knows this student (the roster shows them)
 * and is owed the reason; the id confirms nothing they could not already see.
 */
function assertSeated(link: MentorshipLinkRow): void {
  if (link.seat === MentorshipSeat.NONE) {
    throw new DomainError(ErrorCode.MENTORSHIP_SEAT_WAITING, HttpStatus.CONFLICT);
  }
}

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
    private readonly planTasks: PlanService,
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
    assertSeated(link);
    return link;
  }

  withServiceTransaction<T>(
    callback: (tx: DatabaseTx) => Promise<T>,
  ): Promise<T> {
    return withServiceContext(this.db, callback);
  }

  /**
   * Same authorization gate while holding the relationship row through the caller's commit.
   * `allowWaiting` is for the student's own side of a frozen link (and for ending one): the freeze
   * stops the coach, not the student.
   */
  async requireActiveLinkInTransaction(
    tx: DatabaseTx,
    coachId: string,
    studentId: string,
    options: { allowWaiting?: boolean } = {},
  ): Promise<MentorshipLinkRow> {
    const [link] = await this.links.lockActiveInTransaction(tx, coachId, [studentId]);
    if (!link) throw new DomainError(ErrorCode.MENTORSHIP_LINK_NOT_FOUND, HttpStatus.NOT_FOUND);
    if (!options.allowWaiting) assertSeated(link);
    return link;
  }

  async requireActiveLinksInTransaction(
    tx: DatabaseTx,
    coachId: string,
    requestedStudentIds: string[],
    options: { allowWaiting?: boolean } = {},
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
    if (!options.allowWaiting) locked.forEach(assertSeated);
    return studentIds.map((studentId) => ({
      studentId,
      mentorshipLinkId: byStudent.get(studentId)!.id,
    }));
  }

  /** The coach's plan and events reach the students they can see: frozen links are left out. */
  async listActiveScopes(
    coachId: string,
  ): Promise<Array<{ studentId: string; mentorshipLinkId: string }>> {
    const links = await this.links.listActiveByCoach(coachId);
    return links
      .filter((link) => link.seat !== MentorshipSeat.NONE)
      .map((link) => ({
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
   *
   * Opening the home is also the reseat of last resort: a payments event that never arrived, or a
   * raised `free_seats`, is settled here before anything is counted.
   */
  async getCoachOverview(coachId: string): Promise<MentorshipCoachOverviewDto> {
    const { freeSeats, paidSeats } = await this.reseatCoach(coachId);
    const [inviteCode, activeLinks, maxActiveStudents, sponsorshipEnabled, canInvite, plans] =
      await Promise.all([
        this.invites.getCurrent(coachId),
        this.links.listActiveByCoach(coachId),
        this.config.get("mentorship.coach.max_active_students"),
        this.config.get("mentorship.seats.sponsorship_enabled"),
        this.applications.canInvite(coachId),
        // The catalog `/subscription` renders, so the card can only point at a plan that is there.
        this.subscriptions.listPlans(),
      ]);
    const allowance = freeSeats + paidSeats;
    const seated = activeLinks.filter((link) => holdsSeat(link.seat));
    // Links seated while sponsorship was off, or whose grant was swallowed, hold a seat with no
    // subscription row behind it. The panel is what shows the count, so the missing Premium is
    // written here. `grant` leaves a student who already pays for themselves alone.
    if (sponsorshipEnabled) await this.fillMissingSponsorships(seated);
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
      usedSeats: seated.length,
      waitingStudents: activeLinks.filter((link) => link.seat === MentorshipSeat.NONE).length,
      sponsorshipEnabled,
      seatAllowance: Math.min(allowance, maxActiveStudents),
      seatPlansOnSale: plans.some((plan) => plan.seatCount > 0),
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
    const [maxActiveStudents, quota, selfPaying] = await Promise.all([
      this.config.get("mentorship.coach.max_active_students"),
      this.seatQuota(coachId),
      // One payer per student: a student who already pays for their Premium takes no seat.
      this.subscriptions.listSelfPayingUserIds([studentId]),
    ]);

    let outcome:
      | { link: MentorshipLinkRow; seat: MentorshipSeatId }
      | "QUOTA_FULL"
      | "SEATS_FULL"
      | "ALREADY_ACTIVE";
    try {
      // Cap, seat and insert under the coach's lock, in one transaction: see
      // `lockCoachInTransaction` on why checking first and inserting second cannot be split.
      outcome = await this.withServiceTransaction(async (tx) => {
        await this.links.lockCoachInTransaction(tx, coachId);
        const active = await this.links.listActiveByCoachInTransaction(tx, coachId);
        if (active.length >= maxActiveStudents) return "QUOTA_FULL" as const;
        const now = new Date();
        // Everyone already linked keeps their seat as stored (the reseat keeps those current);
        // only the newcomer is decided, after them, so nobody waiting is overtaken.
        const seat = seatForNewcomer(
          active.map((link) => toSeated(link, link.seat === MentorshipSeat.SELF)),
          { acceptedAt: now, selfPaying: selfPaying.has(studentId) },
          quota,
        );
        // Accepting never creates a frozen link: no seat means no link.
        if (seat === MentorshipSeat.NONE) return "SEATS_FULL" as const;
        const link = await this.links.insertOrReviveInTransaction(tx, coachId, studentId, seat, now);
        return link ? { link, seat } : ("ALREADY_ACTIVE" as const);
      });
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
    const { link, seat } = outcome;

    const people = await this.users.listDisplayIdentities([coachId, studentId]);
    this.events.emit(
      MentorshipEventTopic.LINK_ACCEPTED,
      new MentorshipLinkAccepted(
        link.id,
        coachId,
        studentId,
        people.get(studentId)?.displayName ?? "",
        people.get(coachId)?.displayName ?? "",
        // The seat rides the event: W4's listener opens Premium for FREE and PAID only.
        seat,
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
   * Write the sponsor row for links that hold a seat but never received one (seated while
   * sponsorship was off, or a grant that was swallowed). `grant` is idempotent, checks the flag and
   * skips a student who already has an open subscription.
   */
  private async fillMissingSponsorships(seated: readonly MentorshipLinkRow[]): Promise<void> {
    for (const link of seated) await this.grantSeat(link);
  }

  private grantSeat(link: Pick<MentorshipLinkRow, "id" | "studentId">): Promise<unknown> {
    return this.seats.grant(link.studentId, link.id).catch((err: unknown) => {
      this.logger.error(`Sponsored seat grant failed for link ${link.id}`, err);
    });
  }

  /** The free quota and what the coach's own plan adds (0 while no seat plan can be bought). */
  private async seatQuota(coachId: string): Promise<{ freeSeats: number; paidSeats: number }> {
    const [freeSeats, paidSeats] = await Promise.all([
      this.config.get("mentorship.coach.free_seats"),
      this.subscriptions.paidSeatsFor(coachId),
    ]);
    return { freeSeats, paidSeats };
  }

  /**
   * Re-decide every seat on this coach's links (`domain/seats.ts`) and make the Premium follow:
   * a link that froze loses the sponsorship its seat carried, one that got a seat back gets it
   * again (the grant checks the sponsorship flag).
   *
   * Called when something the seats depend on moved: the coach's or a student's subscription
   * (payments events, via {@link reseatForUser}), a link ending, and the coach opening their home,
   * which settles whatever an event missed. Returns the quota it decided with, for the overview.
   */
  async reseatCoach(coachId: string): Promise<{ freeSeats: number; paidSeats: number }> {
    const quota = await this.seatQuota(coachId);
    const changed = await this.withServiceTransaction(async (tx) => {
      await this.links.lockCoachInTransaction(tx, coachId);
      const active = await this.links.listActiveByCoachInTransaction(tx, coachId);
      if (active.length === 0) return [];
      const selfPaying = await this.subscriptions.listSelfPayingUserIds(
        active.map((link) => link.studentId),
      );
      const next = assignSeats(
        active.map((link) => toSeated(link, selfPaying.has(link.studentId))),
        quota,
      );
      const changes = active
        .filter((link) => next.get(link.id) !== link.seat)
        .map((link) => ({ link, seat: next.get(link.id)! }));
      await this.links.setSeatsInTransaction(
        tx,
        changes.map(({ link, seat }) => ({ id: link.id, seat })),
      );
      return changes;
    });

    // After the commit, so a rolled-back reseat moves no Premium.
    for (const { link, seat } of changed) {
      if (seat === MentorshipSeat.NONE) {
        await this.seats.revoke(link.id).catch((err: unknown) => {
          this.logger.error(`Sponsored seat revoke failed for link ${link.id}`, err);
        });
      } else if (holdsSeat(seat)) {
        await this.grantSeat(link);
      }
    }
    if (changed.length > 0) {
      this.logger.log(`Reseated ${changed.length} link(s) for coach ${coachId}`);
    }
    return quota;
  }

  /**
   * A subscription of this user changed: reseat every coach whose seats that can move. The user
   * is a coach whose plan changed, or a student who started or stopped paying for themselves.
   */
  async reseatForUser(userId: string): Promise<void> {
    for (const coachId of await this.links.listCoachIdsTouching(userId)) {
      await this.reseatCoach(coachId);
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

  /**
   * The student's standing note to their coach (QA F4), the mirror of {@link setCoachNote}: one row
   * overwritten in place, no thread and no reply. A link waiting for a seat keeps it for when the
   * coach can open the student again and tells them nothing now, since nothing reaches a frozen
   * coach. The coach reads it on the student's report; it never goes to an AI provider.
   */
  async setStudentNote(studentId: string, body: string | null): Promise<void> {
    await this.assertEnabled();
    const link = await this.requireStudentLink(studentId);
    await this.links.setStudentNote(link.id, body);
    if (body === null || link.seat === MentorshipSeat.NONE) return;
    const student = await this.findPerson(studentId);
    this.events.emit(
      MentorshipEventTopic.STUDENT_NOTE_UPDATED,
      new MentorshipStudentNoteUpdated(link.id, link.coachId, studentId, student?.displayName ?? ""),
    );
  }

  /**
   * The student's side of their live link, for what the student reads through it (a finalized
   * week). A frozen link counts: the freeze stops the coach, not the student. 404 without one.
   */
  async requireStudentLink(studentId: string): Promise<MentorshipLinkRow> {
    const link = await this.links.findActiveByStudent(studentId);
    if (!link) throw new DomainError(ErrorCode.MENTORSHIP_LINK_NOT_FOUND, HttpStatus.NOT_FOUND);
    return link;
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
      // A frozen link can still be ended, by either side: the freeze stops the coach reading, not
      // anyone leaving.
      const [scope] = await this.requireActiveLinksInTransaction(
        tx,
        coachId,
        [studentId],
        { allowWaiting: true },
      );
      await this.planEvents.removeFutureAttendeeInTransaction(
        tx,
        coachId,
        studentId,
      );
      // What the coach set and the student has not done yet is the student's own from here on.
      await this.planTasks.releaseMentorshipTasksInTransaction(tx, {
        studentId,
        mentorshipLinkId: scope!.mentorshipLinkId,
      });
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
    // The seat it held is free now: the longest-waiting student gets it. Best-effort, because the
    // end itself committed; the coach's next home visit reseats again anyway.
    await this.reseatCoach(ended.coachId).catch((err: unknown) => {
      this.logger.error(`Reseat after link end failed for coach ${ended.coachId}`, err);
    });
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
      studentNote: toStudentNoteDto(link),
      // The same profile the consent screen showed. A student who agreed to something should be
      // able to re-read it without digging out the invite they used months ago.
      coachProfile,
      coachStatus,
      // The coach's seats are full: the link stands, but nothing reaches the coach until one opens.
      seatWaiting: link.seat === MentorshipSeat.NONE,
    };
  }
}
