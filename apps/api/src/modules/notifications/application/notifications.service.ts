import { Inject, Injectable } from "@nestjs/common";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import type {
  NotificationPreferencesDto,
  PushSubscriptionInput,
} from "@mentor/types";
import { NotificationPreferencesRepository } from "../infrastructure/notification-preferences.repository";
import { PushSubscriptionRepository } from "../infrastructure/push-subscription.repository";

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly pushSubs: PushSubscriptionRepository,
    private readonly preferences: NotificationPreferencesRepository,
  ) {}

  async subscribePush(userId: string, input: PushSubscriptionInput): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      await this.pushSubs.upsert(tx, userId, {
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      });
      await this.preferences.getOrCreate(tx, userId);
    });
  }

  async unsubscribePush(userId: string, endpoint: string): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      await this.pushSubs.deleteByEndpoint(tx, userId, endpoint);
    });
  }

  async getPreferences(userId: string): Promise<NotificationPreferencesDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.preferences.getOrCreate(tx, userId);
      return {
        emailEnabled: row.emailEnabled,
        pushEnabled: row.pushEnabled,
      };
    });
  }

  async updatePreferences(
    userId: string,
    patch: Partial<Pick<NotificationPreferencesDto, "emailEnabled" | "pushEnabled">>,
  ): Promise<NotificationPreferencesDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.preferences.update(tx, userId, patch);
      return {
        emailEnabled: row.emailEnabled,
        pushEnabled: row.pushEnabled,
      };
    });
  }
}
