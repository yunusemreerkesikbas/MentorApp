import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type {
  NotificationListDto,
  NotificationPreferencesDto,
  UserNotificationDto,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { NotificationsService } from "../application/notifications.service";
import {
  ListNotificationsDto,
  NotificationIdParamDto,
  PushSubscribeDto,
  PushUnsubscribeDto,
  UpdateNotificationPreferencesDto,
} from "./notifications.dto";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

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

  // --- In-app notification inbox ---

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
    @Param() params: NotificationIdParamDto,
  ): Promise<UserNotificationDto> {
    return this.notifications.markRead(user.id, params.id);
  }
}
