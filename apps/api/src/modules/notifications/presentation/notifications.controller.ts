import { Body, Controller, Delete, Get, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { NotificationPreferencesDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { NotificationsService } from "../application/notifications.service";
import {
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
}
