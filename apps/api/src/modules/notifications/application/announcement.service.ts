import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminAnnouncementDto, AnnouncementAudience, AnnouncementStatus } from "@mentor/types";
import type { CreateAnnouncement, SendAnnouncement } from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import { JobName } from "../domain/notifications.constants";
import {
  AnnouncementRepository,
  type AnnouncementRow,
} from "../infrastructure/announcement.repository";

/**
 * Team-authored broadcast (W5). The admin panel drives this; the actual fan-out into
 * `user_notifications` happens asynchronously in `AnnouncementDispatchHandler` so a large
 * audience never blocks the request. Every write runs in SERVICE context — the table is
 * cross-user by nature and RLS only admits SERVICE/ADMIN.
 */
@Injectable()
export class AnnouncementService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly announcements: AnnouncementRepository,
  ) {}

  async list(page: number): Promise<AdminAnnouncementDto[]> {
    const rows = await withServiceContext(this.db, (tx) => this.announcements.list(tx, page));
    return rows.map(toDto);
  }

  async create(input: CreateAnnouncement, actorUserId: string): Promise<AdminAnnouncementDto> {
    const row = await withServiceContext(this.db, (tx) =>
      this.announcements.create(tx, {
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl,
        audience: input.audience,
        createdBy: actorUserId,
      }),
    );
    return toDto(row);
  }

  /**
   * Queue the fan-out. `scheduledAt` becomes the job's `runAt` — the Postgres queue already
   * honours it, so there is no separate scheduler. Only a DRAFT can be sent; the DRAFT→SENDING
   * transition is the concurrency belt against a double-click sending twice.
   */
  async send(
    id: string,
    input: SendAnnouncement,
    now: Date = new Date(),
  ): Promise<AdminAnnouncementDto> {
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (scheduledAt && scheduledAt.getTime() < now.getTime()) {
      throw new BadRequestException("announcement.scheduled_at_in_past");
    }

    const row = await withServiceContext(this.db, async (tx) => {
      const existing = await this.announcements.findById(tx, id);
      if (!existing) throw new NotFoundException("announcement.not_found");
      const sending = await this.announcements.markSending(tx, id, scheduledAt);
      if (!sending) throw new BadRequestException("announcement.not_draft");
      return sending;
    });

    await this.queue.enqueue(
      JobName.DISPATCH_ANNOUNCEMENT,
      { announcementId: id, afterUserId: null },
      scheduledAt ? { runAt: scheduledAt } : undefined,
    );
    return toDto(row);
  }

  async deleteDraft(id: string): Promise<void> {
    const existing = await withServiceContext(this.db, (tx) => this.announcements.findById(tx, id));
    if (!existing) throw new NotFoundException("announcement.not_found");
    const deleted = await withServiceContext(this.db, (tx) =>
      this.announcements.deleteDraft(tx, id),
    );
    if (!deleted) throw new BadRequestException("announcement.not_draft");
  }

  /** Read-only fetch for the admin audit `before` snapshot. */
  async findOne(id: string): Promise<AdminAnnouncementDto | null> {
    const row = await withServiceContext(this.db, (tx) => this.announcements.findById(tx, id));
    return row ? toDto(row) : null;
  }
}

export function toDto(row: AnnouncementRow): AdminAnnouncementDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    linkUrl: row.linkUrl ?? null,
    audience: row.audience as unknown as AnnouncementAudience,
    status: row.status as AnnouncementStatus,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    recipientCount: row.recipientCount,
    createdAt: row.createdAt.toISOString(),
  };
}
