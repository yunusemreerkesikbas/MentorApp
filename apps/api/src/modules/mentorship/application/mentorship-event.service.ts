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
    await this.authorizeAttendees(coachId, input.attendeeIds);
    const event = await this.events.create(coachId, input);
    return this.hydrate(coachId, event.id);
  }

  async update(
    coachId: string,
    eventId: string,
    input: UpdatePlanEventInput,
  ): Promise<CoachPlanEventDto> {
    await this.links.assertEnabled();
    if (input.attendeeIds !== undefined) {
      await this.authorizeAttendees(coachId, input.attendeeIds);
    }
    await this.events.update(coachId, eventId, input);
    return this.hydrate(coachId, eventId);
  }

  async cancel(
    coachId: string,
    eventId: string,
    input: CancelPlanEventInput,
  ): Promise<void> {
    await this.links.assertEnabled();
    return this.events.cancel(coachId, eventId, input);
  }

  private async authorizeAttendees(
    coachId: string,
    attendeeIds: string[],
  ): Promise<void> {
    if (attendeeIds.includes(coachId)) {
      throw new DomainError(
        ErrorCode.MENTORSHIP_EVENT_ORGANIZER_ATTENDEE,
        HttpStatus.BAD_REQUEST,
      );
    }
    await Promise.all(
      attendeeIds.map((studentId) =>
        this.links.requireActiveLink(coachId, studentId),
      ),
    );
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
