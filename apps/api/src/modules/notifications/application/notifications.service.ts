import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { notificationCategorySchema } from "@mentor/validation";
import type {
  NotificationCategory,
  NotificationListDto,
  NotificationPreferencesDto,
  PushSubscriptionInput,
  UserNotificationDto,
} from "@mentor/types";
import { NotificationPreferencesRepository } from "../infrastructure/notification-preferences.repository";
import { PushSubscriptionRepository } from "../infrastructure/push-subscription.repository";
import { NOTIFICATION_PAGE_SIZE, UserNotificationRepository } from "../infrastructure/user-notification.repository";

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly pushSubs: PushSubscriptionRepository,
    private readonly preferences: NotificationPreferencesRepository,
    private readonly userNotifs: UserNotificationRepository,
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

  // --- In-app notification inbox ---

  /** Called by DailyReminderService and future event listeners (SERVICE context). */
  async createInApp(
    userId: string,
    category: NotificationCategory,
    title: string,
    body: string,
  ): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await this.userNotifs.create(tx, { userId, category, title, body });
    });
  }

  async listInApp(
    userId: string,
    category: NotificationCategory | undefined,
    page: number,
  ): Promise<NotificationListDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const [rows, unreadCount] = await Promise.all([
        this.userNotifs.listByUser(tx, userId, category, page),
        this.userNotifs.countUnread(tx, userId),
      ]);
      const hasMore = rows.length > NOTIFICATION_PAGE_SIZE;
      const items = rows.slice(0, NOTIFICATION_PAGE_SIZE).map(toDto);
      return { items, unreadCount, hasMore };
    });
  }

  async markRead(userId: string, id: string): Promise<UserNotificationDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.userNotifs.markRead(tx, userId, id);
      if (!row) throw new NotFoundException("notification.not_found");
      return toDto(row);
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      await this.userNotifs.markAllRead(tx, userId);
    });
  }
}

function toDto(row: {
  id: string;
  category: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}): UserNotificationDto {
  return {
    id: row.id,
    category: notificationCategorySchema.parse(row.category),
    title: row.title,
    body: row.body,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
