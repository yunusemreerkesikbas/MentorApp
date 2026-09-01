import { Inject, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { EMPTY, interval, merge, Observable, of, Subject } from "rxjs";
import { finalize, map } from "rxjs/operators";
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
import type { NotificationCopyKey } from "../domain/notification-copy";
import { NotificationsCopyService } from "./notifications-copy.service";
import { NotificationPreferencesRepository } from "../infrastructure/notification-preferences.repository";
import { PushSubscriptionRepository } from "../infrastructure/push-subscription.repository";
import {
  NOTIFICATION_PAGE_SIZE,
  UserNotificationRepository,
  type UserNotificationRow,
} from "../infrastructure/user-notification.repository";

const STREAM_TOKEN_TTL_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = 25_000;
/**
 * How long a realtime cue waits for an offline recipient. A live SSE push only lands if the
 * client happens to be connected; queuing it briefly means a user who opens/focuses the tab
 * moments later still gets it (the durable notification remains the long-term fallback).
 */
export const REALTIME_QUEUE_TTL_MS = 5 * 60_000;

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly streamTokens = new Map<string, { userId: string; exp: number }>();
  private readonly streams = new Map<string, Set<Subject<MessageEvent>>>();
  /** Realtime cues for users who weren't connected — flushed on their next stream connect. */
  private readonly pendingRealtime = new Map<string, { data: Record<string, unknown>; exp: number }>();
  private tokenCleanupTimer?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly pushSubs: PushSubscriptionRepository,
    private readonly preferences: NotificationPreferencesRepository,
    private readonly userNotifs: UserNotificationRepository,
    private readonly i18n: I18nService,
    private readonly copy: NotificationsCopyService,
  ) {}

  onModuleInit(): void {
    // Purge expired stream tokens every 60s to prevent unbounded Map growth
    this.tokenCleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [token, entry] of this.streamTokens) {
        if (entry.exp < now) this.streamTokens.delete(token);
      }
      for (const [userId, entry] of this.pendingRealtime) {
        if (entry.exp < now) this.pendingRealtime.delete(userId);
      }
    }, 60_000);
  }

  onModuleDestroy(): void {
    clearInterval(this.tokenCleanupTimer);
  }

  // --- SSE streaming ---

  createStreamToken(userId: string): string {
    const token = randomUUID();
    this.streamTokens.set(token, { userId, exp: Date.now() + STREAM_TOKEN_TTL_MS });
    return token;
  }

  validateAndConsumeStreamToken(token: string): string | null {
    const entry = this.streamTokens.get(token);
    if (!entry || entry.exp < Date.now()) {
      this.streamTokens.delete(token);
      return null;
    }
    this.streamTokens.delete(token); // one-time use
    return entry.userId;
  }

  createStream(userId: string): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    let set = this.streams.get(userId);
    if (!set) { set = new Set(); this.streams.set(userId, set); }
    set.add(subject);

    // ponytail: heartbeat prevents proxy timeout at 30s; upgrade to per-connection if needed
    const heartbeat = interval(HEARTBEAT_INTERVAL_MS).pipe(
      map(() => ({ data: "" } as MessageEvent)),
    );

    // Flush a cue that arrived while this user had no open stream (e.g. a study invite
    // sent seconds before they focused the tab) — emitted on subscribe, before live events.
    const queued = this.takePendingRealtime(userId);

    return merge(queued ? of(queued) : EMPTY, subject.asObservable(), heartbeat).pipe(
      finalize(() => {
        set?.delete(subject);
        if (set?.size === 0) this.streams.delete(userId);
      }),
    );
  }

  private pushToStreams(userId: string): void {
    this.pushRealtimeEvent(userId, "new_notification");
  }

  /**
   * Push a typed realtime event to a user's live SSE streams (no-op if they're not
   * connected). Beyond the generic bell ping, this carries a payload the client can
   * branch on — e.g. a live "study_invite" modal cue. The durable notification is the
   * async fallback; this only reaches an online recipient.
   */
  pushRealtimeEvent(
    userId: string,
    event: string,
    extra?: Record<string, unknown>,
    queueTtlMs?: number,
  ): void {
    const data = { event, ...extra };
    const set = this.streams.get(userId);
    if (set && set.size > 0) {
      for (const s of set) s.next({ data } as MessageEvent);
      return;
    }
    // Nobody listening — hold it briefly so an about-to-connect client still sees it.
    if (queueTtlMs) {
      this.pendingRealtime.set(userId, { data, exp: Date.now() + queueTtlMs });
    }
  }

  /** Take (and clear) a still-valid queued cue for this user. */
  private takePendingRealtime(userId: string): MessageEvent | null {
    const pending = this.pendingRealtime.get(userId);
    if (!pending) return null;
    this.pendingRealtime.delete(userId);
    if (pending.exp < Date.now()) return null;
    return { data: pending.data } as MessageEvent;
  }

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
