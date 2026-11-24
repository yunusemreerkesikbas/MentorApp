import { createZodDto } from "../../../common/validation/zod-dto";
import {
  listNotificationsSchema,
  mobilePushRegisterSchema,
  mobilePushUnregisterSchema,
  notificationIdParamSchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  scheduleSessionReturnReminderSchema,
  updateNotificationPreferencesSchema,
} from "@mentor/validation";

export class PushSubscribeDto extends createZodDto(pushSubscribeSchema) {}
export class PushUnsubscribeDto extends createZodDto(pushUnsubscribeSchema) {}
export class MobilePushRegisterDto extends createZodDto(mobilePushRegisterSchema) {}
export class MobilePushUnregisterDto extends createZodDto(mobilePushUnregisterSchema) {}
export class UpdateNotificationPreferencesDto extends createZodDto(
  updateNotificationPreferencesSchema,
) {}
export class ListNotificationsDto extends createZodDto(listNotificationsSchema) {}
export class NotificationIdParamDto extends createZodDto(notificationIdParamSchema) {}
export class ScheduleSessionReturnReminderDto extends createZodDto(
  scheduleSessionReturnReminderSchema,
) {}
