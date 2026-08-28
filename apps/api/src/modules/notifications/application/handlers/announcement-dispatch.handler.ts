import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";
import type { AnnouncementAudience } from "@mentor/types";
import { DRIZZLE } from "../../../../database/database.constants";
import type { Database } from "../../../../database/drizzle";
import { withServiceContext } from "../../../../database/rls";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../../shared/ports/job-queue.port";
import { UsersService } from "../../../identity/application/users.service";
import { JobName } from "../../domain/notifications.constants";
import { AnnouncementRepository } from "../../infrastructure/announcement.repository";
import { UserNotificationRepository } from "../../infrastructure/user-notification.repository";
import { NotificationsService } from "../notifications.service";

/**
 * ponytail: 500 recipients per job run, resumed by keyset cursor. The ceiling is job wall-time,
 * not memory — if the user table outgrows a few minutes of chained jobs, replace the loop with a
 * set-based `INSERT … SELECT` behind the same identity seam.
 */
export const ANNOUNCEMENT_BATCH_SIZE = 500;

const payloadSchema = z.object({
  announcementId: z.string().uuid(),
  afterUserId: z.string().uuid().nullable().default(null),
});

/** Handles `notifications.dispatch-announcement` jobs — broadcast fan-out into the in-app inbox. */
@Injectable()
export class AnnouncementDispatchHandler {
  private readonly logger = new Logger(AnnouncementDispatchHandler.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly announcements: AnnouncementRepository,
    private readonly userNotifs: UserNotificationRepository,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  async handle(payload: unknown): Promise<void> {
    const { announcementId, afterUserId } = payloadSchema.parse(payload);

    const announcement = await withServiceContext(this.db, (tx) =>
      this.announcements.findById(tx, announcementId),
    );
    if (!announcement) {
      this.logger.warn(`Announcement ${announcementId} vanished before dispatch — dropping job.`);
      return;
    }
    // Already finished (a replayed job, or a manual re-enqueue after completion).
    if (announcement.status === "SENT") return;

    const audience = announcement.audience as unknown as AnnouncementAudience;
    const examType = audience.kind === "EXAM_TYPE" ? audience.examType : null;

    const recipients = await this.users.listAnnouncementRecipients(
      examType,
      afterUserId,
      ANNOUNCEMENT_BATCH_SIZE,
    );

    // Dedupe key makes the whole batch idempotent via the (user_id, dedupe_key) partial unique
    // index — a retried job re-inserts nothing and returns no rows.
    const dedupeKey = `announcement:${announcementId}`;
    const created = await withServiceContext(this.db, (tx) =>
      this.userNotifs.createMany(
        tx,
        recipients.map((r) => ({
          userId: r.id,
          category: "SYSTEM" as const,
          title: announcement.title,
          body: announcement.body,
          linkUrl: announcement.linkUrl ?? undefined,
          dedupeKey,
        })),
      ),
    );

    // Live bell bump for whoever has a stream open. No queue TTL: a broadcast does not need to
    // wake a tab that is about to connect — the durable inbox row is already there.
    for (const row of created) {
      this.notifications.pushRealtimeEvent(row.userId, "new_notification");
    }

    await withServiceContext(this.db, async (tx) => {
      await this.announcements.addRecipients(tx, announcementId, created.length);
      if (recipients.length < ANNOUNCEMENT_BATCH_SIZE) {
        await this.announcements.markSent(tx, announcementId);
      }
    });

    if (recipients.length === ANNOUNCEMENT_BATCH_SIZE) {
      await this.queue.enqueue(JobName.DISPATCH_ANNOUNCEMENT, {
        announcementId,
        afterUserId: recipients[recipients.length - 1]!.id,
      });
    }
  }
}
