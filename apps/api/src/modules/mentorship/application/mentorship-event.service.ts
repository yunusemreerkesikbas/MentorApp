import { HttpStatus, Injectable } from "@nestjs/common";
import type { PlanEventDto } from "@mentor/types";
import type {
  CancelPlanEventInput,
  CreatePlanEventInput,
  UpdatePlanEventInput,
} from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { PlanEventService } from "../../coaching/application/plan-event.service";
import { MentorshipLinkService } from "./mentorship-link.service";

@Injectable()
export class MentorshipEventService {
  constructor(
    private readonly links: MentorshipLinkService,
    private readonly events: PlanEventService,
  ) {}

  async create(
    coachId: string,
    input: CreatePlanEventInput,
  ): Promise<PlanEventDto> {
    await this.links.assertEnabled();
    await this.authorizeAttendees(coachId, input.attendeeIds);
    return this.events.create(coachId, input);
  }

  async update(
    coachId: string,
    eventId: string,
    input: UpdatePlanEventInput,
  ): Promise<PlanEventDto> {
    await this.links.assertEnabled();
    if (input.attendeeIds !== undefined) {
      await this.authorizeAttendees(coachId, input.attendeeIds);
    }
    return this.events.update(coachId, eventId, input);
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
}
