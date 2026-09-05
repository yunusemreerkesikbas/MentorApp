import { HttpStatus, Injectable } from "@nestjs/common";
import type { MentorshipProgramTemplateDto } from "@mentor/types";
import { MENTORSHIP_TEMPLATE_MAX, type SaveMentorshipTemplateInput } from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import {
  MentorshipTemplateRepository,
  type MentorshipTemplateRow,
} from "../infrastructure/mentorship-template.repository";
import { MentorshipLinkService } from "./mentorship-link.service";

const toDto = (row: MentorshipTemplateRow): MentorshipProgramTemplateDto => ({
  id: row.id,
  name: row.name,
  examType: row.examType,
  tasks: row.tasks.map((task) => ({
    dayIndex: task.dayIndex,
    title: task.title,
    subject: task.subject,
    topic: task.topic,
    coachNote: task.coachNote,
  })),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * Saved weekly programs (W8).
 *
 * Deliberately has no `apply` method. A template is a saved DRAFT: the client loads one into the
 * composer and the coach still submits through `MentorshipAssignmentService`. That is not laziness
 * about plumbing — `topic` is never validated against the student's exam taxonomy on the server
 * (`refinePlanTaskTaxonomy` only checks that a topic has a subject), so the composer's own
 * subject/topic picker is the only real gate. A server-side apply would quietly write a KPSS topic
 * onto a YKS student, and every guard the assignment path already owns (21 ceiling, 120-day
 * horizon, throttle, all-or-nothing transaction) would need a second implementation.
 *
 * There is nothing student-scoped here, so `requireActiveLink` does not apply: a template belongs
 * to the coach and mentions no student. Ownership is enforced in the repository, which filters
 * every read and the delete by `coach_id`.
 */
@Injectable()
export class MentorshipTemplateService {
  constructor(
    private readonly repo: MentorshipTemplateRepository,
    private readonly links: MentorshipLinkService,
  ) {}

  async list(coachId: string): Promise<MentorshipProgramTemplateDto[]> {
    await this.links.assertEnabled();
    return (await this.repo.listByCoach(coachId)).map(toDto);
  }

  async save(
    coachId: string,
    input: SaveMentorshipTemplateInput,
  ): Promise<MentorshipProgramTemplateDto> {
    await this.links.assertEnabled();
    const outcome = await this.repo.upsert(
      coachId,
      input.name,
      input.examType ?? null,
      input.tasks.map((task) => ({
        dayIndex: task.dayIndex,
        title: task.title,
        subject: task.subject ?? null,
        topic: task.topic ?? null,
        coachNote: task.coachNote ?? null,
      })),
      MENTORSHIP_TEMPLATE_MAX,
    );
    if (outcome === "QUOTA_FULL") {
      throw new DomainError(ErrorCode.MENTORSHIP_TEMPLATE_QUOTA_EXCEEDED, HttpStatus.CONFLICT);
    }
    return toDto(outcome);
  }

  /** 404 rather than 403 on someone else's template, for the same reason the link gate does. */
  async remove(coachId: string, templateId: string): Promise<void> {
    await this.links.assertEnabled();
    if (!(await this.repo.deleteOwned(coachId, templateId))) {
      throw new DomainError(ErrorCode.MENTORSHIP_TEMPLATE_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
  }
}
