import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { DRIZZLE } from "../../../../database/database.constants";
import type { Database } from "../../../../database/drizzle";
import { withServiceContext } from "../../../../database/rls";
import { EMAIL_PORT, type EmailPort } from "../../../../shared/ports/email.port";
import { UsersService } from "../../../identity/application/users.service";
import { MentorshipFollowupService } from "../../../mentorship/application/mentorship-followup.service";
import { EmailTemplate } from "../../domain/notifications.constants";
import { NotificationDeliveryRepository } from "../../infrastructure/notification-delivery.repository";
import { NotificationPreferencesRepository } from "../../infrastructure/notification-preferences.repository";

const sendEmailPayloadSchema = z.object({
  to: z.string().email(),
  template: z.string().min(1),
  variables: z.record(z.unknown()).optional(),
});

const followupDuePayloadSchema = z.object({
  template: z.literal(EmailTemplate.MENTORSHIP_FOLLOWUP_DUE),
  variables: z.record(z.unknown()).optional(),
  executionGuard: z.object({
    type: z.literal("mentorship-followup-due"),
    coachId: z.string().uuid(),
    dedupeKey: z.string().min(1),
  }),
});

/** Handles `notifications.send-email` jobs. */
@Injectable()
export class SendEmailHandler {
  constructor(
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly followups: MentorshipFollowupService,
    private readonly preferences: NotificationPreferencesRepository,
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly users: UsersService,
  ) {}

  async handle(payload: unknown): Promise<void> {
    const guarded = followupDuePayloadSchema.safeParse(payload);
    if (guarded.success) {
      await this.sendFollowupDue(guarded.data);
      return;
    }
    const data = sendEmailPayloadSchema.parse(payload);
    await this.email.sendTransactional({
      to: data.to,
      template: data.template as EmailTemplate,
      variables: data.variables,
    });
  }

  private async sendFollowupDue(
    payload: z.infer<typeof followupDuePayloadSchema>,
  ): Promise<void> {
    const { coachId, dedupeKey } = payload.executionGuard;
    const count = await this.followups.getDueCount(coachId, new Date());
    if (count === 0) return;

    const prefs = await withServiceContext(this.db, (tx) =>
      this.preferences.findByUserIdService(tx, coachId),
    );
    if (!(prefs?.emailEnabled ?? true)) return;

    const contact = await this.users.getNotificationContact(coachId);
    if (!contact) return;

    const delivery = {
      userId: coachId,
      channel: "EMAIL",
      template: EmailTemplate.MENTORSHIP_FOLLOWUP_DUE,
      dedupeKey,
    };
    const claimed = await withServiceContext(this.db, (tx) => this.deliveries.tryRecord(tx, delivery));
    if (!claimed) return;

    try {
      await this.email.sendTransactional({
        to: contact.email,
        template: EmailTemplate.MENTORSHIP_FOLLOWUP_DUE,
        variables: { ...payload.variables, count, displayName: contact.displayName },
      });
    } catch (error) {
      await withServiceContext(this.db, (tx) => this.deliveries.release(tx, delivery));
      throw error;
    }
  }
}
