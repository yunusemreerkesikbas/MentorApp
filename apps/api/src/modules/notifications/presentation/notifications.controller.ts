import { Body, Controller, Delete, Get, HttpCode, MessageEvent, Param, ParseUUIDPipe, Patch, Post, Query, Sse, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Observable } from "rxjs";
import type {
  NotificationListDto,
  NotificationPreferencesDto,
  SessionReturnReminderDto,
  UserNotificationDto,
} from "@mentor/types";
import { Public } from "../../../common/auth/public.decorator";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { NotificationsService } from "../application/notifications.service";
import { SessionReturnReminderService } from "../application/session-return-reminder.service";
import {
  ListNotificationsDto,
  PushSubscribeDto,
  PushUnsubscribeDto,
  ScheduleSessionReturnReminderDto,
  UpdateNotificationPreferencesDto,
} from "./notifications.dto";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly sessionReturn: SessionReturnReminderService,
  ) {}

  @Post("push-subscriptions")
  subscribePush(
    @CurrentUser() user: RequestUser,
    @Body() body: PushSubscribeDto,
  ): Promise<void> {
    return this.notifications.subscribePush(user.id, body);
  }

  @Delete("push-subscriptions")
  unsubscribePush(
    @CurrentUser() user: RequestUser,
    @Body() body: PushUnsubscribeDto,
  ): Promise<void> {
    return this.notifications.unsubscribePush(user.id, body.endpoint);
  }

  @Get("preferences")
  getPreferences(@CurrentUser() user: RequestUser): Promise<NotificationPreferencesDto> {
    return this.notifications.getPreferences(user.id);
  }

  @Patch("preferences")
  updatePreferences(
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesDto> {
    return this.notifications.updatePreferences(user.id, body);
  }

  /** Opt-in soft return after a study session — schedules ~24h reminder (mobile-ready). */
  @Post("session-return-reminder")
  scheduleSessionReturn(
    @CurrentUser() user: RequestUser,
    @Body() body: ScheduleSessionReturnReminderDto,
  ): Promise<SessionReturnReminderDto> {
    return this.sessionReturn.schedule(user.id, body);
  }

  // --- In-app notification inbox ---

  /** Issues a short-lived (60s) one-time token for the SSE stream (EventSource can't send headers). */
  @Post("stream-token")
  createStreamToken(@CurrentUser() user: RequestUser): { token: string } {
    return { token: this.notifications.createStreamToken(user.id) };
  }

  /** SSE stream — client provides ?token= obtained from POST stream-token. */
  @Sse("stream")
  @Public()
  stream(@Query("token") token: string): Observable<MessageEvent> {
    const userId = this.notifications.validateAndConsumeStreamToken(token);
    if (!userId) throw new UnauthorizedException("invalid_stream_token");
    return this.notifications.createStream(userId);
  }

  @Get()
  listNotifications(
    @CurrentUser() user: RequestUser,
    @Query() q: ListNotificationsDto,
  ): Promise<NotificationListDto> {
    return this.notifications.listInApp(user.id, q.category, q.page);
  }

  @Patch("read-all")
  @HttpCode(204)
  markAllRead(@CurrentUser() user: RequestUser): Promise<void> {
    return this.notifications.markAllRead(user.id);
  }

  @Patch(":id/read")
  markRead(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<UserNotificationDto> {
    return this.notifications.markRead(user.id, id);
  }

  @Patch(":id/unread")
  markUnread(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<UserNotificationDto> {
    return this.notifications.markUnread(user.id, id);
  }

  @Delete(":id")
  @HttpCode(204)
  deleteNotification(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.notifications.deleteNotification(user.id, id);
  }
}
