import { createHash } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { CreateMentorshipFollowupInput, ListMentorshipFollowupsQuery, PaginationQuery, RespondMentorshipFollowupInput, UpdateMentorshipFollowupInput } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { UsersService } from "../../identity/application/users.service";
import { followupToday, toCoachFollowup, toSharedFollowup } from "../domain/mentorship-followup";
import { MentorshipFollowupRepository, type FollowupRow } from "../infrastructure/mentorship-followup.repository";
import { MentorshipLinkRepository } from "../infrastructure/mentorship-link.repository";
import { MentorshipLinkService } from "./mentorship-link.service";

function conflict(): never { throw new DomainError(ErrorCode.MENTORSHIP_FOLLOWUP_CONFLICT, HttpStatus.CONFLICT); }
function requireRow(row: FollowupRow | undefined): FollowupRow {
  if (!row) throw new DomainError(ErrorCode.MENTORSHIP_FOLLOWUP_NOT_FOUND, HttpStatus.NOT_FOUND);
  return row;
}

@Injectable()
export class MentorshipFollowupService {
  constructor(
    private readonly repo: MentorshipFollowupRepository,
    private readonly links: MentorshipLinkService,
    private readonly linkRepo: MentorshipLinkRepository,
    private readonly config: ConfigRegistryService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  async getAvailability(): Promise<{ enabled: boolean }> {
    const [mentorship, followups] = await Promise.all([this.config.get("mentorship.enabled"), this.config.get("mentorship.followups.enabled")]);
    return { enabled: mentorship && followups };
  }

  private async assertEnabled(): Promise<void> {
    if (!(await this.getAvailability()).enabled) throw new DomainError(ErrorCode.MENTORSHIP_FOLLOWUP_DISABLED, HttpStatus.FORBIDDEN);
  }

  private validateDate(date: string | null | undefined): void {
    if (date && date < followupToday(new Date())) throw new DomainError(ErrorCode.MENTORSHIP_FOLLOWUP_DATE_INVALID, HttpStatus.BAD_REQUEST);
  }

  private async coachDto(row: FollowupRow, studentId: string) {
    const identities = await this.users.listDisplayIdentities([studentId]);
    const identity = identities.get(studentId);
    if (!identity) throw new DomainError(ErrorCode.MENTORSHIP_LINK_NOT_FOUND, HttpStatus.NOT_FOUND);
    return toCoachFollowup(row, studentId, identity.displayName);
  }

  async create(coachId: string, studentId: string, input: CreateMentorshipFollowupInput) {
    await this.assertEnabled();
    const requestHash = createHash("sha256").update(JSON.stringify([input.title, input.privateNote, input.sharedDecision, input.followUpDate, input.replacesId])).digest("hex");
    const result = await this.links.withServiceTransaction(async (tx) => {
      const link = await this.links.requireActiveLinkInTransaction(tx, coachId, studentId);
      const existing = await this.repo.findOperation(tx, link, input.operationId);
      if (existing) {
        if (existing.requestHash !== requestHash) conflict();
        return { row: existing, created: false };
      }
      this.validateDate(input.followUpDate);
      if (input.replacesId) {
        const previous = requireRow(await this.repo.find(tx, link, input.replacesId));
        if (previous.status === "OPEN") conflict();
      }
      const row = await this.repo.create(tx, { ...input, requestHash, linkId: link.id, periodId: link.periodId });
      return { row, created: true };
    });
    if (result.created && result.row.sharedDecision !== null) this.events.emit("mentorship.followup.shared", { followupId: result.row.id, version: result.row.version });
    return this.coachDto(result.row, studentId);
  }

  async update(coachId: string, studentId: string, id: string, input: UpdateMentorshipFollowupInput) {
    await this.assertEnabled();
    const row = await this.links.withServiceTransaction(async (tx) => {
      const link = await this.links.requireActiveLinkInTransaction(tx, coachId, studentId);
      const current = requireRow(await this.repo.find(tx, link, id));
      if (current.status !== "OPEN" || current.version !== input.version) conflict();
      this.validateDate(input.followUpDate);
      return this.repo.update(tx, current, {
        ...(input.followUpDate !== undefined ? { followUpDate: input.followUpDate } : {}),
        ...(input.status ? { status: input.status, closedAt: new Date() } : {}),
      });
    });
    return this.coachDto(row, studentId);
  }

  async respond(studentId: string, id: string, input: RespondMentorshipFollowupInput) {
    await this.assertEnabled();
    const active = await this.linkRepo.findActiveByStudent(studentId);
    if (!active) throw new DomainError(ErrorCode.MENTORSHIP_LINK_NOT_FOUND, HttpStatus.NOT_FOUND);
    const result = await this.links.withServiceTransaction(async (tx) => {
      const link = await this.links.requireActiveLinkInTransaction(tx, active.coachId, studentId);
      const row = requireRow(await this.repo.find(tx, link, id));
      if (row.sharedDecision === null) throw new DomainError(ErrorCode.MENTORSHIP_FOLLOWUP_NOT_FOUND, HttpStatus.NOT_FOUND);
      if (row.status !== "OPEN") conflict();
      // Only an immediately repeated response is a retry; a newer schedule/response must conflict.
      if (row.response === input.response && (row.version === input.version || (row.version === input.version + 1 && row.responseVersion === row.version))) return { row, changed: false };
      if (row.version !== input.version) conflict();
      const updated = await this.repo.update(tx, row, { response: input.response, respondedAt: new Date(), responseVersion: row.version + 1 });
      return { row: updated, changed: true };
    });
    if (result.changed) this.events.emit("mentorship.followup.responded", { followupId: result.row.id, version: result.row.version });
    return toSharedFollowup(result.row);
  }

  async listCoach(coachId: string, query: ListMentorshipFollowupsQuery) {
    await this.assertEnabled();
    if (query.studentId) await this.links.requireActiveLink(coachId, query.studentId);
    const result = await this.repo.listCoach(coachId, query, followupToday(new Date()));
    const identities = await this.users.listDisplayIdentities([...new Set(result.rows.map((row) => row.studentId))]);
    return { items: result.rows.map(({ followup, studentId }) => {
      const identity = identities.get(studentId);
      if (!identity) throw new DomainError(ErrorCode.MENTORSHIP_LINK_NOT_FOUND, HttpStatus.NOT_FOUND);
      return toCoachFollowup(followup, studentId, identity.displayName);
    }), total: result.total, page: query.page, pageSize: query.pageSize };
  }

  async listStudent(studentId: string, query: PaginationQuery) {
    await this.assertEnabled();
    const result = await this.repo.listStudent(studentId, query.page, query.pageSize);
    return { items: result.rows.map(toSharedFollowup), total: result.total, ...query };
  }

  async getNotificationTarget(followupId: string, kind: "shared" | "responded", version: number): Promise<{ recipientId: string; link: string } | null> {
    if (!(await this.getAvailability()).enabled) return null;
    const target = await this.repo.notificationTarget(followupId, kind, version);
    if (!target) return null;
    return kind === "shared" ? { recipientId: target.studentId, link: "/my-coach" } : { recipientId: target.coachId, link: `/students/${target.studentId}` };
  }

  async listDueCoachIds(now: Date): Promise<string[]> {
    return (await this.getAvailability()).enabled ? this.repo.listDueCoachIds(followupToday(now)) : [];
  }

  async getDueCount(coachId: string, now: Date): Promise<number> {
    return (await this.getAvailability()).enabled ? this.repo.getDueCount(coachId, followupToday(now)) : 0;
  }
}
