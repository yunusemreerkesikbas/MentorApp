import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { Observable } from "rxjs";

import type { MessageEvent } from "@nestjs/common";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { notificationCategorySchema } from "@mentor/validation";
import { I18nContext, I18nService } from "nestjs-i18n";
import type {
  NotificationCategory,
  NotificationListDto,
  NotificationPreferencesDto,
  PushSubscriptionInput,
  UserNotificationDto,
} from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { PushEndpointPolicy } from "../../../shared/adapters/push/push-endpoint-policy";
import { NotificationStreamService } from "./notification-stream.service";
export { REALTIME_QUEUE_TTL_MS } from "./notification-stream.service";
import type { NotificationCopyKey } from "../domain/notification-copy";
import { NotificationsCopyService } from "./notifications-copy.service";
import { NotificationPreferencesRepository } from "../infrastructure/notification-preferences.repository";
import { PushSubscriptionRepository } from "../infrastructure/push-subscription.repository";
import {
  NOTIFICATION_PAGE_SIZE,
  UserNotificationRepository,
  type UserNotificationRow,
} from "../infrastructure/user-notification.repository";

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly pushSubs: PushSubscriptionRepository,
    private readonly preferences: NotificationPreferencesRepository,
    private readonly userNotifs: UserNotificationRepository,
    private readonly i18n: I18nService,
    private readonly copy: NotificationsCopyService,
    private readonly streams: NotificationStreamService,
    private readonly registry: ConfigRegistryService,
    private readonly endpoints: PushEndpointPolicy,
  ) {}

  createStreamToken(userId: string, sessionId: string): string {
    return this.streams.createStreamToken(userId, sessionId);
  }

  validateAndConsumeStreamToken(token: string) {
    return this.streams.validateAndConsumeStreamToken(token);
  }

  createStream(userId: string, sessionId: string): Promise<Observable<MessageEvent>> {
    return this.streams.createStream(userId, sessionId);
  }

  private pushToStreams(userId: string): void {
    this.pushRealtimeEvent(userId, "new_notification");
  }

  pushRealtimeEvent(userId: string, event: string, extra?: Record<string, unknown>, queueTtlMs?: number): void {
    this.streams.pushRealtimeEvent(userId, event, extra, queueTtlMs);
  }
  async subscribePush(userId: string, input: PushSubscriptionInput): Promise<void> {
    await this.endpoints.resolve(input.endpoint);
    const maxSubscriptions = await this.registry.get("notifications.push.max_subscriptions") as number;
    await withUserContext(this.db, { userId }, async (tx) => {
      await this.pushSubs.upsertWithinLimit(tx, userId, {
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      }, maxSubscriptions);
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
        campaignsEnabled: row.campaignsEnabled,
      };
    });
  }

  async updatePreferences(
    userId: string,
    patch: Partial<
      Pick<NotificationPreferencesDto, "emailEnabled" | "pushEnabled" | "campaignsEnabled">
    >,
  ): Promise<NotificationPreferencesDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.preferences.update(tx, userId, patch);
      return {
        emailEnabled: row.emailEnabled,
        pushEnabled: row.pushEnabled,
        campaignsEnabled: row.campaignsEnabled,
      };
    });
  }

  // --- In-app notification inbox ---

  resolveCopy(
    templateKey: NotificationCopyKey,
    args: Record<string, unknown> = {},
    lang?: string,
  ) {
    return this.copy.resolve(templateKey, args, lang);
  }

  /**
   * Resolve catalog copy, persist title/body as a fallback, and store `templateKey` + `args`
   * so `toDto` can re-localize on read ([docs/copy/voice.md](../../../../../docs/copy/voice.md)).
   */
  async createFromTemplate(
    userId: string,
    category: NotificationCategory,
    templateKey: NotificationCopyKey,
    linkUrl?: string,
    options?: {
      args?: Record<string, unknown>;
      dedupeKey?: string;
      data?: Record<string, unknown>;
      notifyRealtime?: boolean;
      lang?: string;
    },
  ): Promise<boolean> {
    const args = options?.args ?? {};
    const { title, body } = this.copy.resolve(templateKey, args, options?.lang);
    return this.createInApp(userId, category, title, body, linkUrl, {
      dedupeKey: options?.dedupeKey,
      notifyRealtime: options?.notifyRealtime,
      data: { ...options?.data, templateKey, args },
    });
  }

  /** Called by DailyReminderService and future event listeners (SERVICE context). */
  async createInApp(
    userId: string,
    category: NotificationCategory,
    title: string,
    body: string,
    linkUrl?: string,
    options?: {
      dedupeKey?: string;
      data?: Record<string, unknown>;
      notifyRealtime?: boolean;
    },
  ): Promise<boolean> {
    const { notifyRealtime = true, ...storageOptions } = options ?? {};
    const created = await withServiceContext(this.db, async (tx) => {
      return this.userNotifs.create(tx, {
        userId,
        category,
        title,
        body,
        linkUrl,
        ...storageOptions,
      });
    });
    if (created && notifyRealtime) this.pushToStreams(userId);
    return created !== null;
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
      const items = rows.slice(0, NOTIFICATION_PAGE_SIZE).map((row) => this.toDto(row));
      return { items, unreadCount, hasMore };
    });
  }

  async markRead(userId: string, id: string): Promise<UserNotificationDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.userNotifs.markRead(tx, userId, id);
      if (!row) throw new NotFoundException("notification.not_found");
      return this.toDto(row);
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      await this.userNotifs.markAllRead(tx, userId);
    });
  }

  async markUnread(userId: string, id: string): Promise<UserNotificationDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.userNotifs.markUnread(tx, userId, id);
      if (!row) throw new NotFoundException("notification.not_found");
      return this.toDto(row);
    });
  }

  async deleteNotification(userId: string, id: string): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      await this.userNotifs.delete(tx, userId, id);
    });
  }

  private toDto(row: UserNotificationRow): UserNotificationDto {
    const category = notificationCategorySchema.parse(row.category);
    let title = row.title;
    let body = row.body;
    if (category === "ACHIEVEMENT" && row.data) {
      const lang = I18nContext.current()?.lang ?? "tr";
      const kind = row.data.kind;
      const id = row.data.achievementId;
      if (kind === "ACHIEVEMENT" && typeof id === "string") {
        const achievementTitle = String(
          this.i18n.translate(`achievements.items.${id}.title`, { lang }),
        );
        title = String(this.i18n.translate("achievements.notification.title", { lang }));
        body = String(
          this.i18n.translate("achievements.notification.body", {
            lang,
            args: { title: achievementTitle },
          }),
        );
      } else if (kind === "BACKFILL_SUMMARY" && typeof row.data.count === "number") {
        title = String(
          this.i18n.translate("achievements.notification.backfillTitle", { lang }),
        );
        body = String(
          this.i18n.translate("achievements.notification.backfillBody", {
            lang,
            args: { count: row.data.count },
          }),
        );
      }
    } else if (row.data?.templateKey) {
      const resolved = this.copy.resolveStored(row, I18nContext.current()?.lang);
      title = resolved.title;
      body = resolved.body;
    }
    return {
      id: row.id,
      category,
      title,
      body,
      readAt: row.readAt?.toISOString() ?? null,
      linkUrl: row.linkUrl ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
