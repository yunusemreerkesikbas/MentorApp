import { HttpStatus, Injectable } from "@nestjs/common";
import type { CoachPlanEventDto } from "@mentor/types";
import type {
  CancelPlanEventInput,
  CreatePlanEventInput,
  UpdatePlanEventInput,
} from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { PlanEventService } from "../../coaching/application/plan-event.service";
import { UsersService } from "../../identity/application/users.service";
import { MentorshipLinkService } from "./mentorship-link.service";

const MENTORSHIP_EVENT_ATTENDEE_MAX = 100;

@Injectable()
export class MentorshipEventService {
  constructor(
    private readonly links: MentorshipLinkService,
    private readonly events: PlanEventService,
    private readonly users: UsersService,
  ) {}

  async create(
    coachId: string,
    input: CreatePlanEventInput,
  ): Promise<CoachPlanEventDto> {
    await this.links.assertEnabled();
    this.assertAttendeeInput(coachId, input.attendeeIds);
    const result = await this.links.withServiceTransaction(async (tx) => {
      await this.events.lockOrganizerInTransaction(tx, coachId);
      await this.links.requireActiveLinksInTransaction(
        tx,
        coachId,
        input.attendeeIds,
      );
      return this.events.createInTransaction(tx, coachId, input);
    });
    this.events.publishCreated(coachId, result);
    return this.hydrate(coachId, result.dto.id);
  }

  async update(
    coachId: string,
    eventId: string,
    input: UpdatePlanEventInput,
  ): Promise<CoachPlanEventDto> {
    await this.links.assertEnabled();
    if (input.attendeeIds !== undefined) {
      this.assertAttendeeInput(coachId, input.attendeeIds);
    }
    const result = await this.links.withServiceTransaction(async (tx) => {
      await this.events.lockOrganizerInTransaction(tx, coachId);
      const existingIds =
        await this.events.listEventAttendeeIdsInTransaction(
          tx,
          coachId,
          eventId,
          input.scope,
        );
      await this.links.requireActiveLinksInTransaction(
        tx,
        coachId,
        input.attendeeIds ?? existingIds,
      );
      return this.events.updateInTransaction(tx, coachId, eventId, input);
    });
    this.events.publishUpdated(coachId, result);
    return this.hydrate(coachId, result.dto.id);
  }

  async cancel(
    coachId: string,
    eventId: string,
    input: CancelPlanEventInput,
  ): Promise<void> {
    await this.links.assertEnabled();
    const rows = await this.links.withServiceTransaction(async (tx) => {
      await this.events.lockOrganizerInTransaction(tx, coachId);
      const attendeeIds =
        await this.events.listEventAttendeeIdsInTransaction(
          tx,
          coachId,
          eventId,
          input.scope,
        );
      await this.links.requireActiveLinksInTransaction(
        tx,
        coachId,
        attendeeIds,
      );
      return this.events.cancelInTransaction(tx, coachId, eventId, input);
    });
    this.events.publishCancelled(coachId, rows);
  }

  private assertAttendeeInput(
    coachId: string,
    attendeeIds: string[],
  ): void {
    if (attendeeIds.length > MENTORSHIP_EVENT_ATTENDEE_MAX) {
      throw new DomainError(
        ErrorCode.MENTORSHIP_EVENT_ATTENDEE_LIMIT,
        HttpStatus.BAD_REQUEST,
        { max: MENTORSHIP_EVENT_ATTENDEE_MAX },
      );
    }
    if (attendeeIds.includes(coachId)) {
      throw new DomainError(
        ErrorCode.MENTORSHIP_EVENT_ORGANIZER_ATTENDEE,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async hydrate(
    coachId: string,
    eventId: string,
  ): Promise<CoachPlanEventDto> {
    const scopes = await this.links.listActiveScopes(coachId);
    const data = await this.events.getCoachEventData(
      coachId,
      eventId,
      scopes.map((scope) => scope.studentId),
    );
    const people = await this.users.listDisplayIdentities(data.attendeeIds);
    return {
      ...data.event,
      attendees: data.attendeeIds.map((studentId) => {
        const person = people.get(studentId);
        return {
          studentId,
          studentDisplayName: person?.displayName ?? "",
          studentUsername: person?.username ?? null,
          avatarUrl: person?.avatarUrl ?? null,
        };
      }),
    };
  }
}
