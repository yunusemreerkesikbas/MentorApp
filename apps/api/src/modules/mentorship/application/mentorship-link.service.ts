import { HttpStatus, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  MENTORSHIP_DATA_SCOPE,
  type MentorshipInvitationPreviewDto,
  type MentorshipLinkStatus,
  type MentorshipStudentDto,
  type MyCoachDto,
  type Paginated,
} from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { isUniqueViolation } from "../../../common/errors/postgres-error";
import { UsersService } from "../../identity/application/users.service";
import {
  MentorshipEventTopic,
  MentorshipLinkAccepted,
  MentorshipLinkEnded,
} from "../domain/mentorship.constants";
import {
  MentorshipLinkRepository,
  type MentorshipLinkRow,
} from "../infrastructure/mentorship-link.repository";
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
  constructor(
    private readonly links: MentorshipLinkRepository,
    private readonly invites: MentorshipInviteService,
    private readonly users: UsersService,
    private readonly config: ConfigRegistryService,
    private readonly events: EventEmitter2,
  ) {}

  /** Runtime kill-switch (config registry). Every W8 entry point calls this first. */
  async assertEnabled(): Promise<void> {
    const enabled = await this.config.get("mentorship.enabled");
    if (!enabled) throw new DomainError(ErrorCode.MENTORSHIP_DISABLED, HttpStatus.FORBIDDEN);
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

  /**
   * What the student is asked to consent to, before accepting. The data scope is part of the
   * contract (KVKK informed consent), not decorative copy - it mirrors MENTORSHIP_DATA_SCOPE.
   */
  async previewInvitation(code: string): Promise<MentorshipInvitationPreviewDto> {
    await this.assertEnabled();
    const coachId = await this.invites.resolveCoachId(code);
    const coach = await this.findPerson(coachId);
    if (!coach) throw new DomainError(ErrorCode.MENTORSHIP_INVITE_INVALID, HttpStatus.NOT_FOUND);
    return {
      coachDisplayName: coach.displayName,
      coachUsername: coach.username,
      dataScope: [...MENTORSHIP_DATA_SCOPE],
    };
  }

  /**
   * Student redeems a code, producing an ACTIVE link. This is the student's half of the double
   * opt-in; the coach already consented by issuing the code, so there is no coach-approval step.
   */
  async acceptInvitation(studentId: string, code: string): Promise<MyCoachDto> {
    await this.assertEnabled();
    const coachId = await this.invites.resolveCoachId(code);
    if (coachId === studentId) {
      throw new DomainError(ErrorCode.MENTORSHIP_SELF_LINK, HttpStatus.BAD_REQUEST);
    }
    if (await this.links.findActiveByStudent(studentId)) {
      throw new DomainError(ErrorCode.MENTORSHIP_ALREADY_LINKED, HttpStatus.CONFLICT);
    }
    const maxActiveStudents = await this.config.get("mentorship.coach.max_active_students");

    let outcome: Awaited<ReturnType<MentorshipLinkRepository["acceptInvite"]>>;
    try {
      // Quota + insert in one transaction — see the repository comment on why it cannot be split.
      outcome = await this.links.acceptInvite(coachId, studentId, maxActiveStudents);
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
    if (outcome === "ALREADY_ACTIVE") {
      throw new DomainError(ErrorCode.MENTORSHIP_ALREADY_LINKED, HttpStatus.CONFLICT);
    }
    const link = outcome;

    const people = await this.users.listDisplayIdentities([coachId, studentId]);
    this.events.emit(
      MentorshipEventTopic.LINK_ACCEPTED,
      new MentorshipLinkAccepted(
        link.id,
        coachId,
        studentId,
        people.get(studentId)?.displayName ?? "",
        people.get(coachId)?.displayName ?? "",
      ),
    );
    return this.toMyCoachDto(link, people.get(coachId));
  }

  /** The coach's roster. Identity only in this slice; metrics arrive with the roster read model. */
  async listStudents(
    coachId: string,
    status: MentorshipLinkStatus,
    page: number,
    pageSize: number,
  ): Promise<Paginated<MentorshipStudentDto>> {
    await this.assertEnabled();
    const { rows, total } = await this.links.listByCoach(coachId, status, page, pageSize);
    const people = await this.users.listDisplayIdentities(rows.map((row) => row.studentId));
    return {
      items: rows.map((row) => {
        const person = people.get(row.studentId);
        return {
          linkId: row.id,
          studentId: row.studentId,
          studentDisplayName: person?.displayName ?? "",
          studentUsername: person?.username ?? null,
          status: row.status as MentorshipLinkStatus,
          acceptedAt: row.acceptedAt?.toISOString() ?? null,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  /** The student's transparency view: who their coach is and exactly what that coach can see. */
  async getMyCoach(studentId: string): Promise<MyCoachDto | null> {
    await this.assertEnabled();
    const link = await this.links.findActiveByStudent(studentId);
    if (!link) return null;
    return this.toMyCoachDto(link, await this.findPerson(link.coachId));
  }

  /** Coach ends the link. */
  async endByCoach(coachId: string, studentId: string): Promise<void> {
    await this.assertEnabled();
    const link = await this.requireActiveLink(coachId, studentId);
    await this.endLink(link, coachId);
  }

  /** Student ends the link. Unilateral by design: consent is revocable at any time (KVKK). */
  async endByStudent(studentId: string): Promise<void> {
    await this.assertEnabled();
    const link = await this.links.findActiveByStudent(studentId);
    if (!link) throw new DomainError(ErrorCode.MENTORSHIP_LINK_NOT_FOUND, HttpStatus.NOT_FOUND);
    await this.endLink(link, studentId);
  }

  private async endLink(link: MentorshipLinkRow, actorId: string): Promise<void> {
    const ended = await this.links.end(link.id, actorId);
    if (!ended) return; // already ENDED - idempotent
    const actor = await this.findPerson(actorId);
    this.events.emit(
      MentorshipEventTopic.LINK_ENDED,
      new MentorshipLinkEnded(
        link.id,
        link.coachId,
        link.studentId,
        actorId,
        actor?.displayName ?? "",
      ),
    );
  }

  private async findPerson(userId: string): Promise<DisplayPerson | undefined> {
    return (await this.users.listDisplayIdentities([userId])).get(userId);
  }

  private toMyCoachDto(link: MentorshipLinkRow, coach: DisplayPerson | undefined): MyCoachDto {
    return {
      linkId: link.id,
      coachDisplayName: coach?.displayName ?? "",
      coachUsername: coach?.username ?? null,
      status: link.status as MentorshipLinkStatus,
      acceptedAt: link.acceptedAt?.toISOString() ?? null,
      dataScope: [...MENTORSHIP_DATA_SCOPE],
    };
  }
}
