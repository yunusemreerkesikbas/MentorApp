import { createZodDto } from "../../../common/validation/zod-dto";
import {
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  updateNotificationPreferencesSchema,
} from "@mentor/validation";

export class PushSubscribeDto extends createZodDto(pushSubscribeSchema) {}
export class PushUnsubscribeDto extends createZodDto(pushUnsubscribeSchema) {}
export class UpdateNotificationPreferencesDto extends createZodDto(
  updateNotificationPreferencesSchema,
) {}
